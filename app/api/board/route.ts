import { env } from "cloudflare:workers";

const BOARD_ID = "main";
const MAX_BOARD_SIZE = 750_000;

type BoardPayload = {
  title?: unknown;
  theme?: unknown;
  columns?: unknown;
  cards?: unknown;
};

async function ensureBoardTable() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS kanban_boards (
      id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
}

function isValidBoard(board: BoardPayload) {
  return (
    typeof board.title === "string" &&
    board.title.length <= 120 &&
    typeof board.theme === "string" &&
    Array.isArray(board.columns) &&
    board.columns.length > 0 &&
    board.columns.length <= 30 &&
    Array.isArray(board.cards) &&
    board.cards.length <= 5_000
  );
}

export async function GET() {
  try {
    await ensureBoardTable();
    const row = await env.DB.prepare(
      "SELECT state_json AS stateJson, updated_at AS updatedAt FROM kanban_boards WHERE id = ?",
    )
      .bind(BOARD_ID)
      .first<{ stateJson: string; updatedAt: number }>();

    return Response.json({
      board: row ? JSON.parse(row.stateJson) : null,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar o quadro";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as { board?: BoardPayload };
    if (!payload.board || !isValidBoard(payload.board)) {
      return Response.json({ error: "Quadro inválido" }, { status: 400 });
    }

    const stateJson = JSON.stringify(payload.board);
    if (stateJson.length > MAX_BOARD_SIZE) {
      return Response.json({ error: "O quadro ultrapassou o tamanho permitido" }, { status: 413 });
    }

    await ensureBoardTable();
    const updatedAt = Date.now();
    await env.DB.prepare(`
      INSERT INTO kanban_boards (id, state_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `)
      .bind(BOARD_ID, stateJson, updatedAt)
      .run();

    return Response.json({ ok: true, updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar o quadro";
    return Response.json({ error: message }, { status: 500 });
  }
}

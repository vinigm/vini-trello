"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bold,
  Briefcase,
  CalendarDays,
  Check,
  Cloud,
  CloudOff,
  Columns3,
  FileText,
  GripVertical,
  Highlighter,
  Italic,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  List,
  ListChecks,
  ListOrdered,
  MoreHorizontal,
  Paintbrush,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Strikethrough,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import {
  FormEvent,
  type CSSProperties,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth, db } from "../src/firebase";

type Priority = "low" | "medium" | "high";
type Theme = "peach" | "lilac" | "ocean" | "midnight" | "rose" | "sage" | "sky" | "sand" | "paper" | "graphite";

type ActivityEntry = {
  id: string;
  text: string;
  createdAt: string;
};

type CardItem = {
  id: string;
  title: string;
  description: string;
  label: string;
  labelColor: string;
  dueDate: string;
  priority: Priority;
  checklistDone: number;
  checklistTotal: number;
  activity?: ActivityEntry[];
};

type ColumnItem = {
  id: string;
  title: string;
  color: string;
  cardIds: string[];
};

type BoardState = {
  id: string;
  title: string;
  theme: Theme;
  columns: ColumnItem[];
  cards: CardItem[];
};

type WorkspaceState = {
  schemaVersion: number;
  activeBoardId: string;
  boards: BoardState[];
  visibleBoardIds: string[];
  plannerNotes: Record<string, string>;
  plannerSlotColors: Record<string, string>;
  plannerWorkSlots: string[];
  plannerActivities: Record<string, PlannerActivity[]>;
  diaryContent: string;
  diaryPosts: DiaryPost[];
};

type DiaryPost = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
};

type PlannerActivity = {
  id: string;
  title: string;
  color: string;
};

type PlannerDragPayload =
  | { mode: "new"; title: string; color: string }
  | { mode: "move"; activityId: string; sourceKey: string };

type SaveStatus = "loading" | "saving" | "saved" | "offline";

const LABEL_COLORS = ["#f26b5f", "#f4a340", "#8d79e8", "#38a88f", "#4d8fd9"];
const COLUMN_COLORS = ["#f8dddd", "#dce8f4", "#dcecdf", "#f3ead1", "#ece2f3", "#e5e7eb", "#d9e8e7", "#ebe6df"];
const WORK_SLOT_COLOR = "#f6aaa7";
const ACADEMY_SLOT_COLOR = "#cfe4f6";
const CUSTOM_SLOT_COLOR = "#f3ead1";
const PLANNER_DRAG_MIME = "application/x-vinello-planner-card";

const DEFAULT_BOARD: BoardState = {
  id: "pessoal",
  title: "Pessoal",
  theme: "peach",
  columns: [
    {
      id: "inbox",
      title: "Caixa de entrada",
      color: "#f47768",
      cardIds: ["card-1", "card-2"],
    },
    {
      id: "week",
      title: "Esta semana",
      color: "#9b87ef",
      cardIds: ["card-3", "card-4"],
    },
    {
      id: "doing",
      title: "Em andamento",
      color: "#f3b94f",
      cardIds: ["card-5"],
    },
    {
      id: "done",
      title: "Concluído",
      color: "#4fbea6",
      cardIds: ["card-6"],
    },
  ],
  cards: [
    {
      id: "card-1",
      title: "Definir os objetivos da semana",
      description: "Escolher as três entregas que realmente precisam avançar.",
      label: "Planejamento",
      labelColor: "#f26b5f",
      dueDate: "2026-08-06",
      priority: "high",
      checklistDone: 1,
      checklistTotal: 3,
    },
    {
      id: "card-2",
      title: "Revisar portfólio pessoal",
      description: "Separar os projetos recentes e atualizar os textos.",
      label: "Pessoal",
      labelColor: "#8d79e8",
      dueDate: "2026-08-12",
      priority: "medium",
      checklistDone: 0,
      checklistTotal: 0,
    },
    {
      id: "card-3",
      title: "Organizar referências visuais",
      description: "Reunir cores, tipografias e layouts que combinam com o projeto.",
      label: "Design",
      labelColor: "#4d8fd9",
      dueDate: "2026-08-07",
      priority: "medium",
      checklistDone: 3,
      checklistTotal: 5,
    },
    {
      id: "card-4",
      title: "Reservar treino de sábado",
      description: "Confirmar o horário antes de sexta-feira.",
      label: "Rotina",
      labelColor: "#38a88f",
      dueDate: "2026-08-08",
      priority: "low",
      checklistDone: 0,
      checklistTotal: 0,
    },
    {
      id: "card-5",
      title: "Construir a primeira versão do Vinello",
      description: "Deixar o fluxo principal pronto para usar no computador e celular.",
      label: "Projeto",
      labelColor: "#f4a340",
      dueDate: "2026-08-05",
      priority: "high",
      checklistDone: 4,
      checklistTotal: 6,
    },
    {
      id: "card-6",
      title: "Limpar a lista de pendências antigas",
      description: "Arquivar o que não faz mais sentido e manter só o essencial.",
      label: "Organização",
      labelColor: "#38a88f",
      dueDate: "2026-08-04",
      priority: "low",
      checklistDone: 4,
      checklistTotal: 4,
    },
  ],
};

const WORKSPACE_SCHEMA_VERSION = 3;

const STANDARD_COLUMNS = [
  { key: "todo", title: "A fazer", color: "#f8dddd" },
  { key: "doing", title: "Fazendo", color: "#dce8f4" },
  { key: "review", title: "Congelado em revisão", color: "#eee8f3" },
  { key: "done", title: "Feito", color: "#dcecdf" },
  { key: "september", title: "Setembro", color: "#e8eaed" },
  { key: "october", title: "Outubro", color: "#e8eaed" },
  { key: "november", title: "Novembro", color: "#e8eaed" },
  { key: "december", title: "Dezembro", color: "#e8eaed" },
] as const;

const TRELLO_TASKS: Record<string, { todo?: string[]; doing?: string[]; done?: string[] }> = {
  italia: {
    todo: ["Ver roteiros", "Definir datas", "Tirar as férias", "Passagens", "Hotel", "Passeios"],
  },
  casa: {
    todo: [
      "Botar prateleira no banheiro da Vivi",
      "Ver se dá para abrir embaixo da churrasqueira na cozinha",
      "Forma de gelo de silicone",
      "Vender as cadeiras",
      "Verificar as fitas VHS/DVDs",
      "Projetar o escritório e ver como fica a mesa",
      "Ver o sofá novo",
    ],
    done: ["Finalizar aluguel do Itajaí"],
  },
  pessoal: {
    todo: ["Comprar papel bolha", "Comprar cera para o piso vinílico", "Responder e-mail com pesquisa", "Vender o celular da sogra"],
  },
  mestrado: {
    todo: [
      "Marcar apresentação de andamento para o dia 20",
      "Confirmar se consegui a cadeira de algoritmos",
      "Início das aulas dia 5",
      "Mandar para o comitê de ética o pedido dos dados de caso de dengue",
    ],
  },
  panvel: {
    todo: [
      "Melhorar regra de cobertura de estoque",
      "Fallback de densidade — itens sem previsão estão zerados",
      "Implementar bandas de incerteza",
      "Mapear o resto das regras de negócios",
      "Ver se o Nicholas já tem o arquivo pronto com as regras de negócio",
      "Investigação sobre a previsão do erro do faturamento do segundo semestre de 2026 em relação ao primeiro",
    ],
    doing: ["Modelagem de itens por categoria e mandar planilha para o Nicholas"],
  },
};

const DEMO_CARD_TITLES = new Set(DEFAULT_BOARD.cards.map((card) => card.title.toLocaleLowerCase("pt-BR")));

function normalizeKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function createStandardColumns(boardId: string) {
  return STANDARD_COLUMNS.map((column) => ({
    id: `${boardId}-${column.key}`,
    title: column.title,
    color: column.color,
    cardIds: [] as string[],
  }));
}

function createBlankBoard(id: string, title: string, theme: Theme): BoardState {
  return {
    id,
    title,
    theme,
    columns: createStandardColumns(id),
    cards: [],
  };
}

function getStandardColumnKey(title: string) {
  const normalized = normalizeKey(title);
  if (normalized.includes("andamento") || normalized === "fazendo") return "doing";
  if (normalized.includes("congelado") || normalized.includes("revisao")) return "review";
  if (normalized.includes("conclu") || normalized === "feito") return "done";
  if (normalized.includes("setembro")) return "september";
  if (normalized.includes("outubro")) return "october";
  if (normalized.includes("novembro")) return "november";
  if (normalized.includes("dezembro")) return "december";
  return "todo";
}

function ensureReviewColumn(board: BoardState) {
  if (board.columns.some((column) => getStandardColumnKey(column.title) === "review")) return board;
  const review = STANDARD_COLUMNS.find((column) => column.key === "review")!;
  const columns = [...board.columns];
  const doneIndex = columns.findIndex((column) => getStandardColumnKey(column.title) === "done");
  columns.splice(doneIndex >= 0 ? doneIndex : Math.min(2, columns.length), 0, {
    id: `${board.id}-review`,
    title: review.title,
    color: review.color,
    cardIds: [],
  });
  return { ...board, columns };
}

function migrateBoard(board: BoardState) {
  const shouldRemoveDemoCards = normalizeKey(board.title) === "pessoal";
  const cards = board.cards.filter((card) => !shouldRemoveDemoCards || !DEMO_CARD_TITLES.has(card.title.toLocaleLowerCase("pt-BR")));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const columns = createStandardColumns(board.id);
  const targetByKey = new Map(STANDARD_COLUMNS.map((column, index) => [column.key, columns[index]]));

  board.columns.forEach((column) => {
    const target = targetByKey.get(getStandardColumnKey(column.title)) ?? columns[0];
    column.cardIds.forEach((cardId) => {
      if (cardById.has(cardId) && !target.cardIds.includes(cardId)) target.cardIds.push(cardId);
    });
  });

  cards.forEach((card) => {
    if (!columns.some((column) => column.cardIds.includes(card.id))) columns[0].cardIds.push(card.id);
  });

  const seed = TRELLO_TASKS[normalizeKey(board.title)];
  if (seed) {
    const knownTitles = new Set(cards.map((card) => normalizeKey(card.title)));
    (["todo", "doing", "done"] as const).forEach((columnKey) => {
      seed[columnKey]?.forEach((title, index) => {
        if (knownTitles.has(normalizeKey(title))) return;
        const id = `${board.id}-trello-${columnKey}-${index + 1}`;
        cards.push({
          id,
          title,
          description: "",
          label: "",
          labelColor: LABEL_COLORS[0],
          dueDate: "",
          priority: "medium",
          checklistDone: 0,
          checklistTotal: 0,
        });
        targetByKey.get(columnKey)?.cardIds.push(id);
        knownTitles.add(normalizeKey(title));
      });
    });
  }

  return { ...board, columns, cards };
}

function migrateWorkspace(workspace: WorkspaceState): WorkspaceState {
  if (workspace.schemaVersion === WORKSPACE_SCHEMA_VERSION) {
    const boards = workspace.boards.map(ensureReviewColumn);
    const plannerNotes = { ...(workspace.plannerNotes ?? {}) };
    const plannerSlotColors = { ...(workspace.plannerSlotColors ?? {}) };
    const plannerWorkSlots = new Set(workspace.plannerWorkSlots ?? []);
    const diaryContent = workspace.diaryContent ?? "";
    const diaryPosts = workspace.diaryPosts?.length
      ? workspace.diaryPosts
      : diaryContent.trim()
        ? [{ id: "diary-legacy", content: diaryContent, createdAt: new Date().toISOString() }]
        : [];
    const seededWorkWeeks = new Set<string>();

    Object.entries(plannerNotes).forEach(([key, value]) => {
      if (!key.startsWith("week:") || normalizeKey(value) !== "trabalho") return;
      if (plannerSlotColors[key]?.toLocaleLowerCase() !== WORK_SLOT_COLOR) return;
      const [, day] = key.split(":");
      seededWorkWeeks.add(dateKey(startOfWeek(new Date(`${day}T12:00:00`))));
    });

    const workTimes = Array.from({ length: 17 }, (_, index) => {
      const minutes = index <= 8 ? 8 * 60 + index * 30 : 13 * 60 + 30 + (index - 9) * 30;
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    });
    seededWorkWeeks.forEach((weekStart) => {
      const monday = new Date(`${weekStart}T12:00:00`);
      Array.from({ length: 5 }, (_, index) => addDays(monday, index)).forEach((day) => {
        workTimes.forEach((time) => {
          const key = weekSlotKey(day, time);
          plannerWorkSlots.add(key);
          if (normalizeKey(plannerNotes[key] ?? "") === "trabalho") {
            delete plannerNotes[key];
            delete plannerSlotColors[key];
          }
        });
      });
    });

    return {
      ...workspace,
      boards,
      visibleBoardIds: Array.isArray(workspace.visibleBoardIds)
        ? workspace.visibleBoardIds.filter((id) => boards.some((board) => board.id === id))
        : boards.map((board) => board.id),
      plannerNotes,
      plannerSlotColors,
      plannerWorkSlots: [...plannerWorkSlots],
      plannerActivities: workspace.plannerActivities ?? {},
      diaryContent,
      diaryPosts,
    };
  }

  const boards = [...workspace.boards];
  if (!boards.some((board) => normalizeKey(board.title) === "casa")) {
    const italyIndex = boards.findIndex((board) => normalizeKey(board.title) === "italia");
    boards.splice(italyIndex >= 0 ? italyIndex + 1 : boards.length, 0, createBlankBoard("casa", "Casa", "sand"));
  }

  const migratedBoards = boards.map(migrateBoard);
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    activeBoardId: boards.some((board) => board.id === workspace.activeBoardId) ? workspace.activeBoardId : boards[0].id,
    boards: migratedBoards,
    visibleBoardIds: migratedBoards.map((board) => board.id),
    plannerNotes: workspace.plannerNotes ?? {},
    plannerSlotColors: workspace.plannerSlotColors ?? {},
    plannerWorkSlots: workspace.plannerWorkSlots ?? [],
    plannerActivities: workspace.plannerActivities ?? {},
    diaryContent: workspace.diaryContent ?? "",
    diaryPosts: workspace.diaryPosts?.length
      ? workspace.diaryPosts
      : workspace.diaryContent?.trim()
        ? [{ id: "diary-legacy", content: workspace.diaryContent, createdAt: new Date().toISOString() }]
        : [],
  };
}

const DEFAULT_WORKSPACE = migrateWorkspace({
  schemaVersion: 0,
  activeBoardId: DEFAULT_BOARD.id,
  boards: [
    DEFAULT_BOARD,
    createBlankBoard("italia", "Itália", "ocean"),
    createBlankBoard("panvel", "Panvel", "lilac"),
    createBlankBoard("mestrado", "Mestrado", "midnight"),
  ],
  visibleBoardIds: [],
  plannerNotes: {},
  plannerSlotColors: {},
  plannerWorkSlots: [],
  plannerActivities: {},
  diaryContent: "",
  diaryPosts: [],
});

function getWorkspaceFromPayload(payload?: { workspace?: WorkspaceState; state?: Omit<BoardState, "id"> }) {
  if (payload?.workspace?.boards?.length) {
    const hasActiveBoard = payload.workspace.boards.some((board) => board.id === payload.workspace!.activeBoardId);
    return migrateWorkspace(hasActiveBoard
      ? payload.workspace
      : { ...payload.workspace, activeBoardId: payload.workspace.boards[0].id });
  }

  if (payload?.state) {
    const legacyBoard: BoardState = {
      ...payload.state,
      id: "pessoal",
      title: payload.state.title === "Meu espaço" ? "Pessoal" : payload.state.title,
    };
    return migrateWorkspace({
      schemaVersion: 0,
      activeBoardId: legacyBoard.id,
      boards: [legacyBoard, ...DEFAULT_WORKSPACE.boards.slice(1)],
      visibleBoardIds: [],
      plannerNotes: {},
      plannerSlotColors: {},
      plannerWorkSlots: [],
      plannerActivities: {},
      diaryContent: "",
      diaryPosts: [],
    });
  }

  return DEFAULT_WORKSPACE;
}

const THEME_OPTIONS: { id: Theme; name: string; colors: string[] }[] = [
  { id: "peach", name: "Pêssego pastel", colors: ["#f7e5dc", "#eeb9a7"] },
  { id: "lilac", name: "Lavanda pastel", colors: ["#eee9f8", "#bcb1df"] },
  { id: "ocean", name: "Menta pastel", colors: ["#e2f0ed", "#9bc9bd"] },
  { id: "rose", name: "Rosa pastel", colors: ["#f5e5ea", "#dca7b8"] },
  { id: "sage", name: "Sálvia pastel", colors: ["#e8eee5", "#aebfa7"] },
  { id: "sky", name: "Azul pastel", colors: ["#e5edf6", "#a9bdd5"] },
  { id: "sand", name: "Areia", colors: ["#f1ece3", "#cdbfa8"] },
  { id: "paper", name: "Preto e branco", colors: ["#ffffff", "#bfc3c9"] },
  { id: "graphite", name: "Grafite", colors: ["#d8dadd", "#454a52"] },
  { id: "midnight", name: "Preto", colors: ["#17191d", "#555b65"] },
];

const THEME_ACCENTS: Record<Theme, string> = {
  peach: "#e9ad99",
  lilac: "#afa1d8",
  ocean: "#8abfae",
  midnight: "#1d2025",
  rose: "#d9a1b3",
  sage: "#a8bda0",
  sky: "#9db5d0",
  sand: "#c7b79d",
  paper: "#f4f5f7",
  graphite: "#6d747e",
};

const THEME_SURFACES: Record<Theme, string> = {
  peach: "rgba(247, 215, 202, 0.32)",
  lilac: "rgba(214, 205, 239, 0.32)",
  ocean: "rgba(197, 229, 220, 0.3)",
  midnight: "rgba(0, 0, 0, 0.32)",
  rose: "rgba(238, 205, 216, 0.3)",
  sage: "rgba(211, 226, 205, 0.3)",
  sky: "rgba(204, 220, 238, 0.3)",
  sand: "rgba(232, 220, 200, 0.3)",
  paper: "rgba(255, 255, 255, 0.2)",
  graphite: "rgba(28, 31, 36, 0.24)",
};

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getInitials(user: User) {
  const source = user.displayName || user.email || "Vinello";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

function findColumnForCard(board: BoardState, cardId: string) {
  return board.columns.find((column) => column.cardIds.includes(cardId));
}

function hasCardDescription(description: string) {
  return description
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim().length > 0;
}

function SortableCard({
  card,
  onOpen,
}: {
  card: CardItem;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card" } });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const pointerMoved = useRef(false);
  const hasDescription = hasCardDescription(card.description);

  const style: CSSProperties = {
    transform: DndCSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${hasDescription ? "has-description" : ""} ${isDragging ? "is-dragging" : ""}`}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`${card.title}. Clique para abrir os detalhes ou arraste para mover.`}
      onPointerDownCapture={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
        pointerMoved.current = false;
      }}
      onPointerMoveCapture={(event) => {
        const start = pointerStart.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) {
          pointerMoved.current = true;
        }
      }}
      onClick={() => {
        pointerStart.current = null;
        if (pointerMoved.current) return;
        onOpen(card.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen(card.id);
          return;
        }
        listeners?.onKeyDown?.(event);
      }}
    >
      <h3>{card.title}</h3>
      {hasDescription && (
        <span className="card-description-indicator" title="Este cartão possui descrição" aria-label="Possui descrição">
          <FileText size={12} />
        </span>
      )}
      <button
        type="button"
        className="card-detail-button"
        aria-label={`Abrir detalhes de ${card.title}`}
        title="Editar descrição e atividades"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onOpen(card.id); }}
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}

function CardGhost({ card }: { card: CardItem }) {
  const hasDescription = hasCardDescription(card.description);
  return (
    <article className={`task-card card-ghost ${hasDescription ? "has-description" : ""}`}>
      <h3>{card.title}</h3>
      {hasDescription && <span className="card-description-indicator"><FileText size={12} /></span>}
    </article>
  );
}

function BoardColumn({
  column,
  cards,
  onAdd,
  onOpenCard,
  onEditColumn,
}: {
  column: ColumnItem;
  cards: CardItem[];
  onAdd: (columnId: string) => void;
  onOpenCard: (id: string) => void;
  onEditColumn: (columnId: string) => void;
}) {
  const { setNodeRef: setCardDropRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "card-column", columnId: column.id },
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `sortable-column-${column.id}`,
    data: { type: "column", columnId: column.id },
  });
  const style = {
    "--column-accent": column.color,
    transform: DndCSS.Transform.toString(transform),
    transition,
  } as CSSProperties;

  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver ? "column-over" : ""} ${isDragging ? "column-dragging" : ""}`}
      style={style}
    >
      <div className="column-accent" />
      <header
        className="column-header column-drag-handle"
        title="Segure e arraste para reordenar a coluna"
        {...attributes}
        {...listeners}
        aria-label={`Mover coluna ${column.title}`}
      >
        <div>
          <GripVertical className="column-drag-icon" size={13} aria-hidden="true" />
          <h2>{column.title}</h2>
          <span>{cards.length.toString().padStart(2, "0")}</span>
        </div>
        <button
          type="button"
          className="icon-button subtle"
          aria-label={`Editar coluna ${column.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={() => onEditColumn(column.id)}
        >
          <MoreHorizontal size={19} />
        </button>
      </header>

      <div ref={setCardDropRef} className="card-list">
        <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onOpen={onOpenCard} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <button type="button" className="empty-column" onClick={() => onAdd(column.id)}>
            Solte um cartão aqui
          </button>
        )}
      </div>

      <button type="button" className="add-card-button" onClick={() => onAdd(column.id)}>
        <Plus size={17} />
        Adicionar cartão
      </button>
    </section>
  );
}

function SortableDesktop({
  project,
  onCustomize,
  children,
}: {
  project: BoardState;
  onCustomize: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `desktop-${project.id}`,
    data: { type: "desktop", boardId: project.id },
  });
  const style: CSSProperties = {
    "--desktop-accent": THEME_ACCENTS[project.theme],
    "--desktop-surface": THEME_SURFACES[project.theme],
    transform: DndCSS.Transform.toString(transform),
    transition,
  } as CSSProperties;

  return (
    <section ref={setNodeRef} className={`desktop-board ${isDragging ? "desktop-dragging" : ""}`} style={style}>
      <header className="desktop-title-bar">
        <button type="button" className="desktop-drag-handle" aria-label={`Mover desktop ${project.title}`} title="Segure e arraste para reordenar" {...attributes} {...listeners}><GripVertical size={16} /></button>
        <h1>{project.title}</h1>
        <button type="button" className="desktop-settings-button" aria-label={`Personalizar desktop ${project.title}`} title="Personalizar desktop" onClick={onCustomize}><SlidersHorizontal size={15} /></button>
      </header>
      {children}
    </section>
  );
}

type CardDraft = Omit<CardItem, "id"> & { columnId: string };

type CopiedTextFormat = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  block: string;
  foreground: string;
  background: string;
  alignment: "justifyLeft" | "justifyCenter" | "justifyRight" | "justifyFull";
};

type RichListCommand = "insertUnorderedList" | "insertOrderedList";

function getEditingBlock(editor: HTMLDivElement, range: Range) {
  const container = range.startContainer;
  const parentElement = container instanceof Element ? container : container.parentElement;
  const block = parentElement?.closest("li, p, div, h2, blockquote");

  if (block && block !== editor && editor.contains(block)) return block;
  if (container.nodeType === Node.TEXT_NODE && container.parentNode === editor) return container;
  return editor;
}

function getTextBeforeCaret(editor: HTMLDivElement, range: Range) {
  const block = getEditingBlock(editor, range);
  const beforeCaret = range.cloneRange();
  beforeCaret.setStart(block, 0);
  return beforeCaret.toString().replace(/\u00a0/g, " ");
}

function removeTextBeforeCaret(editor: HTMLDivElement, range: Range) {
  const block = getEditingBlock(editor, range);
  const markerRange = range.cloneRange();
  markerRange.setStart(block, 0);
  markerRange.deleteContents();

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function listCommandForMarker(marker: string): RichListCommand | null {
  if (marker === "-" || marker === "*") return "insertUnorderedList";
  if (/^\d+[.)]$/.test(marker)) return "insertOrderedList";
  return null;
}

function RichTextEditor({
  value,
  onChange,
  ariaLabel = "Descrição do cartão",
  placeholder = "Escreva a descrição, links, listas ou observações…",
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  compact?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const copiedFormatRef = useRef<CopiedTextFormat | null>(null);
  const [formatPainterActive, setFormatPainterActive] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    const selection = window.getSelection();
    if (!selection || !selectionRef.current) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  }

  function syncValue() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    const parentElement = range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
    const listItem = parentElement?.closest("li");

    if (event.key === "Tab" && listItem && editor.contains(listItem)) {
      event.preventDefault();
      document.execCommand(event.shiftKey || event.metaKey ? "outdent" : "indent", false);
      rememberSelection();
      syncValue();
      return;
    }

    if (event.key !== " " || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || listItem) return;

    const command = listCommandForMarker(getTextBeforeCaret(editor, range));
    if (!command) return;

    event.preventDefault();
    removeTextBeforeCaret(editor, range);
    document.execCommand(command, false);
    rememberSelection();
    syncValue();
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, commandValue);
    rememberSelection();
    syncValue();
  }

  function toggleFormatPainter() {
    if (formatPainterActive) {
      copiedFormatRef.current = null;
      setFormatPainterActive(false);
      return;
    }

    restoreSelection();
    const alignment = document.queryCommandState("justifyCenter")
      ? "justifyCenter"
      : document.queryCommandState("justifyRight")
        ? "justifyRight"
        : document.queryCommandState("justifyFull")
          ? "justifyFull"
          : "justifyLeft";
    copiedFormatRef.current = {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      block: document.queryCommandValue("formatBlock"),
      foreground: document.queryCommandValue("foreColor"),
      background: document.queryCommandValue("hiliteColor") || document.queryCommandValue("backColor"),
      alignment,
    };
    setFormatPainterActive(true);
  }

  function applyCopiedFormat() {
    const editor = editorRef.current;
    const format = copiedFormatRef.current;
    const selection = window.getSelection();
    if (!editor || !format || !selection?.rangeCount || selection.isCollapsed || !editor.contains(selection.anchorNode)) {
      rememberSelection();
      return;
    }

    document.execCommand("removeFormat", false);
    if (format.block) document.execCommand("formatBlock", false, format.block);
    if (format.bold) document.execCommand("bold", false);
    if (format.italic) document.execCommand("italic", false);
    if (format.underline) document.execCommand("underline", false);
    if (format.strikeThrough) document.execCommand("strikeThrough", false);
    if (format.foreground) document.execCommand("foreColor", false, format.foreground);
    if (format.background && format.background !== "transparent") {
      document.execCommand("hiliteColor", false, format.background);
    }
    document.execCommand(format.alignment, false);
    copiedFormatRef.current = null;
    setFormatPainterActive(false);
    rememberSelection();
    syncValue();
  }

  function toolbarButton(label: string, icon: ReactNode, command: string, commandValue?: string) {
    return (
      <button type="button" aria-label={label} title={label} onMouseDown={(event) => { event.preventDefault(); runCommand(command, commandValue); }}>
        {icon}
      </button>
    );
  }

  return (
    <div className={`rich-editor-shell ${compact ? "rich-editor-compact" : ""}`}>
      <div className="rich-editor-toolbar" aria-label="Ferramentas de formatação">
        <select
          aria-label="Formato do texto"
          defaultValue="p"
          onPointerDown={rememberSelection}
          onChange={(event) => runCommand("formatBlock", event.target.value)}
        >
          <option value="p">Texto</option>
          <option value="h2">Título</option>
          <option value="blockquote">Citação</option>
        </select>
        <span className="toolbar-divider" />
        {toolbarButton("Negrito", <Bold size={15} />, "bold")}
        {toolbarButton("Itálico", <Italic size={15} />, "italic")}
        {toolbarButton("Sublinhado", <Underline size={15} />, "underline")}
        {toolbarButton("Tachado", <Strikethrough size={15} />, "strikeThrough")}
        <label className="rich-color-tool" title="Cor do texto">
          <span>A</span><input type="color" defaultValue="#303238" onChange={(event) => runCommand("foreColor", event.target.value)} aria-label="Cor do texto" />
        </label>
        <label className="rich-color-tool" title="Cor de fundo do texto">
          <Highlighter size={15} /><input type="color" defaultValue="#fff0a8" onChange={(event) => runCommand("hiliteColor", event.target.value)} aria-label="Cor de fundo do texto" />
        </label>
        <span className="toolbar-divider" />
        {toolbarButton("Alinhar à esquerda", <AlignLeft size={15} />, "justifyLeft")}
        {toolbarButton("Centralizar", <AlignCenter size={15} />, "justifyCenter")}
        {toolbarButton("Alinhar à direita", <AlignRight size={15} />, "justifyRight")}
        <span className="toolbar-divider" />
        {toolbarButton("Lista com marcadores", <List size={16} />, "insertUnorderedList")}
        {toolbarButton("Lista numerada", <ListOrdered size={16} />, "insertOrderedList")}
        {toolbarButton("Checklist", <ListChecks size={16} />, "insertHTML", '<div class="rich-check-item"><input type="checkbox"> <span>Item da lista</span></div><div><br></div>')}
        <span className="toolbar-divider" />
        <button
          type="button"
          className={formatPainterActive ? "is-active" : ""}
          aria-label={formatPainterActive ? "Cancelar pincel de formatação" : "Copiar formatação"}
          aria-pressed={formatPainterActive}
          title={formatPainterActive ? "Selecione o texto que receberá a formatação" : "Pincel de formatação: copie o estilo do texto selecionado"}
          onMouseDown={(event) => {
            event.preventDefault();
            rememberSelection();
            toggleFormatPainter();
          }}
        >
          <Paintbrush size={15} />
        </button>
      </div>
      <div
        ref={editorRef}
        className={`rich-description-editor ${formatPainterActive ? "is-format-painting" : ""}`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={syncValue}
        onKeyDown={handleEditorKeyDown}
        onKeyUp={rememberSelection}
        onMouseUp={applyCopiedFormat}
        onFocus={rememberSelection}
        onClick={(event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement && target.type === "checkbox") {
            if (target.checked) target.setAttribute("checked", "");
            else target.removeAttribute("checked");
            window.requestAnimationFrame(syncValue);
          }
        }}
        aria-label={ariaLabel}
      />
    </div>
  );
}

function hasRichText(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim().length > 0;
}

type DiaryComposerMode = "free" | "work";

type WorkDiaryDraft = {
  projectStage: string;
  insights: string;
  nextSteps: string;
};

const EMPTY_WORK_DIARY_DRAFT: WorkDiaryDraft = {
  projectStage: "",
  insights: "",
  nextSteps: "",
};

function hasWorkDiaryContent(draft: WorkDiaryDraft) {
  return Object.values(draft).some(hasRichText);
}

function buildWorkDiaryContent(draft: WorkDiaryDraft) {
  const field = (title: string, value: string) => `<h2>${title}:</h2>${hasRichText(value) ? value : "<p><br></p>"}`;
  return `<div class="diary-work-entry">${field("Etapa do projeto trabalhada", draft.projectStage)}${field("Insights gerados", draft.insights)}${field("Próximos passos", draft.nextSteps)}</div>`;
}

function DiaryWorkspace({
  posts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  posts: DiaryPost[];
  onAdd: (content: string) => void;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [composerMode, setComposerMode] = useState<DiaryComposerMode>("free");
  const [draft, setDraft] = useState("");
  const [workDraft, setWorkDraft] = useState<WorkDiaryDraft>({ ...EMPTY_WORK_DIARY_DRAFT });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const canPublish = composerMode === "free" ? hasRichText(draft) : hasWorkDiaryContent(workDraft);

  function publishPost() {
    if (!canPublish) return;
    if (composerMode === "free") {
      onAdd(draft);
      setDraft("");
    } else {
      onAdd(buildWorkDiaryContent(workDraft));
      setWorkDraft({ ...EMPTY_WORK_DIARY_DRAFT });
    }
  }

  function startEditing(post: DiaryPost) {
    setEditingId(post.id);
    setEditingContent(post.content);
  }

  function saveEditing() {
    if (!editingId || !hasRichText(editingContent)) return;
    onUpdate(editingId, editingContent);
    setEditingId(null);
    setEditingContent("");
  }

  return (
    <section className="diary-workspace">
      <header className="diary-heading">
        <div className="diary-icon"><FileText size={20} /></div>
        <div>
          <h1>Diário</h1>
          <p>Publique atualizações rápidas e edite conforme o dia avança.</p>
        </div>
      </header>

      <section className="diary-composer" aria-label="Nova postagem do diário">
        <div className="diary-composer-modes" role="tablist" aria-label="Formato da postagem">
          <button type="button" role="tab" aria-selected={composerMode === "free"} className={composerMode === "free" ? "active" : ""} onClick={() => setComposerMode("free")}>Livre</button>
          <button type="button" role="tab" aria-selected={composerMode === "work"} className={composerMode === "work" ? "active" : ""} onClick={() => setComposerMode("work")}>Trabalho</button>
        </div>

        {composerMode === "free" ? (
          <div role="tabpanel" aria-label="Postagem livre">
            <RichTextEditor
              value={draft}
              onChange={setDraft}
              ariaLabel="Conteúdo da nova postagem"
              placeholder="O que você fez ou está fazendo agora?"
            />
          </div>
        ) : (
          <div className="diary-work-template" role="tabpanel" aria-label="Postagem de trabalho">
            <section className="diary-work-field">
              <span>Etapa do projeto trabalhada:</span>
              <RichTextEditor compact value={workDraft.projectStage} onChange={(projectStage) => setWorkDraft((current) => ({ ...current, projectStage }))} ariaLabel="Etapa do projeto trabalhada" placeholder="Em qual etapa você trabalhou?" />
            </section>
            <section className="diary-work-field">
              <span>Insights gerados:</span>
              <RichTextEditor compact value={workDraft.insights} onChange={(insights) => setWorkDraft((current) => ({ ...current, insights }))} ariaLabel="Insights gerados" placeholder="O que você descobriu ou aprendeu?" />
            </section>
            <section className="diary-work-field">
              <span>Próximos passos:</span>
              <RichTextEditor compact value={workDraft.nextSteps} onChange={(nextSteps) => setWorkDraft((current) => ({ ...current, nextSteps }))} ariaLabel="Próximos passos" placeholder="O que precisa acontecer depois?" />
            </section>
          </div>
        )}
        <div className="diary-composer-actions">
          <small>Salvo automaticamente depois de publicar</small>
          <button type="button" className="primary-button" disabled={!canPublish} onClick={publishPost}>Publicar</button>
        </div>
      </section>

      <div className="diary-feed" aria-label="Postagens do diário">
        {[...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((post) => {
          const postDate = formatDiaryPostDate(post.createdAt);
          return (
            <article key={post.id} className="diary-post">
              <header>
                <div className="diary-post-meta">
                  <time dateTime={post.createdAt}>
                    <span className="diary-post-date-label">{postDate.date}</span>
                    {postDate.weekday && <span className="diary-post-weekday">{postDate.weekday}</span>}
                  </time>
                  {post.updatedAt && <small>editado {formatActivityDate(post.updatedAt)}</small>}
                </div>
                <div className="diary-post-actions">
                  <button type="button" aria-label="Editar postagem" title="Editar postagem" onClick={() => startEditing(post)}><Pencil size={14} /></button>
                  <button type="button" aria-label="Excluir postagem" title="Excluir postagem" onClick={() => { if (window.confirm("Excluir esta postagem do diário?")) onDelete(post.id); }}><Trash2 size={14} /></button>
                </div>
              </header>

              {editingId === post.id ? (
                <div className="diary-post-editor">
                  <RichTextEditor value={editingContent} onChange={setEditingContent} ariaLabel="Editar postagem do diário" placeholder="Atualize sua postagem…" />
                  <div className="diary-post-editor-actions">
                    <button type="button" className="text-button" onClick={() => { setEditingId(null); setEditingContent(""); }}>Cancelar</button>
                    <button type="button" className="primary-button" disabled={!hasRichText(editingContent)} onClick={saveEditing}>Salvar alterações</button>
                  </div>
                </div>
              ) : (
                <div className="diary-post-content" dangerouslySetInnerHTML={{ __html: post.content }} />
              )}
            </article>
          );
        })}
        {!posts.length && (
          <div className="diary-empty">
            <FileText size={21} />
            <strong>Nenhuma postagem ainda</strong>
            <p>Use o editor acima para registrar sua primeira atualização.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDiaryPostDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Agora", weekday: "" };

  const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date);
  const month = capitalize(new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date));
  const year = new Intl.DateTimeFormat("pt-BR", { year: "numeric" }).format(date);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" })
    .format(date)
    .split("-")
    .map(capitalize)
    .join(" ");

  return { date: `${day} de ${month} de ${year}`, weekday };
}

function CardModal({
  card,
  columnId,
  onClose,
  onSave,
  onDelete,
}: {
  card?: CardItem;
  columnId: string;
  onClose: () => void;
  onSave: (draft: CardDraft) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<CardDraft>({
    title: card?.title ?? "",
    description: card?.description ?? "",
    label: card?.label ?? "",
    labelColor: card?.labelColor ?? LABEL_COLORS[0],
    dueDate: card?.dueDate ?? "",
    priority: card?.priority ?? "medium",
    checklistDone: card?.checklistDone ?? 0,
    checklistTotal: card?.checklistTotal ?? 0,
    activity: card?.activity ?? [],
    columnId,
  });
  const [activityText, setActivityText] = useState("");

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() });
  }

  function addActivity() {
    const text = activityText.trim();
    if (!text) return;
    setDraft((current) => ({
      ...current,
      activity: [...(current.activity ?? []), { id: makeId("activity"), text, createdAt: new Date().toISOString() }],
    }));
    setActivityText("");
  }

  return (
    <div className="modal-backdrop card-drawer-backdrop">
      <button type="button" className="backdrop-dismiss" aria-label="Fechar editor do cartão" onClick={onClose} />
      <aside
        className="card-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
      >
        <div className="card-drawer-heading">
          <h2 id="card-modal-title">{card ? "Detalhes do cartão" : "Novo cartão"}</h2>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form className="card-drawer-form" onSubmit={handleSubmit}>
          <div className="card-drawer-content">
            <label className="field card-title-field">
              <span>Título</span>
              <textarea
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                placeholder="Ex.: Planejar a próxima semana"
                rows={2}
                required
              />
            </label>

            <section className="description-section">
              <div className="drawer-section-heading"><span>Descrição</span><small>Formatação completa</small></div>
              <RichTextEditor value={draft.description} onChange={(description) => setDraft((current) => ({ ...current, description }))} />
            </section>

            <section className="activity-journal">
              <div className="drawer-section-heading"><span>Diário de atividades</span><small>{draft.activity?.length ?? 0} registros</small></div>
              <div className="activity-composer">
                <textarea value={activityText} onChange={(event) => setActivityText(event.target.value)} placeholder="Atualização rápida…" rows={2} />
                <button type="button" className="primary-button" disabled={!activityText.trim()} onClick={addActivity}>Adicionar registro</button>
              </div>
              <div className="activity-list">
                {[...(draft.activity ?? [])].reverse().map((entry) => (
                  <article key={entry.id}>
                    <div><time>{formatActivityDate(entry.createdAt)}</time><button type="button" aria-label="Excluir registro" onClick={() => setDraft((current) => ({ ...current, activity: current.activity?.filter((item) => item.id !== entry.id) }))}><Trash2 size={13} /></button></div>
                    <p>{entry.text}</p>
                  </article>
                ))}
                {!draft.activity?.length && <p className="activity-empty">Nenhum registro ainda. Use este espaço como um diário do cartão.</p>}
              </div>
            </section>
          </div>

          <div className="card-drawer-actions">
            {card && onDelete && <button type="button" className="danger-button" onClick={onDelete}><Trash2 size={16} /> Excluir</button>}
            <span className="modal-spacer" />
            <button type="button" className="text-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button">{card ? "Salvar" : "Criar cartão"}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function ColumnModal({
  column,
  canDelete,
  onClose,
  onSave,
  onDelete,
}: {
  column?: ColumnItem;
  canDelete: boolean;
  onClose: () => void;
  onSave: (title: string, color: string) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(column?.title ?? "");
  const [color, setColor] = useState(column?.color ?? COLUMN_COLORS[0]);

  return (
    <div className="modal-backdrop">
      <button type="button" className="backdrop-dismiss" aria-label="Fechar editor da coluna" onClick={onClose} />
      <section className="modal-card column-editor" role="dialog" aria-modal="true" aria-labelledby="column-modal-title">
        <div className="modal-heading">
          <div className="modal-icon"><Columns3 size={19} /></div>
          <div><span>{column ? "Personalizar coluna" : "Nova coluna"}</span><h2 id="column-modal-title">{column ? column.title : "Crie uma nova etapa"}</h2></div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (title.trim()) onSave(title.trim(), color); }}>
          <label className="field full-field"><span>Nome da coluna</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Aguardando" required /></label>
          <fieldset className="color-fieldset"><legend>Cor de destaque</legend><div className="color-row">
            {COLUMN_COLORS.map((choice) => <button key={choice} type="button" className={`color-choice ${color === choice ? "selected" : ""}`} style={{ background: choice }} aria-label={`Escolher cor ${choice}`} onClick={() => setColor(choice)}>{color === choice && <Check size={15} />}</button>)}
          </div></fieldset>
          <div className="modal-actions">
            {column && onDelete && <button type="button" className="danger-button" disabled={!canDelete} onClick={onDelete}><Trash2 size={16} /> Excluir coluna</button>}
            <span className="modal-spacer" />
            <button type="button" className="text-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button">{column ? "Salvar" : "Adicionar"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProjectModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <div className="modal-backdrop">
      <button type="button" className="backdrop-dismiss" aria-label="Fechar novo projeto" onClick={onClose} />
      <section className="modal-card project-editor" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
        <div className="modal-heading">
          <div className="modal-icon"><LayoutDashboard size={19} /></div>
          <div><span>Novo desktop</span><h2 id="project-modal-title">Criar um desktop</h2></div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (title.trim()) onSave(title.trim()); }}>
          <label className="field full-field">
            <span>Nome do desktop</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Casa, Viagem ou Trabalho" required />
          </label>
          <p className="project-editor-note">O novo desktop começa com as sete listas padrão e fica totalmente separado dos outros.</p>
          <div className="modal-actions">
            <span className="modal-spacer" />
            <button type="button" className="text-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button">Criar desktop</button>
          </div>
        </form>
      </section>
    </div>
  );
}

type PlanningMode = "week" | "month" | "year";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const WEEK_TIME_SLOTS = Array.from({ length: 35 }, (_, index) => {
  const minutes = 6 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}

function monthCells(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const trailing = (7 - ((offset + days) % 7)) % 7;
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1)),
    ...Array.from({ length: trailing }, () => null),
  ];
}

function weekSlotKey(date: Date, time: string) {
  return `week:${dateKey(date)}:${time}`;
}

function parseWeekSlotKey(key: string) {
  const match = key.match(/^week:(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2})$/);
  return match ? { day: match[1], time: match[2] } : null;
}

type SelectionKind = "primary" | "work" | "activity";

function selectionId(kind: SelectionKind, value: string) {
  return `${kind}:${value}`;
}

function parseSelectionId(id: string) {
  const separator = id.indexOf(":");
  return { kind: id.slice(0, separator) as SelectionKind, value: id.slice(separator + 1) };
}

function selectionValues(selection: Set<string>, kind: SelectionKind) {
  return [...selection]
    .map(parseSelectionId)
    .filter((entry) => entry.kind === kind)
    .map((entry) => entry.value);
}

function isSelectionModifier(event: { metaKey: boolean; ctrlKey: boolean }) {
  return event.metaKey || event.ctrlKey;
}

function WeeklySlot({
  slotKey,
  value,
  color,
  hasWork,
  activities,
  selection,
  isFullHour,
  inputRef,
  onChange,
  onChangeColor,
  onToggleSelection,
  onPaste,
  onCopy,
  onKeyDown,
  onOpenContextMenu,
  onDropPlannerCard,
  ariaLabel,
}: {
  slotKey: string;
  value: string;
  color: string;
  hasWork: boolean;
  activities: PlannerActivity[];
  selection: Set<string>;
  isFullHour: boolean;
  inputRef: (node: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
  onChangeColor: (color: string) => void;
  onToggleSelection: (kind: SelectionKind, value: string) => void;
  onPaste: (event: ReactClipboardEvent<HTMLInputElement>) => void;
  onCopy: (event: ReactClipboardEvent<HTMLInputElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onOpenContextMenu: (event: ReactMouseEvent, kind: "primary" | "work" | "activity", activityId?: string) => void;
  onDropPlannerCard: (payload: PlannerDragPayload) => void;
  ariaLabel: string;
}) {
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const [isTemplateOver, setIsTemplateOver] = useState(false);
  const primarySelected = selection.has(selectionId("primary", slotKey));
  const workSelected = selection.has(selectionId("work", slotKey));
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `week-slot-${slotKey}`,
    data: { type: "week-slot", slotKey },
  });
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: `week-card-${slotKey}`,
    data: { type: "week-card", slotKey },
    disabled: !value,
  });
  const cardStyle = {
    "--slot-color": color,
    transform: DndCSS.Translate.toString(transform),
  } as CSSProperties;

  function readPlannerDrag(event: ReactDragEvent) {
    const raw = event.dataTransfer.getData(PLANNER_DRAG_MIME);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlannerDragPayload;
    } catch {
      return null;
    }
  }

  return (
    <div
      ref={setDroppableRef}
      className={`week-slot ${isFullHour ? "is-full-hour" : ""} ${isOver ? "is-over" : ""} ${isTemplateOver ? "is-template-over" : ""}`}
      role="gridcell"
      tabIndex={-1}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(PLANNER_DRAG_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === "move" ? "move" : "copy";
        setIsTemplateOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsTemplateOver(false);
      }}
      onDrop={(event) => {
        const payload = readPlannerDrag(event);
        if (!payload) return;
        event.preventDefault();
        setIsTemplateOver(false);
        onDropPlannerCard(payload);
      }}
    >
      <div className={`week-slot-items ${value ? "has-primary" : ""} ${hasWork || activities.length > 0 ? "has-overlay" : ""}`}>
        <div
          ref={setDraggableRef}
          className={`week-slot-card ${value ? "has-value" : ""} ${primarySelected ? "is-selected" : ""} ${isDragging ? "is-dragging" : ""}`}
          style={cardStyle}
          data-selection-id={selectionId("primary", slotKey)}
          onContextMenu={(event) => {
            if (value) onOpenContextMenu(event, "primary");
          }}
        >
          <input
            ref={(node) => {
              primaryInputRef.current = node;
              inputRef(node);
            }}
            value={value}
            title={value}
            onChange={(event) => onChange(event.target.value)}
            onPaste={onPaste}
            onCopy={onCopy}
            onKeyDown={onKeyDown}
            aria-label={ariaLabel}
          />
          {value && (
            <div className="week-card-tools">
              <button type="button" className={`week-card-select ${primarySelected ? "is-selected" : ""}`} aria-label={primarySelected ? "Remover da seleção" : "Adicionar à seleção"} aria-pressed={primarySelected} title="Selecionar compromisso — ou ⌘ + clique no card" onPointerDown={(event) => event.stopPropagation()} onClick={() => onToggleSelection("primary", slotKey)}>{primarySelected && <Check size={11} />}</button>
              <button type="button" className="week-card-drag" aria-label="Arrastar compromisso" title="Arrastar para outro horário" {...attributes} {...listeners}><GripVertical size={13} /></button>
              <label className="week-card-color" title="Cor do compromisso" onPointerDown={(event) => event.stopPropagation()}>
                <span style={{ background: color }} />
                <input type="color" value={color} onChange={(event) => onChangeColor(event.target.value)} aria-label="Escolher cor do compromisso" />
              </label>
            </div>
          )}
        </div>
        {hasWork && (
          <button
            type="button"
            className={`week-work-card ${workSelected ? "is-selected" : ""}`}
            aria-pressed={workSelected}
            data-selection-id={selectionId("work", slotKey)}
            title="Trabalho — ⌘ + clique ou ⌘ + arraste para selecionar, botão direito para opções"
            onClick={(event) => {
              if (isSelectionModifier(event)) return;
              primaryInputRef.current?.focus();
            }}
            onContextMenu={(event) => onOpenContextMenu(event, "work")}
          >
            Trabalho
          </button>
        )}
        {activities.map((activity) => (
          <button
            key={activity.id}
            type="button"
            className={`week-activity-card ${selection.has(selectionId("activity", activity.id)) ? "is-selected" : ""}`}
            aria-pressed={selection.has(selectionId("activity", activity.id))}
            style={{ "--activity-color": activity.color } as CSSProperties}
            data-selection-id={selectionId("activity", activity.id)}
            title={`${activity.title} — arraste para mover, ⌘ + clique ou ⌘ + arraste para selecionar`}
            draggable
            onClick={(event) => {
              if (isSelectionModifier(event)) return;
              primaryInputRef.current?.focus();
            }}
            onDragStart={(event) => {
              const payload: PlannerDragPayload = { mode: "move", activityId: activity.id, sourceKey: slotKey };
              event.dataTransfer.setData(PLANNER_DRAG_MIME, JSON.stringify(payload));
              event.dataTransfer.effectAllowed = "move";
            }}
            onContextMenu={(event) => onOpenContextMenu(event, "activity", activity.id)}
          >
            {activity.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function WeeklyPlannerGrid({
  days,
  notes,
  colors,
  workSlots,
  activities,
  bulkSlot,
  onChangeNote,
  onChangeNotes,
  onChangeColors,
  onMoveSlot,
  onMoveSlots,
  onRemoveWorkSlot,
  onAddActivity,
  onMoveActivity,
  onRemoveActivity,
}: {
  days: Date[];
  notes: Record<string, string>;
  colors: Record<string, string>;
  workSlots: string[];
  activities: Record<string, PlannerActivity[]>;
  bulkSlot: HTMLElement | null;
  onChangeNote: (key: string, value: string) => void;
  onChangeNotes: (keys: string[], value: string) => void;
  onChangeColors: (keys: string[], color: string) => void;
  onMoveSlot: (sourceKey: string, targetKey: string) => void;
  onMoveSlots: (moves: { sourceKey: string; targetKey: string }[]) => void;
  onRemoveWorkSlot: (key: string) => void;
  onAddActivity: (keys: string[], title: string, color: string) => void;
  onMoveActivity: (activityId: string, sourceKey: string, targetKey: string) => void;
  onRemoveActivity: (activityId: string) => void;
}) {
  const cellRefs = useRef(new Map<string, HTMLInputElement>());
  const gridRef = useRef<HTMLDivElement | null>(null);
  const marqueeDragRef = useRef<{ x: number; y: number; snapshot: Set<string>; moved: boolean } | null>(null);
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [fillText, setFillText] = useState("");
  const marqueeActive = marquee !== null;
  const [contextMenu, setContextMenu] = useState<{ slotKey: string; kind: SelectionKind; activityId?: string; x: number; y: number } | null>(null);
  const workSlotSet = useMemo(() => new Set(workSlots), [workSlots]);
  const today = dateKey(new Date());
  const selectedPrimaryKeys = useMemo(() => selectionValues(selection, "primary"), [selection]);
  const scheduleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  );

  const deleteSelection = useCallback(() => {
    const primaryKeys = selectionValues(selection, "primary");
    primaryKeys.forEach((key) => onChangeNote(key, ""));
    if (primaryKeys.length) onChangeColors(primaryKeys, "#ffffff");
    selectionValues(selection, "work").forEach(onRemoveWorkSlot);
    selectionValues(selection, "activity").forEach(onRemoveActivity);
    setSelection(new Set());
    setContextMenu(null);
  }, [onChangeColors, onChangeNote, onRemoveActivity, onRemoveWorkSlot, selection]);

  function fillSelectedCells() {
    const text = fillText.trim();
    if (!text || !selectedPrimaryKeys.length) return;
    onChangeNotes(selectedPrimaryKeys, text);
    setFillText("");
  }

  function toggleSelectionId(id: string) {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelection(kind: SelectionKind, value: string) {
    toggleSelectionId(selectionId(kind, value));
  }

  function startMarquee(event: ReactPointerEvent<HTMLDivElement>) {
    const grid = gridRef.current;
    if (!grid || event.button !== 0 || !isSelectionModifier(event)) return;
    event.preventDefault();
    const rect = grid.getBoundingClientRect();
    const origin = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    marqueeDragRef.current = { ...origin, snapshot: new Set(selection), moved: false };
    setMarquee({ left: origin.x, top: origin.y, width: 0, height: 0 });
  }

  useEffect(() => {
    if (!marqueeActive) return;

    function applyMarquee(event: PointerEvent, keepVisible: boolean) {
      const drag = marqueeDragRef.current;
      const grid = gridRef.current;
      if (!drag || !grid) return false;
      const gridRect = grid.getBoundingClientRect();
      const x = event.clientX - gridRect.left;
      const y = event.clientY - gridRect.top;
      const box = {
        left: Math.min(drag.x, x),
        top: Math.min(drag.y, y),
        width: Math.abs(x - drag.x),
        height: Math.abs(y - drag.y),
      };
      if (keepVisible) setMarquee(box);
      if (!drag.moved && Math.max(box.width, box.height) <= 4) return false;
      drag.moved = true;

      const next = new Set(drag.snapshot);
      grid.querySelectorAll<HTMLElement>("[data-selection-id]").forEach((node) => {
        const id = node.dataset.selectionId;
        if (!id) return;
        const nodeRect = node.getBoundingClientRect();
        if (!nodeRect.width || !nodeRect.height) return;
        const nodeLeft = nodeRect.left - gridRect.left;
        const nodeTop = nodeRect.top - gridRect.top;
        const overlapsX = nodeLeft <= box.left + box.width && nodeLeft + nodeRect.width >= box.left;
        const overlapsY = nodeTop <= box.top + box.height && nodeTop + nodeRect.height >= box.top;
        if (overlapsX && overlapsY) next.add(id);
      });
      setSelection(next);
      return true;
    }

    function handleMarqueeMove(event: PointerEvent) {
      applyMarquee(event, true);
    }

    function handleMarqueeEnd(event: PointerEvent) {
      // O último pointermove pode ficar atrás do ponto onde o mouse foi solto, então
      // a seleção é recalculada aqui com a posição final antes de encerrar o laço.
      const dragged = applyMarquee(event, false);
      const drag = marqueeDragRef.current;
      marqueeDragRef.current = null;
      setMarquee(null);
      if (!drag || dragged || drag.moved) return;
      const node = document.elementFromPoint(event.clientX, event.clientY);
      const card = node instanceof Element ? node.closest<HTMLElement>("[data-selection-id]") : null;
      if (card?.dataset.selectionId) toggleSelectionId(card.dataset.selectionId);
    }

    window.addEventListener("pointermove", handleMarqueeMove);
    window.addEventListener("pointerup", handleMarqueeEnd);
    window.addEventListener("pointercancel", handleMarqueeEnd);
    return () => {
      window.removeEventListener("pointermove", handleMarqueeMove);
      window.removeEventListener("pointerup", handleMarqueeEnd);
      window.removeEventListener("pointercancel", handleMarqueeEnd);
    };
  }, [marqueeActive]);

  useEffect(() => {
    function handleSelectionKeys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelection((current) => current.size > 0 ? new Set() : current);
        setContextMenu(null);
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
      if (!selection.size) return;
      event.preventDefault();
      deleteSelection();
    }

    window.addEventListener("keydown", handleSelectionKeys);
    return () => window.removeEventListener("keydown", handleSelectionKeys);
  }, [deleteSelection, selection]);

  function focusCell(row: number, column: number) {
    const boundedRow = Math.max(0, Math.min(WEEK_TIME_SLOTS.length - 1, row));
    const boundedColumn = Math.max(0, Math.min(days.length - 1, column));
    const key = weekSlotKey(days[boundedColumn], WEEK_TIME_SLOTS[boundedRow]);
    cellRefs.current.get(key)?.focus();
  }

  function handlePaste(event: ReactClipboardEvent<HTMLInputElement>, startRow: number, startColumn: number) {
    const clipboardText = event.clipboardData.getData("text/plain").replace(/\r/g, "");
    const rows = clipboardText.split("\n");
    if (rows.length > 1 && rows.at(-1) === "") rows.pop();
    event.preventDefault();

    let lastRow = startRow;
    let lastColumn = startColumn;
    rows.forEach((row, rowOffset) => {
      row.split("\t").forEach((value, columnOffset) => {
        const targetRow = startRow + rowOffset;
        const targetColumn = startColumn + columnOffset;
        if (targetRow >= WEEK_TIME_SLOTS.length || targetColumn >= days.length) return;
        onChangeNote(weekSlotKey(days[targetColumn], WEEK_TIME_SLOTS[targetRow]), value);
        lastRow = targetRow;
        lastColumn = targetColumn;
      });
    });
    window.requestAnimationFrame(() => focusCell(lastRow, lastColumn));
  }

  function handleCopy(event: ReactClipboardEvent<HTMLInputElement>, value: string) {
    if (event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", value);
  }

  function handleCellKeyDown(event: ReactKeyboardEvent<HTMLInputElement>, row: number, column: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      focusCell(row + (event.shiftKey ? -1 : 1), column);
    }
  }

  function handleScheduleDragEnd(event: DragEndEvent) {
    const sourceKey = event.active.data.current?.slotKey as string | undefined;
    const targetKey = event.over?.data.current?.slotKey as string | undefined;
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;
    const sourceSelected = selection.has(selectionId("primary", sourceKey));
    const movingKeys = sourceSelected && selectedPrimaryKeys.length > 1 ? selectedPrimaryKeys : [sourceKey];
    if (movingKeys.length === 1) {
      onMoveSlot(sourceKey, targetKey);
      if (sourceSelected) replacePrimarySelection([targetKey]);
      return;
    }

    const positions = new Map<string, { row: number; column: number }>();
    WEEK_TIME_SLOTS.forEach((time, row) => days.forEach((date, column) => positions.set(weekSlotKey(date, time), { row, column })));
    const sourcePosition = positions.get(sourceKey);
    const targetPosition = positions.get(targetKey);
    if (!sourcePosition || !targetPosition) return;
    const rowOffset = targetPosition.row - sourcePosition.row;
    const columnOffset = targetPosition.column - sourcePosition.column;
    const moves = movingKeys.map((key) => {
      const position = positions.get(key);
      if (!position) return null;
      const row = position.row + rowOffset;
      const column = position.column + columnOffset;
      if (row < 0 || row >= WEEK_TIME_SLOTS.length || column < 0 || column >= days.length) return null;
      return { sourceKey: key, targetKey: weekSlotKey(days[column], WEEK_TIME_SLOTS[row]) };
    });
    if (moves.some((move) => !move)) return;
    const validMoves = moves.filter((move): move is { sourceKey: string; targetKey: string } => Boolean(move));
    const sources = new Set(validMoves.map((move) => move.sourceKey));
    if (validMoves.some((move) => Boolean(notes[move.targetKey]) && !sources.has(move.targetKey))) return;
    onMoveSlots(validMoves);
    replacePrimarySelection(validMoves.map((move) => move.targetKey));
  }

  function replacePrimarySelection(keys: string[]) {
    setSelection((current) => new Set([
      ...[...current].filter((id) => parseSelectionId(id).kind !== "primary"),
      ...keys.map((key) => selectionId("primary", key)),
    ]));
  }

  function openContextMenu(event: ReactMouseEvent, slotKey: string, kind: SelectionKind, activityId?: string) {
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey) return;
    setContextMenu({
      slotKey,
      kind,
      activityId,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 174)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 54)),
    });
  }

  function deleteContextCard() {
    if (!contextMenu) return;
    if (contextMenu.kind === "work") {
      onRemoveWorkSlot(contextMenu.slotKey);
    } else if (contextMenu.kind === "activity" && contextMenu.activityId) {
      onRemoveActivity(contextMenu.activityId);
    } else {
      onChangeNote(contextMenu.slotKey, "");
      onChangeColors([contextMenu.slotKey], "#ffffff");
      setSelection((current) => {
        const next = new Set(current);
        next.delete(selectionId("primary", contextMenu.slotKey));
        return next;
      });
    }
    setContextMenu(null);
  }

  const contextMenuSelected = Boolean(contextMenu && selection.has(selectionId(
    contextMenu.kind,
    contextMenu.kind === "activity" ? contextMenu.activityId ?? "" : contextMenu.slotKey,
  )));
  const contextMenuIsBulk = contextMenuSelected && selection.size > 1;
  const bulkActions = (
    <div className="week-bulk-actions" title="⌘ + clique soma outros · Delete apaga todos · arraste um card de texto para mover o grupo">
      <strong>{selection.size} {selection.size === 1 ? "selecionado" : "selecionados"}</strong>
      {selectedPrimaryKeys.length > 0 && (
        <form
          className="week-bulk-fill"
          onSubmit={(event) => {
            event.preventDefault();
            fillSelectedCells();
          }}
        >
          <input
            value={fillText}
            onChange={(event) => setFillText(event.target.value)}
            onKeyDown={(event) => {
              // O submit implícito do formulário não é garantido em toda situação,
              // então o Enter preenche as células diretamente.
              if (event.key !== "Enter") return;
              event.preventDefault();
              fillSelectedCells();
            }}
            placeholder={`Escrever nas ${selectedPrimaryKeys.length}`}
            aria-label={`Escrever a mesma atividade nas ${selectedPrimaryKeys.length} células selecionadas`}
            title="Digite e pressione Enter para preencher todas as células selecionadas"
          />
          <button type="submit" disabled={!fillText.trim()} aria-label="Preencher as células selecionadas" title="Preencher as células selecionadas"><Check size={12} /></button>
        </form>
      )}
      {selectedPrimaryKeys.length > 0 && (
        <label title="Cor do grupo"><input type="color" defaultValue="#dce8f4" onChange={(event) => onChangeColors(selectedPrimaryKeys, event.target.value)} aria-label="Cor do grupo" /></label>
      )}
      <button type="button" className="week-bulk-delete" onClick={deleteSelection} title="Apagar os cards selecionados"><Trash2 size={12} /> Apagar</button>
      <button type="button" onClick={() => setSelection(new Set())} aria-label="Limpar seleção" title="Limpar seleção"><X size={12} /></button>
    </div>
  );

  return (
    <div className="week-planner">
      {contextMenu && (
        <>
          <button type="button" className="week-context-dismiss" aria-label="Fechar menu do compromisso" onClick={() => setContextMenu(null)} />
          <div className="week-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button type="button" role="menuitem" onClick={contextMenuIsBulk ? deleteSelection : deleteContextCard}>
              <Trash2 size={14} />
              {contextMenuIsBulk
                ? `Apagar ${selection.size} selecionados`
                : contextMenu.kind === "work" ? "Remover Trabalho" : contextMenu.kind === "activity" ? "Apagar atividade" : "Apagar card"}
            </button>
          </div>
        </>
      )}
      {selection.size > 0 && (bulkSlot ? createPortal(bulkActions, bulkSlot) : bulkActions)}
      <DndContext sensors={scheduleSensors} collisionDetection={closestCorners} onDragEnd={handleScheduleDragEnd}>
        <div className={`week-schedule-scroll ${marqueeActive ? "is-marquee" : ""}`} onPointerDown={startMarquee}>
          <div ref={gridRef} className="week-schedule-grid" role="grid" aria-label="Agenda semanal em intervalos de 30 minutos">
          {marquee && <div className="week-marquee" style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }} />}
          <div className="week-schedule-corner" role="columnheader">Horário</div>
          {days.map((date, index) => (
            <header key={dateKey(date)} className={`week-schedule-day ${dateKey(date) === today ? "is-today" : ""}`} role="columnheader">
              <strong>{WEEKDAYS[index]}</strong>
              <span>{String(date.getDate()).padStart(2, "0")}/{String(date.getMonth() + 1).padStart(2, "0")}</span>
            </header>
          ))}

          {WEEK_TIME_SLOTS.map((time, row) => {
            const isFullHour = time.endsWith(":00");
            return (
              <div key={time} className="week-schedule-row" role="row">
                <div className={`week-time-label ${isFullHour ? "is-full-hour" : ""}`} role="rowheader">{time}</div>
                {days.map((date, column) => {
                  const key = weekSlotKey(date, time);
                  const value = notes[key] ?? "";
                  return (
                    <WeeklySlot
                      key={key}
                      slotKey={key}
                      value={value}
                      color={colors[key] ?? "#ffffff"}
                      hasWork={workSlotSet.has(key)}
                      activities={activities[key] ?? []}
                      selection={selection}
                      isFullHour={isFullHour}
                      inputRef={(node) => { if (node) cellRefs.current.set(key, node); else cellRefs.current.delete(key); }}
                      onChange={(nextValue) => onChangeNote(key, nextValue)}
                      onChangeColor={(nextColor) => onChangeColors(selection.has(selectionId("primary", key)) ? selectedPrimaryKeys : [key], nextColor)}
                      onToggleSelection={toggleSelection}
                      onPaste={(event) => handlePaste(event, row, column)}
                      onCopy={(event) => handleCopy(event, value)}
                      onKeyDown={(event) => handleCellKeyDown(event, row, column)}
                      onOpenContextMenu={(event, kind, activityId) => openContextMenu(event, key, kind, activityId)}
                      onDropPlannerCard={(payload) => {
                        if (payload.mode === "new") onAddActivity([key], payload.title, payload.color);
                        else onMoveActivity(payload.activityId, payload.sourceKey, key);
                      }}
                      ariaLabel={`${WEEKDAYS[column]}, ${dateKey(date)}, às ${time}`}
                    />
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </DndContext>
      <p className="week-schedule-help">Cole células do Excel ou Google Planilhas diretamente na grade. Tab avança e Enter desce no mesmo dia.</p>
    </div>
  );
}

function PlanningWorkspace({
  mode,
  cursor,
  notes,
  colors,
  workSlots,
  activities,
  onChangeMode,
  onChangeCursor,
  onChangeNote,
  onChangeNotes,
  onChangeColors,
  onMoveSlot,
  onMoveSlots,
  onFillWorkWeek,
  onRemoveWorkSlot,
  onAddActivity,
  onMoveActivity,
  onRemoveActivity,
}: {
  mode: PlanningMode;
  cursor: Date;
  notes: Record<string, string>;
  colors: Record<string, string>;
  workSlots: string[];
  activities: Record<string, PlannerActivity[]>;
  onChangeMode: (mode: PlanningMode) => void;
  onChangeCursor: (date: Date) => void;
  onChangeNote: (key: string, value: string) => void;
  onChangeNotes: (keys: string[], value: string) => void;
  onChangeColors: (keys: string[], color: string) => void;
  onMoveSlot: (sourceKey: string, targetKey: string) => void;
  onMoveSlots: (moves: { sourceKey: string; targetKey: string }[]) => void;
  onFillWorkWeek: (days: Date[]) => void;
  onRemoveWorkSlot: (key: string) => void;
  onAddActivity: (keys: string[], title: string, color: string) => void;
  onMoveActivity: (activityId: string, sourceKey: string, targetKey: string) => void;
  onRemoveActivity: (activityId: string) => void;
}) {
  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekStartKey = dateKey(weekStart);
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customDay, setCustomDay] = useState(weekStartKey);
  const [customStart, setCustomStart] = useState("18:00");
  const [customEnd, setCustomEnd] = useState("19:00");
  const todayKey = dateKey(new Date());
  const fallbackCustomDay = weekDays.some((day) => dateKey(day) === todayKey) ? todayKey : weekStartKey;
  const selectedCustomDay = weekDays.some((day) => dateKey(day) === customDay) ? customDay : fallbackCustomDay;
  const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(cursor);
  const shiftCursor = (direction: -1 | 1) => {
    if (mode === "week") onChangeCursor(addDays(cursor, direction * 7));
    if (mode === "month") onChangeCursor(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
    if (mode === "year") onChangeCursor(new Date(cursor.getFullYear() + direction, cursor.getMonth(), 1));
  };

  function addCustomActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = customTitle.trim();
    if (!title || customEnd <= customStart) return;
    const keys = WEEK_TIME_SLOTS
      .filter((time) => time >= customStart && time < customEnd)
      .map((time) => `week:${selectedCustomDay}:${time}`);
    if (!keys.length) return;
    onAddActivity(keys, title, CUSTOM_SLOT_COLOR);
    setCustomTitle("");
  }

  function startAcademyDrag(event: ReactDragEvent<HTMLButtonElement>) {
    const payload: PlannerDragPayload = { mode: "new", title: "Academia", color: ACADEMY_SLOT_COLOR };
    event.dataTransfer.setData(PLANNER_DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copy";
  }

  return (
    <section className={`planning-workspace planning-${mode}`}>
      <nav className="planning-subnav" aria-label="Visualização do planejamento">
        {(["week", "month", "year"] as PlanningMode[]).map((item) => (
          <button key={item} type="button" className={mode === item ? "active" : ""} onClick={() => onChangeMode(item)}>
            {item === "week" ? "Semana" : item === "month" ? "Mensal" : "Anual"}
          </button>
        ))}
      </nav>

      <header className="planner-header">
        <div className="planner-heading-tools">
          <span>Planejamento</span>
          <h1>{mode === "year" ? cursor.getFullYear() : monthTitle}</h1>
          {mode === "week" && (
            <div className="planner-quick-tools">
              <button
                type="button"
                className="fill-work-button"
                title="Preencher os horários de trabalho desta semana"
                onClick={() => onFillWorkWeek(weekDays)}
              >
                <Briefcase size={13} />
                Trabalho
              </button>
              <button
                type="button"
                className="academy-template-card"
                title="Arraste Academia para um horário ou clique para preencher o formulário"
                draggable
                onClick={() => setCustomTitle("Academia")}
                onDragStart={startAcademyDrag}
              >
                <GripVertical size={12} />
                Academia
              </button>
              <form className="custom-activity-form" onSubmit={addCustomActivity}>
                <strong>Personalizado:</strong>
                <input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Nome da atividade" aria-label="Nome da atividade personalizada" required />
                <select value={selectedCustomDay} onChange={(event) => setCustomDay(event.target.value)} aria-label="Dia da atividade">
                  {weekDays.map((day, index) => <option key={dateKey(day)} value={dateKey(day)}>{WEEKDAYS[index]} {String(day.getDate()).padStart(2, "0")}/{String(day.getMonth() + 1).padStart(2, "0")}</option>)}
                </select>
                <select value={customStart} onChange={(event) => {
                  const start = event.target.value;
                  setCustomStart(start);
                  if (customEnd <= start) {
                    setCustomEnd([...WEEK_TIME_SLOTS.slice(1), "23:30"].find((time) => time > start) ?? "23:30");
                  }
                }} aria-label="Hora de início">
                  {WEEK_TIME_SLOTS.map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
                <select value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} aria-label="Hora de término">
                  {[...WEEK_TIME_SLOTS.slice(1), "23:30"].filter((time) => time > customStart).map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
                <button type="submit" aria-label="Adicionar atividade personalizada" title="Adicionar ao cronograma"><Plus size={13} /></button>
              </form>
              {/* A barra de seleção da grade é enviada para cá por portal, para não empurrar o cronograma. */}
              <div className="planner-bulk-slot" ref={setBulkSlot} />
            </div>
          )}
        </div>
        <div className="planner-navigation">
          <button type="button" aria-label="Período anterior" onClick={() => shiftCursor(-1)}><ArrowLeft size={17} /></button>
          <button type="button" onClick={() => onChangeCursor(new Date())}>Hoje</button>
          <button type="button" aria-label="Próximo período" onClick={() => shiftCursor(1)}><ArrowRight size={17} /></button>
        </div>
      </header>

      {mode === "week" && (
        <WeeklyPlannerGrid key={dateKey(weekStart)} days={weekDays} notes={notes} colors={colors} workSlots={workSlots} activities={activities} bulkSlot={bulkSlot} onChangeNote={onChangeNote} onChangeNotes={onChangeNotes} onChangeColors={onChangeColors} onMoveSlot={onMoveSlot} onMoveSlots={onMoveSlots} onRemoveWorkSlot={onRemoveWorkSlot} onAddActivity={onAddActivity} onMoveActivity={onMoveActivity} onRemoveActivity={onRemoveActivity} />
      )}

      {mode === "month" && (
        <div className="month-planner">
          <div className="month-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="month-grid">
            {monthCells(cursor).map((date, index) => date ? (
              <article key={dateKey(date)} className="month-day">
                <strong>{date.getDate()}</strong>
                <textarea value={notes[dateKey(date)] ?? ""} onChange={(event) => onChangeNote(dateKey(date), event.target.value)} placeholder="Adicionar…" aria-label={`Planejamento de ${dateKey(date)}`} />
              </article>
            ) : <span key={`empty-${index}`} className="month-day month-day-empty" />)}
          </div>
        </div>
      )}

      {mode === "year" && (
        <div className="year-planner">
          {Array.from({ length: 12 }, (_, month) => {
            const monthDate = new Date(cursor.getFullYear(), month, 1);
            const daysWithNotes = monthCells(monthDate).filter((date): date is Date => Boolean(date && notes[dateKey(date)]?.trim())).length;
            return (
              <button key={month} type="button" onClick={() => { onChangeCursor(monthDate); onChangeMode("month"); }}>
                <span>{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(monthDate)}</span>
                <strong>{daysWithNotes}</strong>
                <small>{daysWithNotes === 1 ? "dia planejado" : "dias planejados"}</small>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(DEFAULT_WORKSPACE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [activeView, setActiveView] = useState<"board" | "planning" | "diary">("board");
  const [planningMode, setPlanningMode] = useState<PlanningMode>("week");
  const [plannerCursor, setPlannerCursor] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [activeDrag, setActiveDrag] = useState<{ boardId: string; cardId: string } | null>(null);
  const [cardModal, setCardModal] = useState<{ boardId: string; mode: "new" | "edit"; columnId: string; cardId?: string } | null>(null);
  const [columnModal, setColumnModal] = useState<{ boardId: string; mode: "new" | "edit"; columnId?: string } | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showDesktopFilter, setShowDesktopFilter] = useState(false);
  const saveRequest = useRef(0);
  const board = workspaceState.boards.find((candidate) => candidate.id === workspaceState.activeBoardId)
    ?? workspaceState.boards[0];

  function setBoard(update: (current: BoardState) => BoardState, boardId = workspaceState.activeBoardId) {
    setWorkspaceState((current) => ({
      ...current,
      boards: current.boards.map((candidate) =>
        candidate.id === boardId ? update(candidate) : candidate,
      ),
    }));
  }

  function activateBoard(boardId: string) {
    setWorkspaceState((current) => ({ ...current, activeBoardId: boardId }));
  }

  function setPlannerNote(key: string, value: string) {
    setWorkspaceState((current) => ({
      ...current,
      plannerNotes: { ...current.plannerNotes, [key]: value },
    }));
  }

  function setPlannerNotes(keys: string[], value: string) {
    setWorkspaceState((current) => ({
      ...current,
      plannerNotes: keys.reduce((next, key) => ({ ...next, [key]: value }), current.plannerNotes),
    }));
  }

  function setPlannerSlotColors(keys: string[], color: string) {
    setWorkspaceState((current) => ({
      ...current,
      plannerSlotColors: keys.reduce((next, key) => ({ ...next, [key]: color }), current.plannerSlotColors),
    }));
  }

  function movePlannerSlot(sourceKey: string, targetKey: string) {
    setWorkspaceState((current) => {
      const sourceValue = current.plannerNotes[sourceKey] ?? "";
      if (!sourceValue) return current;
      const targetValue = current.plannerNotes[targetKey] ?? "";
      const sourceColor = current.plannerSlotColors[sourceKey] ?? "#ffffff";
      const targetColor = current.plannerSlotColors[targetKey] ?? "#ffffff";
      return {
        ...current,
        plannerNotes: {
          ...current.plannerNotes,
          [sourceKey]: targetValue,
          [targetKey]: sourceValue,
        },
        plannerSlotColors: {
          ...current.plannerSlotColors,
          [sourceKey]: targetValue ? targetColor : "#ffffff",
          [targetKey]: sourceColor,
        },
      };
    });
  }

  function movePlannerSlots(moves: { sourceKey: string; targetKey: string }[]) {
    setWorkspaceState((current) => {
      const sources = new Set(moves.map((move) => move.sourceKey));
      if (moves.some((move) => Boolean(current.plannerNotes[move.targetKey]) && !sources.has(move.targetKey))) return current;
      const moving = moves.map((move) => ({
        ...move,
        value: current.plannerNotes[move.sourceKey] ?? "",
        color: current.plannerSlotColors[move.sourceKey] ?? "#ffffff",
      }));
      const plannerNotes = { ...current.plannerNotes };
      const plannerSlotColors = { ...current.plannerSlotColors };
      moving.forEach(({ sourceKey }) => { plannerNotes[sourceKey] = ""; plannerSlotColors[sourceKey] = "#ffffff"; });
      moving.forEach(({ targetKey, value, color }) => { plannerNotes[targetKey] = value; plannerSlotColors[targetKey] = color; });
      return { ...current, plannerNotes, plannerSlotColors };
    });
  }

  function fillWorkWeek(days: Date[]) {
    const workTimes = WEEK_TIME_SLOTS.filter((time) => (
      (time >= "08:00" && time <= "11:30")
      || (time >= "13:30" && time <= "16:30")
    ));
    const workKeys = days.slice(0, 5).flatMap((date) => workTimes.map((time) => weekSlotKey(date, time)));

    setWorkspaceState((current) => ({
      ...current,
      plannerWorkSlots: [...new Set([...(current.plannerWorkSlots ?? []), ...workKeys])],
    }));
  }

  function removeWorkSlot(key: string) {
    setWorkspaceState((current) => ({
      ...current,
      plannerWorkSlots: (current.plannerWorkSlots ?? []).filter((slotKey) => slotKey !== key),
    }));
  }

  function addPlannerActivity(keys: string[], title: string, color: string) {
    const activity: PlannerActivity = { id: makeId("planner-activity"), title, color };
    setWorkspaceState((current) => {
      const plannerActivities = { ...(current.plannerActivities ?? {}) };
      keys.forEach((key) => {
        const existing = plannerActivities[key] ?? [];
        if (existing.some((item) => normalizeKey(item.title) === normalizeKey(title))) return;
        plannerActivities[key] = [...existing, activity];
      });
      return { ...current, plannerActivities };
    });
  }

  function movePlannerActivity(activityId: string, sourceKey: string, targetKey: string) {
    if (sourceKey === targetKey) return;
    setWorkspaceState((current) => {
      const source = parseWeekSlotKey(sourceKey);
      const target = parseWeekSlotKey(targetKey);
      if (!source || !target) return current;
      const sourceTimeIndex = WEEK_TIME_SLOTS.indexOf(source.time);
      const targetTimeIndex = WEEK_TIME_SLOTS.indexOf(target.time);
      if (sourceTimeIndex < 0 || targetTimeIndex < 0) return current;
      const dayOffset = Math.round((new Date(`${target.day}T12:00:00`).getTime() - new Date(`${source.day}T12:00:00`).getTime()) / 86_400_000);
      const timeOffset = targetTimeIndex - sourceTimeIndex;
      const occupiedSlots = Object.entries(current.plannerActivities ?? {})
        .filter(([, items]) => items.some((item) => item.id === activityId));
      if (!occupiedSlots.length) return current;

      const moves = occupiedSlots.map(([key, items]) => {
        const parsed = parseWeekSlotKey(key);
        const activity = items.find((item) => item.id === activityId);
        if (!parsed || !activity) return null;
        const timeIndex = WEEK_TIME_SLOTS.indexOf(parsed.time) + timeOffset;
        if (timeIndex < 0 || timeIndex >= WEEK_TIME_SLOTS.length) return null;
        const nextDay = addDays(new Date(`${parsed.day}T12:00:00`), dayOffset);
        return { sourceKey: key, targetKey: weekSlotKey(nextDay, WEEK_TIME_SLOTS[timeIndex]), activity };
      });
      if (moves.some((move) => !move)) return current;

      const plannerActivities = { ...(current.plannerActivities ?? {}) };
      occupiedSlots.forEach(([key]) => {
        const remaining = (plannerActivities[key] ?? []).filter((item) => item.id !== activityId);
        if (remaining.length) plannerActivities[key] = remaining;
        else delete plannerActivities[key];
      });
      moves.forEach((move) => {
        if (!move) return;
        const existing = plannerActivities[move.targetKey] ?? [];
        plannerActivities[move.targetKey] = [...existing.filter((item) => item.id !== activityId), move.activity];
      });
      return { ...current, plannerActivities };
    });
  }

  function removePlannerActivity(activityId: string) {
    setWorkspaceState((current) => {
      const plannerActivities = { ...(current.plannerActivities ?? {}) };
      Object.keys(plannerActivities).forEach((key) => {
        const remaining = plannerActivities[key].filter((item) => item.id !== activityId);
        if (remaining.length) plannerActivities[key] = remaining;
        else delete plannerActivities[key];
      });
      return { ...current, plannerActivities };
    });
  }

  function addDiaryPost(content: string) {
    const now = new Date().toISOString();
    const post: DiaryPost = { id: makeId("diary-post"), content, createdAt: now };
    setWorkspaceState((current) => ({ ...current, diaryPosts: [post, ...(current.diaryPosts ?? [])] }));
  }

  function updateDiaryPost(id: string, content: string) {
    const updatedAt = new Date().toISOString();
    setWorkspaceState((current) => ({
      ...current,
      diaryPosts: (current.diaryPosts ?? []).map((post) => post.id === id ? { ...post, content, updatedAt } : post),
    }));
  }

  function deleteDiaryPost(id: string) {
    setWorkspaceState((current) => ({
      ...current,
      diaryPosts: (current.diaryPosts ?? []).filter((post) => post.id !== id),
    }));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) setLoaded(false);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    let active = true;
    async function loadBoard() {
      try {
        const snapshot = await getDoc(doc(db, "users", user!.uid, "boards", "main"));
        const payload = snapshot.data() as { workspace?: WorkspaceState; state?: Omit<BoardState, "id"> } | undefined;
        if (active) setWorkspaceState(getWorkspaceFromPayload(payload));
        if (active) setSaveStatus("saved");
      } catch {
        if (active) setSaveStatus("offline");
      } finally {
        if (active) setLoaded(true);
      }
    }
    loadBoard();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!loaded || !user) return;
    const requestNumber = ++saveRequest.current;
    const timer = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await setDoc(
          doc(db, "users", user.uid, "boards", "main"),
          { workspace: workspaceState, updatedAt: serverTimestamp() },
          { merge: true },
        );
        if (saveRequest.current === requestNumber) setSaveStatus("saved");
      } catch {
        if (saveRequest.current === requestNumber) setSaveStatus("offline");
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [loaded, user, workspaceState]);

  async function handleSignIn() {
    setAuthBusy(true);
    setAuthError("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch {
      setAuthError("Não foi possível entrar. Confira se os pop-ups estão liberados e tente novamente.");
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    setWorkspaceState(DEFAULT_WORKSPACE);
    setSaveStatus("loading");
  }

  function createProject(title: string) {
    const projectId = makeId("project");
    const themes: Theme[] = ["peach", "ocean", "lilac", "sage", "sky", "sand", "rose", "paper", "graphite", "midnight"];
    setWorkspaceState((current) => ({
      ...current,
      activeBoardId: projectId,
      boards: [
        ...current.boards,
        createBlankBoard(projectId, title, themes[current.boards.length % themes.length]),
      ],
      visibleBoardIds: [...current.visibleBoardIds, projectId],
    }));
    setShowProjectModal(false);
    setQuery("");
    setPriorityFilter("all");
  }

  function deleteProject() {
    if (workspaceState.boards.length <= 1) return;
    if (!window.confirm(`Excluir o desktop “${board.title}” e todos os cartões dele?`)) return;
    setWorkspaceState((current) => {
      const remaining = current.boards.filter((candidate) => candidate.id !== current.activeBoardId);
      return { ...current, activeBoardId: remaining[0].id, boards: remaining, visibleBoardIds: current.visibleBoardIds.filter((id) => id !== current.activeBoardId) };
    });
    setShowCustomizer(false);
    setQuery("");
    setPriorityFilter("all");
  }

  function toggleDesktopVisibility(boardId: string) {
    setWorkspaceState((current) => ({
      ...current,
      visibleBoardIds: current.visibleBoardIds.includes(boardId)
        ? current.visibleBoardIds.filter((id) => id !== boardId)
        : [...current.visibleBoardIds, boardId],
    }));
  }

  const visibleBoards = useMemo(
    () => workspaceState.boards.filter((project) => workspaceState.visibleBoardIds.includes(project.id)),
    [workspaceState.boards, workspaceState.visibleBoardIds],
  );

  const visibleIdsByBoard = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return new Map(visibleBoards.map((project) => {
      const ids = project.cards.filter((card) => {
        const matchesQuery = !normalizedQuery || `${card.title} ${card.description} ${card.label}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
        const matchesPriority = priorityFilter === "all" || card.priority === priorityFilter;
        return matchesQuery && matchesPriority;
      }).map((card) => card.id);
      return [project.id, new Set(ids)];
    }));
  }, [priorityFilter, query, visibleBoards]);

  const filteredCardCount = useMemo(
    () => [...visibleIdsByBoard.values()].reduce((total, ids) => total + ids.size, 0),
    [visibleIdsByBoard],
  );
  const activeCard = activeDrag
    ? workspaceState.boards.find((project) => project.id === activeDrag.boardId)?.cards.find((card) => card.id === activeDrag.cardId)
    : undefined;
  const cardModalBoard = workspaceState.boards.find((project) => project.id === cardModal?.boardId) ?? board;
  const columnModalBoard = workspaceState.boards.find((project) => project.id === columnModal?.boardId) ?? board;
  const modalCard = cardModal?.cardId ? cardModalBoard.cards.find((card) => card.id === cardModal.cardId) : undefined;
  const modalColumn = columnModal?.columnId ? columnModalBoard.columns.find((column) => column.id === columnModal.columnId) : undefined;

  function handleDragStart(boardId: string, event: DragStartEvent) {
    activateBoard(boardId);
    setActiveDrag(event.active.data.current?.type === "card"
      ? { boardId, cardId: String(event.active.id) }
      : null);
  }

  function handleDesktopDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id).replace(/^desktop-/, "");
    const overId = event.over ? String(event.over.id).replace(/^desktop-/, "") : null;
    if (!overId || activeId === overId) return;
    setWorkspaceState((current) => {
      const oldIndex = current.boards.findIndex((project) => project.id === activeId);
      const newIndex = current.boards.findIndex((project) => project.id === overId);
      if (oldIndex < 0 || newIndex < 0) return current;
      return { ...current, boards: arrayMove(current.boards, oldIndex, newIndex) };
    });
  }

  function handleDragEnd(boardId: string, event: DragEndEvent) {
    const draggedId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveDrag(null);
    if (!overId || draggedId === overId) return;

    if (event.active.data.current?.type === "column") {
      const draggedColumnId = String(event.active.data.current.columnId);
      setBoard((current) => {
        const overColumnId = event.over?.data.current?.columnId
          ? String(event.over.data.current.columnId)
          : current.cards.some((card) => card.id === overId)
            ? findColumnForCard(current, overId)?.id
            : overId.replace(/^sortable-column-|^column-/, "");
        if (!overColumnId || draggedColumnId === overColumnId) return current;
        const oldIndex = current.columns.findIndex((column) => column.id === draggedColumnId);
        const newIndex = current.columns.findIndex((column) => column.id === overColumnId);
        if (oldIndex < 0 || newIndex < 0) return current;
        return { ...current, columns: arrayMove(current.columns, oldIndex, newIndex) };
      }, boardId);
      return;
    }

    setBoard((current) => {
      const sourceColumn = findColumnForCard(current, draggedId);
      if (!sourceColumn) return current;
      const overCard = current.cards.find((card) => card.id === overId);
      const targetColumn = overCard
        ? findColumnForCard(current, overCard.id)
        : event.over?.data.current?.columnId
          ? current.columns.find((column) => column.id === event.over?.data.current?.columnId)
        : overId.startsWith("column-")
          ? current.columns.find((column) => column.id === overId.replace("column-", ""))
          : undefined;
      if (!targetColumn) return current;

      if (sourceColumn.id === targetColumn.id && overCard) {
        const oldIndex = sourceColumn.cardIds.indexOf(draggedId);
        const newIndex = sourceColumn.cardIds.indexOf(overCard.id);
        return {
          ...current,
          columns: current.columns.map((column) =>
            column.id === sourceColumn.id ? { ...column, cardIds: arrayMove(column.cardIds, oldIndex, newIndex) } : column,
          ),
        };
      }

      const withoutDragged = sourceColumn.cardIds.filter((id) => id !== draggedId);
      const nextTargetIds = targetColumn.cardIds.filter((id) => id !== draggedId);
      const insertAt = overCard ? Math.max(0, nextTargetIds.indexOf(overCard.id)) : nextTargetIds.length;
      nextTargetIds.splice(insertAt, 0, draggedId);

      return {
        ...current,
        columns: current.columns.map((column) => {
          if (column.id === sourceColumn.id) return { ...column, cardIds: withoutDragged };
          if (column.id === targetColumn.id) return { ...column, cardIds: nextTargetIds };
          return column;
        }),
      };
    }, boardId);
  }

  function saveCard(draft: CardDraft) {
    if (!cardModal) return;
    const boardId = cardModal.boardId;
    const { columnId, ...cardValues } = draft;
    if (cardModal?.mode === "edit" && cardModal.cardId) {
      const cardId = cardModal.cardId;
      setBoard((current) => {
        const oldColumn = findColumnForCard(current, cardId);
        return {
          ...current,
          cards: current.cards.map((card) => card.id === cardId ? { ...card, ...cardValues, id: cardId } : card),
          columns: current.columns.map((column) => {
            if (column.id === oldColumn?.id && column.id !== columnId) return { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) };
            if (column.id === columnId && !column.cardIds.includes(cardId)) return { ...column, cardIds: [...column.cardIds, cardId] };
            return column;
          }),
        };
      }, boardId);
    } else {
      const id = makeId("card");
      setBoard((current) => ({
        ...current,
        cards: [...current.cards, { ...cardValues, id }],
        columns: current.columns.map((column) => column.id === columnId ? { ...column, cardIds: [...column.cardIds, id] } : column),
      }), boardId);
    }
    setCardModal(null);
  }

  function deleteCard(cardId: string) {
    if (!cardModal) return;
    if (!window.confirm("Excluir este cartão?")) return;
    setBoard((current) => ({
      ...current,
      cards: current.cards.filter((card) => card.id !== cardId),
      columns: current.columns.map((column) => ({ ...column, cardIds: column.cardIds.filter((id) => id !== cardId) })),
    }), cardModal.boardId);
    setCardModal(null);
  }

  function saveColumn(title: string, color: string) {
    if (!columnModal) return;
    if (columnModal?.mode === "edit" && columnModal.columnId) {
      setBoard((current) => ({ ...current, columns: current.columns.map((column) => column.id === columnModal.columnId ? { ...column, title, color } : column) }), columnModal.boardId);
    } else {
      setBoard((current) => ({ ...current, columns: [...current.columns, { id: makeId("column"), title, color, cardIds: [] }] }), columnModal.boardId);
    }
    setColumnModal(null);
  }

  function deleteColumn(columnId: string) {
    if (!columnModal || columnModalBoard.columns.length <= 1 || !window.confirm("Excluir esta coluna? Os cartões serão movidos para a primeira coluna.")) return;
    setBoard((current) => {
      const removed = current.columns.find((column) => column.id === columnId);
      const remaining = current.columns.filter((column) => column.id !== columnId);
      if (removed?.cardIds.length) remaining[0] = { ...remaining[0], cardIds: [...remaining[0].cardIds, ...removed.cardIds] };
      return { ...current, columns: remaining };
    }, columnModal.boardId);
    setColumnModal(null);
  }

  if (!authReady) {
    return (
      <main className="auth-screen">
        <div className="auth-card auth-loading-card">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <LoaderCircle className="spin" size={25} />
          <p>Preparando seu espaço…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="auth-brand"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><strong>vinello</strong></div>
          <span className="auth-eyebrow">Seu Kanban pessoal</span>
          <h1>Organize do<br />seu jeito.</h1>
          <p>Suas ideias, tarefas e projetos em um quadro colorido que acompanha você no computador e no celular.</p>
          <div className="auth-features"><span><Check size={15} /> Sincronização automática</span><span><Check size={15} /> Espaço protegido</span><span><Check size={15} /> Acesso em qualquer dispositivo</span></div>
          <button type="button" className="google-signin-button" disabled={authBusy} onClick={handleSignIn}>
            {authBusy ? <LoaderCircle className="spin" size={19} /> : <LogIn size={19} />}
            Entrar com Google
          </button>
          {authError && <div className="auth-error" role="alert">{authError}</div>}
          <small>Somente você tem acesso aos seus cartões.</small>
        </section>
        <div className="auth-board-preview" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      </main>
    );
  }

  const initials = getInitials(user);

  return (
    <main className="app-shell multi-board-shell">
      <section className="workspace">
        <header className="topbar">
          <div className="topbar-brand"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><strong>vinello</strong></div>
          <nav className="top-nav" aria-label="Navegação principal">
            <button type="button" className={`top-nav-item ${activeView === "board" && priorityFilter === "all" ? "active" : ""}`} onClick={() => { setActiveView("board"); setQuery(""); setPriorityFilter("all"); }}><LayoutDashboard size={17} /><span>Quadro</span></button>
            <button type="button" className={`top-nav-item ${activeView === "planning" ? "active" : ""}`} onClick={() => { setActiveView("planning"); setQuery(""); setPriorityFilter("all"); }}><CalendarDays size={17} /><span>Planejamento</span></button>
            <button type="button" className={`top-nav-item ${activeView === "diary" ? "active" : ""}`} onClick={() => { setActiveView("diary"); setQuery(""); setPriorityFilter("all"); }}><FileText size={17} /><span>Diário</span></button>
          </nav>
          {activeView === "board" && <button type="button" className="add-desktop-button" aria-label="Adicionar desktop" title="Adicionar desktop" onClick={() => setShowProjectModal(true)}><Plus size={18} /></button>}
          {activeView === "board" && (
            <div className="desktop-filter-control">
              <button type="button" className={`desktop-filter-button ${showDesktopFilter ? "active" : ""}`} aria-expanded={showDesktopFilter} onClick={() => setShowDesktopFilter((current) => !current)}><Columns3 size={16} /><span>Desktops</span><em>{workspaceState.visibleBoardIds.length}/{workspaceState.boards.length}</em></button>
              {showDesktopFilter && <>
                <button type="button" className="desktop-filter-dismiss" aria-label="Fechar filtro de desktops" onClick={() => setShowDesktopFilter(false)} />
                <div className="desktop-filter-popover" role="dialog" aria-label="Escolher desktops visíveis">
                  <div className="desktop-filter-heading"><strong>Desktops visíveis</strong><small>A seleção fica salva</small></div>
                  <div className="desktop-filter-actions"><button type="button" onClick={() => setWorkspaceState((current) => ({ ...current, visibleBoardIds: current.boards.map((project) => project.id) }))}>Todos</button><button type="button" onClick={() => setWorkspaceState((current) => ({ ...current, visibleBoardIds: [] }))}>Nenhum</button></div>
                  <div className="desktop-filter-list">
                    {workspaceState.boards.map((project) => {
                      const checked = workspaceState.visibleBoardIds.includes(project.id);
                      return <button key={project.id} type="button" className={checked ? "selected" : ""} aria-pressed={checked} onClick={() => toggleDesktopVisibility(project.id)}><i style={{ background: THEME_ACCENTS[project.theme] }} /><span>{project.title}</span><b>{checked && <Check size={13} />}</b></button>;
                    })}
                  </div>
                </div>
              </>}
            </div>
          )}
          {activeView === "board" && <div className="search-wrap">
            <Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cartões…" aria-label="Buscar cartões" /><kbd>⌘ K</kbd>
          </div>}
          <div className={`top-actions ${activeView !== "board" ? "push-right" : ""}`}>
            <div className={`save-status status-${saveStatus}`} title={saveStatus === "offline" ? "Alterações ainda não sincronizadas" : "Sincronização do quadro"}>
              {saveStatus === "saving" && <LoaderCircle size={16} className="spin" />}
              {saveStatus === "saved" && <Cloud size={16} />}
              {saveStatus === "offline" && <CloudOff size={16} />}
              {saveStatus === "loading" && <LoaderCircle size={16} className="spin" />}
              <span>{saveStatus === "saving" ? "Salvando" : saveStatus === "saved" ? "Tudo salvo" : saveStatus === "offline" ? "Sem conexão" : "Carregando"}</span>
            </div>
            <button type="button" className="icon-button notification-button" aria-label="Notificações"><Bell size={19} /><i /></button>
            <button type="button" className="avatar avatar-button" aria-label="Sair da conta" title="Sair da conta" onClick={handleSignOut}>{initials}</button>
          </div>
        </header>

        {activeView === "planning" ? (
          <PlanningWorkspace mode={planningMode} cursor={plannerCursor} notes={workspaceState.plannerNotes} colors={workspaceState.plannerSlotColors} workSlots={workspaceState.plannerWorkSlots} activities={workspaceState.plannerActivities} onChangeMode={setPlanningMode} onChangeCursor={setPlannerCursor} onChangeNote={setPlannerNote} onChangeNotes={setPlannerNotes} onChangeColors={setPlannerSlotColors} onMoveSlot={movePlannerSlot} onMoveSlots={movePlannerSlots} onFillWorkWeek={fillWorkWeek} onRemoveWorkSlot={removeWorkSlot} onAddActivity={addPlannerActivity} onMoveActivity={movePlannerActivity} onRemoveActivity={removePlannerActivity} />
        ) : activeView === "diary" ? (
          <DiaryWorkspace posts={workspaceState.diaryPosts} onAdd={addDiaryPost} onUpdate={updateDiaryPost} onDelete={deleteDiaryPost} />
        ) : <>
          {(query || priorityFilter !== "all") && (
            <div className="filter-summary"><span>{filteredCardCount} {filteredCardCount === 1 ? "cartão encontrado" : "cartões encontrados"} nos desktops visíveis</span><button type="button" onClick={() => { setQuery(""); setPriorityFilter("all"); }}>Limpar filtros <X size={14} /></button></div>
          )}

          <DndContext id="vinello-desktop-order" sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDesktopDragEnd}>
            <SortableContext items={visibleBoards.map((project) => `desktop-${project.id}`)} strategy={verticalListSortingStrategy}>
              <div className="desktop-stack">
              {visibleBoards.map((project) => {
                const visibleIds = visibleIdsByBoard.get(project.id) ?? new Set<string>();
                return (
                  <SortableDesktop key={project.id} project={project} onCustomize={() => { activateBoard(project.id); setShowCustomizer(true); }}>
                <DndContext id={`vinello-board-dnd-${project.id}`} sensors={sensors} collisionDetection={closestCorners} onDragStart={(event) => handleDragStart(project.id, event)} onDragEnd={(event) => handleDragEnd(project.id, event)} onDragCancel={() => setActiveDrag(null)}>
                  <div className="board-scroll desktop-board-scroll" aria-label={`Quadro Kanban ${project.title}`}>
                    <SortableContext items={project.columns.map((column) => `sortable-column-${column.id}`)} strategy={horizontalListSortingStrategy}>
                      {project.columns.map((column) => {
                        const cards = column.cardIds.map((id) => project.cards.find((card) => card.id === id)).filter((card): card is CardItem => Boolean(card && visibleIds.has(card.id)));
                        return <BoardColumn key={column.id} column={column} cards={cards} onAdd={(columnId) => { activateBoard(project.id); setCardModal({ boardId: project.id, mode: "new", columnId }); }} onOpenCard={(cardId) => { activateBoard(project.id); setCardModal({ boardId: project.id, mode: "edit", columnId: column.id, cardId }); }} onEditColumn={(columnId) => { activateBoard(project.id); setColumnModal({ boardId: project.id, mode: "edit", columnId }); }} />;
                      })}
                    </SortableContext>
                    <button type="button" className="add-column-button" aria-label={`Adicionar lista ao desktop ${project.title}`} title="Adicionar outra lista" onClick={() => { activateBoard(project.id); setColumnModal({ boardId: project.id, mode: "new" }); }}><Plus size={18} /></button>
                  </div>
                  <DragOverlay>{activeDrag?.boardId === project.id && activeCard ? <CardGhost card={activeCard} /> : null}</DragOverlay>
                </DndContext>
                  </SortableDesktop>
                );
              })}
              {visibleBoards.length === 0 && <div className="no-visible-desktops"><Columns3 size={25} /><strong>Nenhum desktop visível</strong><p>Use o filtro “Desktops” no menu superior para escolher o que aparece nesta tela.</p><button type="button" onClick={() => setWorkspaceState((current) => ({ ...current, visibleBoardIds: current.boards.map((project) => project.id) }))}>Mostrar todos</button></div>}
              </div>
            </SortableContext>
          </DndContext>
        </>}
      </section>

      {showProjectModal && (
        <ProjectModal onClose={() => setShowProjectModal(false)} onSave={createProject} />
      )}

      {cardModal && (
        <CardModal
          key={`${cardModal.boardId}-${cardModal.mode}-${cardModal.cardId ?? cardModal.columnId}`}
          card={modalCard}
          columnId={cardModal.columnId}
          onClose={() => setCardModal(null)}
          onSave={saveCard}
          onDelete={modalCard ? () => deleteCard(modalCard.id) : undefined}
        />
      )}

      {columnModal && (
        <ColumnModal
          key={`${columnModal.boardId}-${columnModal.mode}-${columnModal.columnId ?? "new"}`}
          column={modalColumn}
          canDelete={columnModalBoard.columns.length > 1}
          onClose={() => setColumnModal(null)}
          onSave={saveColumn}
          onDelete={modalColumn ? () => deleteColumn(modalColumn.id) : undefined}
        />
      )}

      {showCustomizer && (
        <div className="customizer-backdrop">
          <button type="button" className="backdrop-dismiss" aria-label="Fechar personalização" onClick={() => setShowCustomizer(false)} />
          <aside className="customizer-panel" role="dialog" aria-modal="true" aria-labelledby="customizer-title">
            <div className="customizer-header"><div><span>Seu espaço, suas regras</span><h2 id="customizer-title">Personalizar desktop</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={() => setShowCustomizer(false)}><X size={20} /></button></div>
            <label className="field full-field"><span>Nome do desktop</span><input value={board.title} onChange={(event) => setBoard((current) => ({ ...current, title: event.target.value }))} /></label>
            <div className="theme-section"><span>Tema do fundo</span><div className="theme-grid">{THEME_OPTIONS.map((theme) => (
              <button key={theme.id} type="button" className={`theme-option ${board.theme === theme.id ? "selected" : ""}`} onClick={() => setBoard((current) => ({ ...current, theme: theme.id }))}>
                <span className="theme-preview" style={{ background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`, color: theme.id === "paper" ? "#25282d" : "#fff" }}>{board.theme === theme.id && <Check size={18} />}</span><strong>{theme.name}</strong>
              </button>
            ))}</div></div>
            <div className="customizer-tip"><Sparkles size={20} /><div><strong>Dica de organização</strong><p>Clique nos três pontos de cada coluna para trocar seu nome e sua cor.</p></div></div>
            {workspaceState.boards.length > 1 && <button type="button" className="danger-button full-button" onClick={deleteProject}><Trash2 size={16} /> Excluir este desktop</button>}
            <button type="button" className="primary-button full-button" onClick={() => setShowCustomizer(false)}>Pronto</button>
          </aside>
        </div>
      )}
    </main>
  );
}

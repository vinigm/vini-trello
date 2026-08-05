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
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bold,
  CalendarDays,
  Check,
  Cloud,
  CloudOff,
  Columns3,
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
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
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
  plannerNotes: Record<string, string>;
  plannerSlotColors: Record<string, string>;
};

type SaveStatus = "loading" | "saving" | "saved" | "offline";

const LABEL_COLORS = ["#f26b5f", "#f4a340", "#8d79e8", "#38a88f", "#4d8fd9"];
const COLUMN_COLORS = ["#f8dddd", "#dce8f4", "#dcecdf", "#f3ead1", "#ece2f3", "#e5e7eb", "#d9e8e7", "#ebe6df"];

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
  if (normalized.includes("conclu") || normalized === "feito") return "done";
  if (normalized.includes("setembro")) return "september";
  if (normalized.includes("outubro")) return "october";
  if (normalized.includes("novembro")) return "november";
  if (normalized.includes("dezembro")) return "december";
  return "todo";
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
    return {
      ...workspace,
      plannerNotes: workspace.plannerNotes ?? {},
      plannerSlotColors: workspace.plannerSlotColors ?? {},
    };
  }

  const boards = [...workspace.boards];
  if (!boards.some((board) => normalizeKey(board.title) === "casa")) {
    const italyIndex = boards.findIndex((board) => normalizeKey(board.title) === "italia");
    boards.splice(italyIndex >= 0 ? italyIndex + 1 : boards.length, 0, createBlankBoard("casa", "Casa", "sand"));
  }

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    activeBoardId: boards.some((board) => board.id === workspace.activeBoardId) ? workspace.activeBoardId : boards[0].id,
    boards: boards.map(migrateBoard),
    plannerNotes: workspace.plannerNotes ?? {},
    plannerSlotColors: workspace.plannerSlotColors ?? {},
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
  plannerNotes: {},
  plannerSlotColors: {},
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
      plannerNotes: {},
      plannerSlotColors: {},
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

function SortableCard({
  card,
  onOpen,
  onRename,
}: {
  card: CardItem;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card" }, disabled: editing });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const pointerMoved = useRef(false);

  useEffect(() => {
    if (editing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editing]);

  function finishInlineEdit() {
    const nextTitle = title.trim();
    if (nextTitle && nextTitle !== card.title) onRename(card.id, nextTitle);
    if (!nextTitle) setTitle(card.title);
    setEditing(false);
  }

  const style: CSSProperties = {
    transform: DndCSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? "is-dragging" : ""}`}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`${card.title}. Clique para editar o título ou arraste para mover.`}
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
        if (pointerMoved.current || editing) return;
        setTitle(card.title);
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (!editing && event.key === "Enter") {
          event.preventDefault();
          setTitle(card.title);
          setEditing(true);
          return;
        }
        listeners?.onKeyDown?.(event);
      }}
    >
      {editing ? (
        <input
          ref={titleInputRef}
          className="card-inline-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onBlur={finishInlineEdit}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") { event.preventDefault(); finishInlineEdit(); }
            if (event.key === "Escape") { event.preventDefault(); setTitle(card.title); setEditing(false); }
          }}
          aria-label="Editar título do cartão"
        />
      ) : <h3>{card.title}</h3>}
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
  return (
    <article className="task-card card-ghost">
      <h3>{card.title}</h3>
    </article>
  );
}

function BoardColumn({
  column,
  cards,
  onAdd,
  onOpenCard,
  onRenameCard,
  onEditColumn,
}: {
  column: ColumnItem;
  cards: CardItem[];
  onAdd: (columnId: string) => void;
  onOpenCard: (id: string) => void;
  onRenameCard: (id: string, title: string) => void;
  onEditColumn: (columnId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${column.id}` });

  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver ? "column-over" : ""}`}
      style={{ "--column-accent": column.color } as CSSProperties}
    >
      <div className="column-accent" />
      <header className="column-header">
        <div>
          <h2>{column.title}</h2>
          <span>{cards.length.toString().padStart(2, "0")}</span>
        </div>
        <button
          type="button"
          className="icon-button subtle"
          aria-label={`Editar coluna ${column.title}`}
          onClick={() => onEditColumn(column.id)}
        >
          <MoreHorizontal size={19} />
        </button>
      </header>

      <div className="card-list">
        <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onOpen={onOpenCard} onRename={onRenameCard} />
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

function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);

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

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, commandValue);
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
    <div className="rich-editor-shell">
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
      </div>
      <div
        ref={editorRef}
        className="rich-description-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        data-placeholder="Escreva a descrição, links, listas ou observações…"
        onInput={syncValue}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onFocus={rememberSelection}
        onClick={(event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement && target.type === "checkbox") {
            if (target.checked) target.setAttribute("checked", "");
            else target.removeAttribute("checked");
            window.requestAnimationFrame(syncValue);
          }
        }}
        aria-label="Descrição do cartão"
      />
    </div>
  );
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
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
          <div>
            <span>{card ? "Detalhes do cartão" : "Novo cartão"}</span>
            <h2 id="card-modal-title">{card ? "Editar conteúdo" : "Criar cartão"}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form className="card-drawer-form" onSubmit={handleSubmit}>
          <div className="card-drawer-content">
            <label className="field card-title-field">
              <span>Título</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Ex.: Planejar a próxima semana"
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
                <textarea value={activityText} onChange={(event) => setActivityText(event.target.value)} placeholder="O que você fez? O que ainda falta?" rows={3} />
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

function WeeklySlot({
  slotKey,
  value,
  color,
  isFullHour,
  inputRef,
  onChange,
  onChangeColor,
  onPaste,
  onCopy,
  onKeyDown,
  ariaLabel,
}: {
  slotKey: string;
  value: string;
  color: string;
  isFullHour: boolean;
  inputRef: (node: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
  onChangeColor: (color: string) => void;
  onPaste: (event: ReactClipboardEvent<HTMLInputElement>) => void;
  onCopy: (event: ReactClipboardEvent<HTMLInputElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  ariaLabel: string;
}) {
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

  return (
    <div ref={setDroppableRef} className={`week-slot ${isFullHour ? "is-full-hour" : ""} ${isOver ? "is-over" : ""}`} role="gridcell">
      <div ref={setDraggableRef} className={`week-slot-card ${value ? "has-value" : ""} ${isDragging ? "is-dragging" : ""}`} style={cardStyle}>
        <input
          ref={inputRef}
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
            <button type="button" className="week-card-drag" aria-label="Arrastar compromisso" title="Arrastar para outro horário" {...attributes} {...listeners}><GripVertical size={13} /></button>
            <label className="week-card-color" title="Cor do compromisso" onPointerDown={(event) => event.stopPropagation()}>
              <span style={{ background: color }} />
              <input type="color" value={color} onChange={(event) => onChangeColor(event.target.value)} aria-label="Escolher cor do compromisso" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function WeeklyPlannerGrid({
  days,
  notes,
  colors,
  onChangeNote,
  onChangeColor,
  onMoveSlot,
}: {
  days: Date[];
  notes: Record<string, string>;
  colors: Record<string, string>;
  onChangeNote: (key: string, value: string) => void;
  onChangeColor: (key: string, color: string) => void;
  onMoveSlot: (sourceKey: string, targetKey: string) => void;
}) {
  const cellRefs = useRef(new Map<string, HTMLInputElement>());
  const today = dateKey(new Date());
  const scheduleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
  );

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
    if (sourceKey && targetKey && sourceKey !== targetKey) onMoveSlot(sourceKey, targetKey);
  }

  return (
    <div className="week-planner">
      <DndContext sensors={scheduleSensors} collisionDetection={closestCorners} onDragEnd={handleScheduleDragEnd}>
        <div className="week-schedule-scroll">
          <div className="week-schedule-grid" role="grid" aria-label="Agenda semanal em intervalos de 30 minutos">
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
                      isFullHour={isFullHour}
                      inputRef={(node) => { if (node) cellRefs.current.set(key, node); else cellRefs.current.delete(key); }}
                      onChange={(nextValue) => onChangeNote(key, nextValue)}
                      onChangeColor={(nextColor) => onChangeColor(key, nextColor)}
                      onPaste={(event) => handlePaste(event, row, column)}
                      onCopy={(event) => handleCopy(event, value)}
                      onKeyDown={(event) => handleCellKeyDown(event, row, column)}
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
  onChangeMode,
  onChangeCursor,
  onChangeNote,
  onChangeColor,
  onMoveSlot,
}: {
  mode: PlanningMode;
  cursor: Date;
  notes: Record<string, string>;
  colors: Record<string, string>;
  onChangeMode: (mode: PlanningMode) => void;
  onChangeCursor: (date: Date) => void;
  onChangeNote: (key: string, value: string) => void;
  onChangeColor: (key: string, color: string) => void;
  onMoveSlot: (sourceKey: string, targetKey: string) => void;
}) {
  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(cursor);
  const shiftCursor = (direction: -1 | 1) => {
    if (mode === "week") onChangeCursor(addDays(cursor, direction * 7));
    if (mode === "month") onChangeCursor(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
    if (mode === "year") onChangeCursor(new Date(cursor.getFullYear() + direction, cursor.getMonth(), 1));
  };

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
        <div><span>Planejamento</span><h1>{mode === "year" ? cursor.getFullYear() : monthTitle}</h1></div>
        <div className="planner-navigation">
          <button type="button" aria-label="Período anterior" onClick={() => shiftCursor(-1)}><ArrowLeft size={17} /></button>
          <button type="button" onClick={() => onChangeCursor(new Date())}>Hoje</button>
          <button type="button" aria-label="Próximo período" onClick={() => shiftCursor(1)}><ArrowRight size={17} /></button>
        </div>
      </header>

      {mode === "week" && (
        <WeeklyPlannerGrid days={weekDays} notes={notes} colors={colors} onChangeNote={onChangeNote} onChangeColor={onChangeColor} onMoveSlot={onMoveSlot} />
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
  const [activeView, setActiveView] = useState<"board" | "planning">("board");
  const [planningMode, setPlanningMode] = useState<PlanningMode>("week");
  const [plannerCursor, setPlannerCursor] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [activeDrag, setActiveDrag] = useState<{ boardId: string; cardId: string } | null>(null);
  const [cardModal, setCardModal] = useState<{ boardId: string; mode: "new" | "edit"; columnId: string; cardId?: string } | null>(null);
  const [columnModal, setColumnModal] = useState<{ boardId: string; mode: "new" | "edit"; columnId?: string } | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
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

  function setPlannerSlotColor(key: string, color: string) {
    setWorkspaceState((current) => ({
      ...current,
      plannerSlotColors: { ...current.plannerSlotColors, [key]: color },
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
      return { ...current, activeBoardId: remaining[0].id, boards: remaining };
    });
    setShowCustomizer(false);
    setQuery("");
    setPriorityFilter("all");
  }

  const visibleIdsByBoard = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return new Map(workspaceState.boards.map((project) => {
      const ids = project.cards.filter((card) => {
        const matchesQuery = !normalizedQuery || `${card.title} ${card.description} ${card.label}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
        const matchesPriority = priorityFilter === "all" || card.priority === priorityFilter;
        return matchesQuery && matchesPriority;
      }).map((card) => card.id);
      return [project.id, new Set(ids)];
    }));
  }, [priorityFilter, query, workspaceState.boards]);

  const filteredCardCount = useMemo(
    () => [...visibleIdsByBoard.values()].reduce((total, ids) => total + ids.size, 0),
    [visibleIdsByBoard],
  );
  const highPriorityCount = useMemo(
    () => workspaceState.boards.reduce((total, project) => total + project.cards.filter((card) => card.priority === "high").length, 0),
    [workspaceState.boards],
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
    setActiveDrag({ boardId, cardId: String(event.active.id) });
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

    setBoard((current) => {
      const sourceColumn = findColumnForCard(current, draggedId);
      if (!sourceColumn) return current;
      const overCard = current.cards.find((card) => card.id === overId);
      const targetColumn = overCard
        ? findColumnForCard(current, overCard.id)
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

  function renameCard(boardId: string, cardId: string, title: string) {
    setBoard((current) => ({
      ...current,
      cards: current.cards.map((card) => card.id === cardId ? { ...card, title } : card),
    }), boardId);
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
            <button type="button" className={`top-nav-item ${activeView === "board" && priorityFilter === "high" ? "active" : ""}`} onClick={() => { setActiveView("board"); setPriorityFilter("high"); }}><Sparkles size={17} /><span>Foco</span><em>{highPriorityCount}</em></button>
          </nav>
          {activeView === "board" && <button type="button" className="add-desktop-button" aria-label="Adicionar desktop" title="Adicionar desktop" onClick={() => setShowProjectModal(true)}><Plus size={18} /></button>}
          {activeView === "board" && <div className="search-wrap">
            <Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cartões…" aria-label="Buscar cartões" /><kbd>⌘ K</kbd>
          </div>}
          <div className={`top-actions ${activeView === "planning" ? "push-right" : ""}`}>
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
          <PlanningWorkspace mode={planningMode} cursor={plannerCursor} notes={workspaceState.plannerNotes} colors={workspaceState.plannerSlotColors} onChangeMode={setPlanningMode} onChangeCursor={setPlannerCursor} onChangeNote={setPlannerNote} onChangeColor={setPlannerSlotColor} onMoveSlot={movePlannerSlot} />
        ) : <>
          {(query || priorityFilter !== "all") && (
            <div className="filter-summary"><span>{filteredCardCount} {filteredCardCount === 1 ? "cartão encontrado" : "cartões encontrados"} em todos os desktops</span><button type="button" onClick={() => { setQuery(""); setPriorityFilter("all"); }}>Limpar filtros <X size={14} /></button></div>
          )}

          <DndContext id="vinello-desktop-order" sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDesktopDragEnd}>
            <SortableContext items={workspaceState.boards.map((project) => `desktop-${project.id}`)} strategy={verticalListSortingStrategy}>
              <div className="desktop-stack">
              {workspaceState.boards.map((project) => {
                const visibleIds = visibleIdsByBoard.get(project.id) ?? new Set<string>();
                return (
                  <SortableDesktop key={project.id} project={project} onCustomize={() => { activateBoard(project.id); setShowCustomizer(true); }}>
                <DndContext id={`vinello-board-dnd-${project.id}`} sensors={sensors} collisionDetection={closestCorners} onDragStart={(event) => handleDragStart(project.id, event)} onDragEnd={(event) => handleDragEnd(project.id, event)} onDragCancel={() => setActiveDrag(null)}>
                  <div className="board-scroll desktop-board-scroll" aria-label={`Quadro Kanban ${project.title}`}>
                    {project.columns.map((column) => {
                      const cards = column.cardIds.map((id) => project.cards.find((card) => card.id === id)).filter((card): card is CardItem => Boolean(card && visibleIds.has(card.id)));
                      return <BoardColumn key={column.id} column={column} cards={cards} onAdd={(columnId) => { activateBoard(project.id); setCardModal({ boardId: project.id, mode: "new", columnId }); }} onOpenCard={(cardId) => { activateBoard(project.id); setCardModal({ boardId: project.id, mode: "edit", columnId: column.id, cardId }); }} onRenameCard={(cardId, title) => renameCard(project.id, cardId, title)} onEditColumn={(columnId) => { activateBoard(project.id); setColumnModal({ boardId: project.id, mode: "edit", columnId }); }} />;
                    })}
                    <button type="button" className="add-column-button" aria-label={`Adicionar lista ao desktop ${project.title}`} title="Adicionar outra lista" onClick={() => { activateBoard(project.id); setColumnModal({ boardId: project.id, mode: "new" }); }}><Plus size={18} /></button>
                  </div>
                  <DragOverlay>{activeDrag?.boardId === project.id && activeCard ? <CardGhost card={activeCard} /> : null}</DragOverlay>
                </DndContext>
                  </SortableDesktop>
                );
              })}
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

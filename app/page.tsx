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
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Circle,
  Cloud,
  CloudOff,
  Columns3,
  GripVertical,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  LogIn,
  LogOut,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  FormEvent,
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth, db } from "../src/firebase";

type Priority = "low" | "medium" | "high";
type Theme = "peach" | "lilac" | "ocean" | "midnight";

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
};

type ColumnItem = {
  id: string;
  title: string;
  color: string;
  cardIds: string[];
};

type BoardState = {
  title: string;
  theme: Theme;
  columns: ColumnItem[];
  cards: CardItem[];
};

type SaveStatus = "loading" | "saving" | "saved" | "offline";

const LABEL_COLORS = ["#f26b5f", "#f4a340", "#8d79e8", "#38a88f", "#4d8fd9"];
const COLUMN_COLORS = ["#f47768", "#9b87ef", "#f3b94f", "#4fbea6", "#5f9fe6", "#ef85b2"];

const DEFAULT_BOARD: BoardState = {
  title: "Meu espaço",
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

const THEME_OPTIONS: { id: Theme; name: string; colors: string[] }[] = [
  { id: "peach", name: "Pêssego", colors: ["#f8eee8", "#f3b5a4"] },
  { id: "lilac", name: "Lavanda", colors: ["#efecf8", "#b9aceb"] },
  { id: "ocean", name: "Oceano", colors: ["#e7f2f4", "#8ac6c7"] },
  { id: "midnight", name: "Noturno", colors: ["#252739", "#9b87ef"] },
];

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
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

function formatDueDate(value: string) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(new Date(`${value}T12:00:00`))
    .replace(".", "");
}

function isOverdue(value: string) {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${value}T00:00:00`).getTime() < today.getTime();
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

  const style: CSSProperties = {
    transform: DndCSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${isDragging ? "is-dragging" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(card.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(card.id);
        }
      }}
    >
      <div className="card-topline">
        <span
          className="card-label"
          style={{ "--label-color": card.labelColor } as CSSProperties}
        >
          {card.label || "Sem etiqueta"}
        </span>
        <button
          type="button"
          className="drag-handle"
          aria-label={`Arrastar ${card.title}`}
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      </div>
      <h3>{card.title}</h3>
      {card.description && <p>{card.description}</p>}
      <div className="card-meta">
        {card.dueDate && (
          <span className={isOverdue(card.dueDate) ? "date-overdue" : ""}>
            <CalendarDays size={14} />
            {formatDueDate(card.dueDate)}
          </span>
        )}
        {card.checklistTotal > 0 && (
          <span className={card.checklistDone === card.checklistTotal ? "check-done" : ""}>
            <Check size={14} />
            {card.checklistDone}/{card.checklistTotal}
          </span>
        )}
        <span className={`priority-dot priority-${card.priority}`} title={`Prioridade ${PRIORITY_LABELS[card.priority]}`}>
          <Circle size={9} fill="currentColor" />
        </span>
      </div>
    </div>
  );
}

function CardGhost({ card }: { card: CardItem }) {
  return (
    <article className="task-card card-ghost">
      <span
        className="card-label"
        style={{ "--label-color": card.labelColor } as CSSProperties}
      >
        {card.label || "Sem etiqueta"}
      </span>
      <h3>{card.title}</h3>
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

type CardDraft = Omit<CardItem, "id"> & { columnId: string };

function CardModal({
  card,
  columnId,
  columns,
  onClose,
  onSave,
  onDelete,
  onMove,
}: {
  card?: CardItem;
  columnId: string;
  columns: ColumnItem[];
  onClose: () => void;
  onSave: (draft: CardDraft) => void;
  onDelete?: () => void;
  onMove?: (direction: -1 | 1) => void;
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
    columnId,
  });

  const currentColumnIndex = columns.findIndex((column) => column.id === columnId);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() });
  }

  return (
    <div className="modal-backdrop">
      <button type="button" className="backdrop-dismiss" aria-label="Fechar editor do cartão" onClick={onClose} />
      <section
        className="modal-card card-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
      >
        <div className="modal-heading">
          <div className="modal-icon"><Columns3 size={19} /></div>
          <div>
            <span>{card ? "Editar cartão" : "Novo cartão"}</span>
            <h2 id="card-modal-title">{card ? card.title : "O que precisa ser feito?"}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field full-field">
            <span>Título</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Ex.: Planejar a próxima semana"
              required
            />
          </label>

          <label className="field full-field">
            <span>Descrição</span>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Adicione contexto, links ou pequenas anotações…"
              rows={4}
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>Coluna</span>
              <select value={draft.columnId} onChange={(event) => setDraft({ ...draft, columnId: event.target.value })}>
                {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Prioridade</span>
              <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </label>
            <label className="field">
              <span>Etiqueta</span>
              <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Ex.: Trabalho" />
            </label>
            <label className="field">
              <span>Prazo</span>
              <input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
            </label>
          </div>

          <fieldset className="color-fieldset">
            <legend>Cor da etiqueta</legend>
            <div className="color-row">
              {LABEL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-choice ${draft.labelColor === color ? "selected" : ""}`}
                  style={{ background: color }}
                  aria-label={`Escolher cor ${color}`}
                  onClick={() => setDraft({ ...draft, labelColor: color })}
                >
                  {draft.labelColor === color && <Check size={15} />}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="checklist-fields">
            <span>Checklist</span>
            <label><input type="number" min="0" value={draft.checklistDone} onChange={(event) => setDraft({ ...draft, checklistDone: Math.max(0, Number(event.target.value)) })} /> feitos</label>
            <span>de</span>
            <label><input type="number" min="0" value={draft.checklistTotal} onChange={(event) => setDraft({ ...draft, checklistTotal: Math.max(0, Number(event.target.value)) })} /> itens</label>
          </div>

          <div className="modal-actions">
            <div className="secondary-actions">
              {card && onDelete && (
                <button type="button" className="danger-button" onClick={onDelete}>
                  <Trash2 size={16} /> Excluir
                </button>
              )}
              {card && onMove && (
                <div className="move-actions" aria-label="Mover cartão entre colunas">
                  <button type="button" disabled={currentColumnIndex <= 0} onClick={() => onMove(-1)} aria-label="Mover para a coluna anterior"><ArrowLeft size={17} /></button>
                  <button type="button" disabled={currentColumnIndex >= columns.length - 1} onClick={() => onMove(1)} aria-label="Mover para a próxima coluna"><ArrowRight size={17} /></button>
                </div>
              )}
            </div>
            <button type="button" className="text-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button">{card ? "Salvar alterações" : "Criar cartão"}</button>
          </div>
        </form>
      </section>
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

export default function Home() {
  const [board, setBoard] = useState<BoardState>(DEFAULT_BOARD);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [cardModal, setCardModal] = useState<{ mode: "new" | "edit"; columnId: string; cardId?: string } | null>(null);
  const [columnModal, setColumnModal] = useState<{ mode: "new" | "edit"; columnId?: string } | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const saveRequest = useRef(0);

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
        const payload = snapshot.data() as { state?: BoardState } | undefined;
        if (active && payload?.state) setBoard(payload.state);
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
          { state: board, updatedAt: serverTimestamp() },
          { merge: true },
        );
        if (saveRequest.current === requestNumber) setSaveStatus("saved");
      } catch {
        if (saveRequest.current === requestNumber) setSaveStatus("offline");
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [board, loaded, user]);

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
    setBoard(DEFAULT_BOARD);
    setSaveStatus("loading");
  }

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return board.cards.filter((card) => {
      const matchesQuery = !normalizedQuery || `${card.title} ${card.description} ${card.label}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      const matchesPriority = priorityFilter === "all" || card.priority === priorityFilter;
      return matchesQuery && matchesPriority;
    });
  }, [board.cards, priorityFilter, query]);

  const visibleIds = useMemo(() => new Set(filteredCards.map((card) => card.id)), [filteredCards]);
  const activeCard = board.cards.find((card) => card.id === activeCardId);
  const modalCard = cardModal?.cardId ? board.cards.find((card) => card.id === cardModal.cardId) : undefined;
  const modalColumn = columnModal?.columnId ? board.columns.find((column) => column.id === columnModal.columnId) : undefined;
  const totalCards = board.cards.length;
  const doneColumn = board.columns.find((column) => column.title.toLocaleLowerCase("pt-BR").includes("conclu"));
  const doneCount = doneColumn?.cardIds.length ?? 0;

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const draggedId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveCardId(null);
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
    });
  }

  function saveCard(draft: CardDraft) {
    if (cardModal?.mode === "edit" && cardModal.cardId) {
      const cardId = cardModal.cardId;
      setBoard((current) => {
        const oldColumn = findColumnForCard(current, cardId);
        return {
          ...current,
          cards: current.cards.map((card) => card.id === cardId ? { ...card, ...draft, id: cardId } : card),
          columns: current.columns.map((column) => {
            if (column.id === oldColumn?.id && column.id !== draft.columnId) return { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) };
            if (column.id === draft.columnId && !column.cardIds.includes(cardId)) return { ...column, cardIds: [...column.cardIds, cardId] };
            return column;
          }),
        };
      });
    } else {
      const id = makeId("card");
      setBoard((current) => ({
        ...current,
        cards: [...current.cards, { ...draft, id }],
        columns: current.columns.map((column) => column.id === draft.columnId ? { ...column, cardIds: [...column.cardIds, id] } : column),
      }));
    }
    setCardModal(null);
  }

  function deleteCard(cardId: string) {
    if (!window.confirm("Excluir este cartão?")) return;
    setBoard((current) => ({
      ...current,
      cards: current.cards.filter((card) => card.id !== cardId),
      columns: current.columns.map((column) => ({ ...column, cardIds: column.cardIds.filter((id) => id !== cardId) })),
    }));
    setCardModal(null);
  }

  function moveCard(cardId: string, direction: -1 | 1) {
    setBoard((current) => {
      const source = findColumnForCard(current, cardId);
      if (!source) return current;
      const sourceIndex = current.columns.findIndex((column) => column.id === source.id);
      const target = current.columns[sourceIndex + direction];
      if (!target) return current;
      setCardModal((modal) => modal ? { ...modal, columnId: target.id } : modal);
      return {
        ...current,
        columns: current.columns.map((column) => {
          if (column.id === source.id) return { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) };
          if (column.id === target.id) return { ...column, cardIds: [...column.cardIds, cardId] };
          return column;
        }),
      };
    });
  }

  function saveColumn(title: string, color: string) {
    if (columnModal?.mode === "edit" && columnModal.columnId) {
      setBoard((current) => ({ ...current, columns: current.columns.map((column) => column.id === columnModal.columnId ? { ...column, title, color } : column) }));
    } else {
      setBoard((current) => ({ ...current, columns: [...current.columns, { id: makeId("column"), title, color, cardIds: [] }] }));
    }
    setColumnModal(null);
  }

  function deleteColumn(columnId: string) {
    if (board.columns.length <= 1 || !window.confirm("Excluir esta coluna? Os cartões serão movidos para a primeira coluna.")) return;
    setBoard((current) => {
      const removed = current.columns.find((column) => column.id === columnId);
      const remaining = current.columns.filter((column) => column.id !== columnId);
      if (removed?.cardIds.length) remaining[0] = { ...remaining[0], cardIds: [...remaining[0].cardIds, ...removed.cardIds] };
      return { ...current, columns: remaining };
    });
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
  const displayName = user.displayName?.split(" ")[0] || "Vinicius";

  return (
    <main className={`app-shell theme-${board.theme}`}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div><strong>vinello</strong><span>organize do seu jeito</span></div>
        </div>

        <nav className="main-nav" aria-label="Navegação principal">
          <button type="button" className="nav-item active"><LayoutDashboard size={19} /><span>Meu quadro</span></button>
          <button type="button" className="nav-item" onClick={() => setQuery("")}><CalendarDays size={19} /><span>Planejamento</span></button>
          <button type="button" className="nav-item" onClick={() => setPriorityFilter("high")}><Sparkles size={19} /><span>Foco</span><em>{board.cards.filter((card) => card.priority === "high").length}</em></button>
        </nav>

        <div className="sidebar-section">
          <span className="section-label">Visão geral</span>
          <div className="mini-progress">
            <div><span>Progresso</span><strong>{totalCards ? Math.round((doneCount / totalCards) * 100) : 0}%</strong></div>
            <div className="progress-track"><span style={{ width: `${totalCards ? (doneCount / totalCards) * 100 : 0}%` }} /></div>
            <p>{doneCount} de {totalCards} cartões concluídos</p>
          </div>
        </div>

        <div className="sidebar-bottom">
          <button type="button" className="nav-item" onClick={() => setShowCustomizer(true)}><Palette size={19} /><span>Personalizar</span></button>
          <button type="button" className="profile-row" onClick={handleSignOut} title="Sair da conta"><div className="avatar">{initials}</div><div><strong>{displayName}</strong><span>{user.email}</span></div><LogOut size={16} /></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><strong>vinello</strong></div>
          <div className="search-wrap">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cartões…" aria-label="Buscar cartões" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
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

        <div className="board-toolbar">
          <div className="board-heading">
            <span className="eyebrow">Quadro pessoal <i /></span>
            <h1>{board.title}</h1>
            <p>Organize suas ideias, escolha prioridades e siga no seu ritmo.</p>
          </div>
          <div className="toolbar-actions">
            <div className="popover-wrap">
              <button type="button" className={`secondary-button ${priorityFilter !== "all" ? "button-active" : ""}`} onClick={() => setShowFilters((value) => !value)}><ListFilter size={17} /> Filtrar {priorityFilter !== "all" && <span>1</span>}</button>
              {showFilters && (
                <div className="filter-popover">
                  <div><strong>Filtrar cartões</strong><button type="button" className="icon-button" onClick={() => setShowFilters(false)}><X size={17} /></button></div>
                  <label className={priorityFilter === "all" ? "selected" : ""}><input type="radio" name="priority" checked={priorityFilter === "all"} onChange={() => setPriorityFilter("all")} /> Todas as prioridades</label>
                  {(["high", "medium", "low"] as Priority[]).map((priority) => <label key={priority} className={priorityFilter === priority ? "selected" : ""}><input type="radio" name="priority" checked={priorityFilter === priority} onChange={() => setPriorityFilter(priority)} /><i className={`filter-dot priority-${priority}`} /> {PRIORITY_LABELS[priority]}</label>)}
                </div>
              )}
            </div>
            <button type="button" className="secondary-button customize-button" onClick={() => setShowCustomizer(true)}><SlidersHorizontal size={17} /> Personalizar</button>
            <button type="button" className="primary-button" onClick={() => setCardModal({ mode: "new", columnId: board.columns[0].id })}><Plus size={18} /> Novo cartão</button>
          </div>
        </div>

        {(query || priorityFilter !== "all") && (
          <div className="filter-summary"><span>{filteredCards.length} {filteredCards.length === 1 ? "cartão encontrado" : "cartões encontrados"}</span><button type="button" onClick={() => { setQuery(""); setPriorityFilter("all"); }}>Limpar filtros <X size={14} /></button></div>
        )}

        <DndContext id="vinello-board-dnd" sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveCardId(null)}>
          <div className="board-scroll" aria-label="Quadro Kanban">
            {board.columns.map((column) => {
              const cards = column.cardIds.map((id) => board.cards.find((card) => card.id === id)).filter((card): card is CardItem => Boolean(card && visibleIds.has(card.id)));
              return <BoardColumn key={column.id} column={column} cards={cards} onAdd={(columnId) => setCardModal({ mode: "new", columnId })} onOpenCard={(cardId) => setCardModal({ mode: "edit", columnId: column.id, cardId })} onEditColumn={(columnId) => setColumnModal({ mode: "edit", columnId })} />;
            })}
            <button type="button" className="add-column-button" onClick={() => setColumnModal({ mode: "new" })}><span><Plus size={19} /></span><strong>Adicionar coluna</strong><small>Crie uma nova etapa</small></button>
          </div>
          <DragOverlay>{activeCard ? <CardGhost card={activeCard} /> : null}</DragOverlay>
        </DndContext>

        <footer className="board-footer"><span><GripVertical size={14} /> Arraste os cartões para reorganizar</span><span>{board.columns.length} colunas · {totalCards} cartões</span></footer>
      </section>

      {cardModal && (
        <CardModal
          key={`${cardModal.mode}-${cardModal.cardId ?? cardModal.columnId}`}
          card={modalCard}
          columnId={cardModal.columnId}
          columns={board.columns}
          onClose={() => setCardModal(null)}
          onSave={saveCard}
          onDelete={modalCard ? () => deleteCard(modalCard.id) : undefined}
          onMove={modalCard ? (direction) => moveCard(modalCard.id, direction) : undefined}
        />
      )}

      {columnModal && (
        <ColumnModal
          key={`${columnModal.mode}-${columnModal.columnId ?? "new"}`}
          column={modalColumn}
          canDelete={board.columns.length > 1}
          onClose={() => setColumnModal(null)}
          onSave={saveColumn}
          onDelete={modalColumn ? () => deleteColumn(modalColumn.id) : undefined}
        />
      )}

      {showCustomizer && (
        <div className="customizer-backdrop">
          <button type="button" className="backdrop-dismiss" aria-label="Fechar personalização" onClick={() => setShowCustomizer(false)} />
          <aside className="customizer-panel" role="dialog" aria-modal="true" aria-labelledby="customizer-title">
            <div className="customizer-header"><div><span>Seu espaço, suas regras</span><h2 id="customizer-title">Personalizar quadro</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={() => setShowCustomizer(false)}><X size={20} /></button></div>
            <label className="field full-field"><span>Nome do quadro</span><input value={board.title} onChange={(event) => setBoard((current) => ({ ...current, title: event.target.value }))} /></label>
            <div className="theme-section"><span>Tema do fundo</span><div className="theme-grid">{THEME_OPTIONS.map((theme) => (
              <button key={theme.id} type="button" className={`theme-option ${board.theme === theme.id ? "selected" : ""}`} onClick={() => setBoard((current) => ({ ...current, theme: theme.id }))}>
                <span className="theme-preview" style={{ background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})` }}>{board.theme === theme.id && <Check size={18} />}</span><strong>{theme.name}</strong>
              </button>
            ))}</div></div>
            <div className="customizer-tip"><Sparkles size={20} /><div><strong>Dica de organização</strong><p>Clique nos três pontos de cada coluna para trocar seu nome e sua cor.</p></div></div>
            <button type="button" className="primary-button full-button" onClick={() => setShowCustomizer(false)}>Pronto</button>
          </aside>
        </div>
      )}
    </main>
  );
}

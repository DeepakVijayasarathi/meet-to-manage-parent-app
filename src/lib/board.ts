// Whiteboard model shared with the web classroom (meettomanage/src/features/classroom/
// drawing.ts + Whiteboard.tsx): the same stroke shape and the same BoardOp messages relayed
// verbatim through the classroom hub, so a phone and the teacher's browser draw one board.
// No React Native imports: this runs under `node --test`.

export type ToolId = "pen" | "highlighter" | "eraser" | "rectangle" | "circle" | "line" | "arrow" | "text" | "sticky" | "pan";

export interface Point { x: number; y: number }

export interface Stroke {
  id: string;
  tool: ToolId;
  points: Point[];
  color: string;
  width: number;
  text?: string;
}

/** The emoji activity selection is opaque to the board itself; kept as sent. */
export type ActivitySelection = Record<string, unknown>;

export type BoardOp =
  | { kind: "stroke"; pageIndex: number; stroke: Stroke }
  | { kind: "strokeAppend"; pageIndex: number; strokeId: string; points: Point[] }
  | { kind: "clear"; pageIndex: number }
  | { kind: "addPage"; pageIndex: number }
  | { kind: "removePage"; pageIndex: number }
  | { kind: "goToPage"; pageIndex: number }
  | { kind: "activity"; open: boolean }
  | { kind: "activitySelection"; selection: ActivitySelection }
  | { kind: "maximize"; value: boolean }
  | { kind: "reset" };

export interface Page { id: string; strokes: Stroke[] }

export interface BoardState {
  pages: Page[];
  pageIndex: number;
  activityOpen: boolean;
  activitySelection: ActivitySelection;
  maximized: boolean;
}

let uid = 0;
export const nextId = () => `stroke-${Date.now()}-${uid++}`;

export function emptyBoard(): BoardState {
  return { pages: [{ id: nextId(), strokes: [] }], pageIndex: 0, activityOpen: false, activitySelection: { source: "class" }, maximized: false };
}

// The web's swatches: ink, white, then the chart palette.
export const CHART_PALETTE = ["#1F6FE0", "#57B33B", "#17A9C9", "#F08A1D", "#8B5CF6", "#F53BA6", "#EAB308", "#0D9488"];
export const SWATCHES = ["#0F172A", "#FFFFFF", ...CHART_PALETTE];
export const WIDTHS = [2, 4, 8];
export const HIGHLIGHTER_ALPHA = 0.35;
export const HIGHLIGHTER_WIDTH_FACTOR = 4;
export const STICKY_DEFAULT = "#FDE68A";

export function isFreehand(tool: ToolId): boolean {
  return tool === "pen" || tool === "highlighter" || tool === "eraser";
}

export function textFontPx(width: number): number {
  return Math.max(16, width * 5);
}

function padPages(pages: Page[], index: number): Page[] {
  const next = [...pages];
  while (next.length <= index) next.push({ id: nextId(), strokes: [] });
  return next;
}

/** Applies one remote op exactly as the web Whiteboard does (upsert by id, pad missing pages, clamp navigation). */
export function applyOp(state: BoardState, op: BoardOp): BoardState {
  switch (op.kind) {
    case "stroke": {
      const pages = padPages(state.pages, op.pageIndex).map((p, i) => {
        if (i !== op.pageIndex) return p;
        const at = p.strokes.findIndex((s) => s.id === op.stroke.id);
        if (at === -1) return { ...p, strokes: [...p.strokes, op.stroke] };
        const strokes = [...p.strokes];
        strokes[at] = op.stroke;
        return { ...p, strokes };
      });
      return { ...state, pages };
    }
    case "strokeAppend":
      return {
        ...state,
        pages: state.pages.map((p, i) => {
          if (i !== op.pageIndex) return p;
          const at = p.strokes.findIndex((s) => s.id === op.strokeId);
          // The establishing "stroke" op hasn't arrived: drop the delta (the full stroke still lands later).
          if (at === -1) return p;
          const strokes = [...p.strokes];
          strokes[at] = { ...strokes[at], points: [...strokes[at].points, ...op.points] };
          return { ...p, strokes };
        }),
      };
    case "clear":
      return { ...state, pages: state.pages.map((p, i) => (i === op.pageIndex ? { ...p, strokes: [] } : p)) };
    case "addPage":
      return { ...state, pages: padPages(state.pages, op.pageIndex), pageIndex: op.pageIndex };
    case "removePage": {
      if (state.pages.length <= 1) return state;
      const pages = state.pages.filter((_, i) => i !== op.pageIndex);
      return { ...state, pages, pageIndex: Math.max(0, Math.min(state.pageIndex, pages.length - 1)) };
    }
    case "goToPage":
      return { ...state, pageIndex: Math.max(0, Math.min(op.pageIndex, state.pages.length - 1)) };
    case "activity":
      return { ...state, activityOpen: op.open };
    case "activitySelection":
      return { ...state, activitySelection: op.selection };
    case "maximize":
      return { ...state, maximized: op.value };
    case "reset":
      return emptyBoard();
  }
}

/**
 * Marks the teacher draws on a presented slide (web: slideMarks.ts). They share the hub's
 * Board channel and its late-join replay; coordinates are slide-relative (0..1 of the page,
 * width as a fraction of page width) so a mark lands on the same word on any screen.
 */
export type SlideMarkOp =
  | { kind: "slideStroke"; slide: number; stroke: Stroke }
  | { kind: "slideStrokeAppend"; slide: number; strokeId: string; points: Point[] }
  | { kind: "slideUndo"; slide: number; strokeId: string }
  | { kind: "slideClear"; slide: number }
  // A different deck was uploaded or presenting stopped.
  | { kind: "slideClearAll" };

export type SlideMarks = Record<number, Stroke[]>;

const SLIDE_KINDS = new Set(["slideStroke", "slideStrokeAppend", "slideUndo", "slideClear", "slideClearAll"]);

export function isSlideMarkOp(op: { kind: string }): op is SlideMarkOp {
  return SLIDE_KINDS.has(op.kind);
}

export function applySlideOp(marks: SlideMarks, op: SlideMarkOp): SlideMarks {
  switch (op.kind) {
    case "slideStroke": {
      const strokes = marks[op.slide] ?? [];
      const at = strokes.findIndex((s) => s.id === op.stroke.id);
      return { ...marks, [op.slide]: at === -1 ? [...strokes, op.stroke] : strokes.map((s, i) => (i === at ? op.stroke : s)) };
    }
    case "slideStrokeAppend": {
      const strokes = marks[op.slide] ?? [];
      const at = strokes.findIndex((s) => s.id === op.strokeId);
      if (at === -1) return marks;
      return { ...marks, [op.slide]: strokes.map((s, i) => (i === at ? { ...s, points: [...s.points, ...op.points] } : s)) };
    }
    case "slideUndo":
      return { ...marks, [op.slide]: (marks[op.slide] ?? []).filter((s) => s.id !== op.strokeId) };
    case "slideClear":
      return { ...marks, [op.slide]: [] };
    case "slideClearAll":
      return {};
  }
}

/** Slide-relative stroke → pixels on a page rendered at this size. */
export function toPixels(stroke: Stroke, w: number, h: number): Stroke {
  return { ...stroke, points: stroke.points.map((p) => ({ x: p.x * w, y: p.y * h })), width: stroke.width * w };
}

/** Parses a hub "Board" message; malformed payloads are ignored rather than crashing the class. */
export function parseOp(json: string): BoardOp | SlideMarkOp | null {
  try {
    const op = JSON.parse(json) as BoardOp | SlideMarkOp;
    return op && typeof op === "object" && "kind" in op ? op : null;
  } catch {
    return null;
  }
}

/**
 * Splits an in-progress stroke into the web's wire messages: the first send establishes the
 * stroke whole, later sends carry only new points (shapes are always resent whole, since
 * their second corner is replaced, not appended).
 */
export function strokeUpdate(stroke: Stroke, pageIndex: number, sentCount: number, established: boolean):
  { op: BoardOp | null; sentCount: number; established: boolean } {
  if (!isFreehand(stroke.tool) || !established) {
    return { op: { kind: "stroke", pageIndex, stroke: { ...stroke, points: [...stroke.points] } }, sentCount: stroke.points.length, established: true };
  }
  const fresh = stroke.points.slice(sentCount);
  if (fresh.length === 0) return { op: null, sentCount, established };
  return { op: { kind: "strokeAppend", pageIndex, strokeId: stroke.id, points: fresh }, sentCount: stroke.points.length, established };
}

/** SVG path data for a freehand stroke ("M x y L x y …"). */
export function pathData(points: Point[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/** Arrowhead triangle points for an arrow from a to b (same geometry as the web painter). */
export function arrowHead(a: Point, b: Point, width: number): string {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const head = Math.max(10, width * 3.5);
  const p1 = { x: b.x - head * Math.cos(angle - Math.PI / 7), y: b.y - head * Math.sin(angle - Math.PI / 7) };
  const p2 = { x: b.x - head * Math.cos(angle + Math.PI / 7), y: b.y - head * Math.sin(angle + Math.PI / 7) };
  return `${b.x},${b.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
}

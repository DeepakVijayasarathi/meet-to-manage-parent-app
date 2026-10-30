import Feather from "@expo/vector-icons/Feather";
import { memo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Svg, { Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";

import {
  HIGHLIGHTER_ALPHA, HIGHLIGHTER_WIDTH_FACTOR, STICKY_DEFAULT, SWATCHES, WIDTHS, arrowHead, isFreehand, nextId, pathData, strokeUpdate, textFontPx,
  type BoardOp, type BoardState, type Point, type Stroke, type ToolId,
} from "@/lib/board";
import type { ApiWhiteboardActivity } from "@/api/classroom";
import { fonts, radius, space, useColors } from "@/lib/theme";

import { WhiteboardActivity } from "./WhiteboardActivity";

const PAPER = "#FFFFFF";
const SEND_INTERVAL_MS = 50; // ~20 sends/sec, the web's live-drawing throttle

const TOOLS: { id: ToolId; label: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { id: "pen", label: "Pen", icon: "edit-2" },
  { id: "highlighter", label: "Highlighter", icon: "edit-3" },
  { id: "eraser", label: "Eraser", icon: "delete" },
  { id: "rectangle", label: "Rectangle", icon: "square" },
  { id: "circle", label: "Circle", icon: "circle" },
  { id: "line", label: "Line", icon: "minus" },
  { id: "arrow", label: "Arrow", icon: "arrow-up-right" },
  { id: "text", label: "Text", icon: "type" },
  { id: "sticky", label: "Sticky note", icon: "file" },
  { id: "pan", label: "Move the board", icon: "move" },
];

interface WhiteboardProps {
  board: BoardState;
  /** Whether the teacher has given this child board access (hub "BoardAccess"). */
  canDraw: boolean;
  /** Applies a local op to the board and relays it to the class. */
  onLocalOp: (op: BoardOp) => void;
  onInteraction?: () => void;
  /** The class's activity bank; the activity panel opens over the board (synced "activity" op). */
  activities: ApiWhiteboardActivity[];
  onActivityComplete: () => void;
}

/** The class whiteboard: the teacher's live board, and the child's own drawing when allowed. */
export function Whiteboard({ board, canDraw, onLocalOp, onInteraction, activities, onActivityComplete }: WhiteboardProps) {
  const colors = useColors();
  const [tool, setTool] = useState<ToolId>("pen");
  const [color, setColor] = useState(SWATCHES[2]);
  const [width, setWidth] = useState(4);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [textDraft, setTextDraft] = useState<{ at: Point; sticky: boolean; value: string } | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });

  // In-progress gesture state (never read while rendering).
  const draftRef = useRef<Stroke | null>(null);
  const sendRef = useRef({ last: 0, sentCount: 0, established: false });
  const panStart = useRef<{ x: number; y: number; origin: Point } | null>(null);

  const world = (e: GestureResponderEvent): Point => ({ x: e.nativeEvent.locationX + offset.x, y: e.nativeEvent.locationY + offset.y });

  /** Relays the in-progress stroke at the web's ~20/sec rate: whole once, then new points only. */
  function send(force: boolean) {
    const stroke = draftRef.current;
    if (!stroke) return;
    const now = Date.now();
    if (!force && now - sendRef.current.last < SEND_INTERVAL_MS) return;
    sendRef.current.last = now;
    const update = strokeUpdate(stroke, board.pageIndex, sendRef.current.sentCount, sendRef.current.established);
    sendRef.current.sentCount = update.sentCount;
    sendRef.current.established = update.established;
    if (update.op) onLocalOp(update.op);
  }

  function grant(e: GestureResponderEvent) {
    if (tool === "pan") {
      panStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, origin: offset };
      return;
    }
    const pt = world(e);
    if (tool === "text" || tool === "sticky") {
      setTextDraft({ at: pt, sticky: tool === "sticky", value: "" });
      return;
    }
    draftRef.current = { id: nextId(), tool, points: [pt], color, width };
    sendRef.current = { last: 0, sentCount: 0, established: false };
    setDraft({ ...draftRef.current });
  }

  function move(e: GestureResponderEvent) {
    if (panStart.current) {
      const { x, y, origin } = panStart.current;
      setOffset({ x: origin.x - (e.nativeEvent.pageX - x), y: origin.y - (e.nativeEvent.pageY - y) });
      return;
    }
    const stroke = draftRef.current;
    if (!stroke) return;
    const pt = world(e);
    stroke.points = isFreehand(stroke.tool) ? [...stroke.points, pt] : [stroke.points[0], pt];
    setDraft({ ...stroke });
    send(false);
  }

  function release() {
    panStart.current = null;
    if (!draftRef.current) return;
    send(true);
    // The board itself is updated through the same op path as everyone else's strokes.
    draftRef.current = null;
    setDraft(null);
    onInteraction?.();
  }

  // The View's own responder props: re-created each render, so they always see current state.
  const touch = {
    onStartShouldSetResponder: () => canDraw,
    onMoveShouldSetResponder: () => canDraw,
    onResponderTerminationRequest: () => false,
    onResponderGrant: grant,
    onResponderMove: move,
    onResponderRelease: release,
    onResponderTerminate: release,
  };

  function commitText() {
    if (textDraft?.value.trim()) {
      const stroke: Stroke = {
        id: nextId(),
        tool: textDraft.sticky ? "sticky" : "text",
        points: [textDraft.at],
        color: textDraft.sticky && color === SWATCHES[2] ? STICKY_DEFAULT : color,
        width,
        text: textDraft.value,
      };
      onLocalOp({ kind: "stroke", pageIndex: board.pageIndex, stroke });
      onInteraction?.();
    }
    setTextDraft(null);
  }

  const page = board.pages[board.pageIndex] ?? board.pages[0];
  const pageCount = board.pages.length;
  const goTo = (i: number) => onLocalOp({ kind: "goToPage", pageIndex: Math.max(0, Math.min(i, pageCount - 1)) });

  return (
    <View style={styles.wrap}>
      {canDraw && (
        <View style={[styles.toolbar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolRow}>
            {TOOLS.map((t) => {
              const active = t.id === tool;
              return (
                <Pressable key={t.id} onPress={() => setTool(t.id)} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: active }}
                  style={[styles.toolBtn, active && { backgroundColor: colors.primary }]}>
                  <Feather name={t.icon} size={17} color={active ? "#FFFFFF" : colors.textSoft} />
                </Pressable>
              );
            })}
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
            {SWATCHES.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} accessibilityRole="button" accessibilityLabel={`Colour ${c}`} accessibilityState={{ selected: c === color }}
                style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? colors.primary : colors.border, borderWidth: c === color ? 3 : 1 }]} />
            ))}
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
            {WIDTHS.map((w) => (
              <Pressable key={w} onPress={() => setWidth(w)} accessibilityRole="button" accessibilityLabel={`Thickness ${w}`} accessibilityState={{ selected: w === width }}
                style={[styles.toolBtn, w === width && { backgroundColor: colors.primarySoft }]}>
                <View style={{ width: 18, height: w, borderRadius: w, backgroundColor: colors.text }} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View
        style={[styles.paper, { borderColor: colors.border }]}
        onLayout={(e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        {...touch}
      >
        <Svg width={size.width} height={size.height}>
          <G transform={`translate(${-offset.x}, ${-offset.y})`}>
            <Strokes strokes={page.strokes} />
            {draft && <StrokeShape stroke={draft} />}
          </G>
        </Svg>
        {!canDraw && (
          <View style={styles.viewOnly} pointerEvents="none">
            <Feather name="eye" size={12} color="#6B7280" />
            <Text style={styles.viewOnlyText}>Teacher&apos;s board</Text>
          </View>
        )}
        {textDraft && (
          <TextInput
            autoFocus
            value={textDraft.value}
            onChangeText={(value) => setTextDraft({ ...textDraft, value })}
            onSubmitEditing={commitText}
            onBlur={commitText}
            multiline={textDraft.sticky}
            placeholder={textDraft.sticky ? "Note…" : "Type…"}
            style={[styles.textInput, {
              left: textDraft.at.x - offset.x, top: textDraft.at.y - offset.y, borderColor: colors.primary,
              backgroundColor: textDraft.sticky ? STICKY_DEFAULT : "rgba(255,255,255,0.95)",
              color: textDraft.sticky ? "#0F172A" : color, fontSize: textDraft.sticky ? 13 : textFontPx(width),
            }]}
          />
        )}
      </View>

      {board.activityOpen && (
        <WhiteboardActivity
          activities={activities}
          selection={board.activitySelection}
          // Opening/closing is relayed to the class only by whoever holds board access (useClassroom).
          onClose={() => onLocalOp({ kind: "activity", open: false })}
          onComplete={onActivityComplete}
        />
      )}

      <View style={styles.pager}>
        <Pressable onPress={() => onLocalOp({ kind: "activity", open: !board.activityOpen })} accessibilityRole="button" accessibilityLabel="Activities"
          style={[styles.activityBtn, { backgroundColor: board.activityOpen ? colors.primary : colors.primarySoft }]}>
          <Feather name="star" size={14} color={board.activityOpen ? "#FFFFFF" : colors.primaryInk} />
          <Text style={[styles.activityText, { color: board.activityOpen ? "#FFFFFF" : colors.primaryInk }]}>Activities</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => goTo(board.pageIndex - 1)} disabled={board.pageIndex === 0} accessibilityRole="button" accessibilityLabel="Previous page" style={styles.pageBtn}>
          <Feather name="chevron-left" size={18} color={board.pageIndex === 0 ? colors.border : colors.text} />
        </Pressable>
        <Text style={[styles.pageText, { color: colors.textSoft }]}>Page {board.pageIndex + 1} of {pageCount}</Text>
        <Pressable onPress={() => goTo(board.pageIndex + 1)} disabled={board.pageIndex >= pageCount - 1} accessibilityRole="button" accessibilityLabel="Next page" style={styles.pageBtn}>
          <Feather name="chevron-right" size={18} color={board.pageIndex >= pageCount - 1 ? colors.border : colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/** Committed strokes only re-render when the page's stroke list changes, not on every draft point. */
const Strokes = memo(function Strokes({ strokes }: { strokes: Stroke[] }) {
  return <>{strokes.map((s) => <StrokeShape key={s.id} stroke={s} />)}</>;
});

/** One stroke as SVG. `eraseAs` is the eraser's ink: the paper colour on the board, black inside a slide-mark mask. */
export function StrokeShape({ stroke, eraseAs = PAPER }: { stroke: Stroke; eraseAs?: string }) {
  const isHighlighter = stroke.tool === "highlighter";
  // On the board erasing paints the paper colour: it is a single white sheet, matching the web's look.
  const ink = stroke.tool === "eraser" ? eraseAs : stroke.color;
  const w = isHighlighter ? stroke.width * HIGHLIGHTER_WIDTH_FACTOR : stroke.tool === "eraser" ? stroke.width * 3 : stroke.width;
  const [a, b] = stroke.points;

  if (isFreehand(stroke.tool)) {
    if (stroke.points.length < 2 && a) return <Ellipse cx={a.x} cy={a.y} rx={w / 2} ry={w / 2} fill={ink} opacity={isHighlighter ? HIGHLIGHTER_ALPHA : 1} />;
    return <Path d={pathData(stroke.points)} stroke={ink} strokeWidth={w} strokeLinecap={isHighlighter ? "square" : "round"} strokeLinejoin="round" fill="none" opacity={isHighlighter ? HIGHLIGHTER_ALPHA : 1} />;
  }
  if (!a) return null;
  if ((stroke.tool === "line" || stroke.tool === "arrow") && b) {
    return (
      <>
        <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ink} strokeWidth={w} strokeLinecap="round" />
        {stroke.tool === "arrow" && <Polygon points={arrowHead(a, b, stroke.width)} fill={ink} />}
      </>
    );
  }
  if (stroke.tool === "rectangle" && b) {
    return <Rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} stroke={ink} strokeWidth={w} fill="none" />;
  }
  if (stroke.tool === "circle" && b) {
    return <Ellipse cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} stroke={ink} strokeWidth={w} fill="none" />;
  }
  if (stroke.tool === "text") {
    const size = textFontPx(stroke.width);
    return <SvgText x={a.x} y={a.y + size} fill={ink} fontSize={size} fontWeight="600">{stroke.text ?? ""}</SvgText>;
  }
  if (stroke.tool === "sticky") {
    const lines = (stroke.text ?? "").split("\n");
    const h = Math.max(64, 26 + lines.length * 18);
    return (
      <G>
        <Rect x={a.x} y={a.y} width={168} height={h} rx={8} fill={stroke.color} />
        {lines.map((line, i) => <SvgText key={i} x={a.x + 10} y={a.y + 24 + i * 18} fill="#0F172A" fontSize={13} fontWeight="500">{line}</SvgText>)}
      </G>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: space.sm },
  toolbar: { borderRadius: radius.lg, borderWidth: 1, paddingVertical: 6 },
  toolRow: { alignItems: "center", gap: 6, paddingHorizontal: 8 },
  toolBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  sep: { width: 1, height: 26, marginHorizontal: 4 },
  paper: { flex: 1, backgroundColor: PAPER, borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  viewOnly: { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  viewOnlyText: { fontFamily: fonts.semibold, fontSize: 11, color: "#6B7280" },
  textInput: { position: "absolute", minWidth: 120, maxWidth: 220, padding: 8, borderRadius: 8, borderWidth: 1, fontFamily: fonts.semibold },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  activityBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  activityText: { fontFamily: fonts.semibold, fontSize: 12 },
  pageBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  pageText: { fontFamily: fonts.semibold, fontSize: 13 },
});

// Native port of the web classroom's WhiteboardActivity: the academy's drag & drop, tag & match
// and hotspot activities, the learning-plugin mini-games and H5P content — opened over the
// board, following whatever the teacher picks (hub board ops "activity" / "activitySelection").
import Feather from "@expo/vector-icons/Feather";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type GestureResponderEvent } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { WebView } from "react-native-webview";

import type { ApiActivityItem, ApiWhiteboardActivity } from "@/api/classroom";
import type { ActivitySelection } from "@/lib/board";
import { LEARNING_PLUGINS, normalizeH5pUrl, pluginGame, type LearningPlugin } from "@/lib/learningPlugins";
import { brand, fonts, radius, space, type, useColors } from "@/lib/theme";

type Source = "class" | "plugins" | "h5p";

/** Text-to-speech when the native module is in this build; silent otherwise (never crashes a class). */
function say(text: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Speech = require("expo-speech") as typeof import("expo-speech");
    Speech.stop();
    Speech.speak(text, { rate: 0.82, pitch: 1.08 });
  } catch {
    /* expo-speech not in this native build yet */
  }
}

export function WhiteboardActivity({ activities, selection, onClose, onComplete }: {
  activities: ApiWhiteboardActivity[];
  /** The teacher's pick, synced over the hub. */
  selection: ActivitySelection;
  onClose: () => void;
  onComplete: () => void;
}) {
  const colors = useColors();
  const sel = selection as { source?: Source; pluginId?: string; h5pUrl?: string };
  const [source, setSource] = useState<Source>(sel.source ?? "class");
  const [plugin, setPlugin] = useState<LearningPlugin | null>(null);
  const [activeId, setActiveId] = useState(activities[0]?.id);
  const [query, setQuery] = useState("");

  // Follow the teacher's choice after commit. Updating state while rendering
  // caused an avoidable second render and visible sheet jumps on slower phones.
  useEffect(() => {
    const next = selection as { source?: Source; pluginId?: string };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSource(next.source ?? "class");
    setPlugin(next.pluginId ? LEARNING_PLUGINS.find((p) => p.id === next.pluginId) ?? null : null);
  }, [selection]);
  const active = activities.find((a) => a.id === activeId) ?? activities[0];
  const h5pUrl = sel.h5pUrl ? normalizeH5pUrl(sel.h5pUrl) : "";
  const plugins = useMemo(
    () => LEARNING_PLUGINS.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  return (
    <Animated.View entering={ZoomIn.duration(250)} style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.sources, { backgroundColor: colors.mutedBg }]}>
          {(["class", "plugins", "h5p"] as const).map((s) => (
            <Pressable key={s} onPress={() => { setSource(s); setPlugin(null); }} accessibilityRole="tab" accessibilityState={{ selected: source === s }}
              style={[styles.source, source === s && { backgroundColor: colors.card }]}>
              <Text style={[styles.sourceText, { color: source === s ? colors.primaryInk : colors.muted }]}>
                {s === "class" ? "Activities" : s === "plugins" ? "Games" : "H5P"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close activity"><Feather name="x" size={20} color={colors.muted} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, gap: space.md, paddingBottom: space.lg }} keyboardShouldPersistTaps="handled">
        {source === "class" && (
          <>
            {activities.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {activities.map((a) => (
                  <Pressable key={a.id} onPress={() => setActiveId(a.id)} accessibilityRole="button" accessibilityState={{ selected: active?.id === a.id }}
                    style={[styles.pill, active?.id === a.id ? { backgroundColor: brand.orange } : { backgroundColor: colors.mutedBg }]}>
                    <Text style={[styles.pillText, { color: active?.id === a.id ? "#FFFFFF" : colors.textSoft }]} numberOfLines={1}>{a.prompt}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {!active ? (
              <Empty icon="star" title="No activities yet" body="Your teacher hasn't set up any whiteboard activities for this class yet." />
            ) : active.mode === "DragDrop" ? (
              <DragDrop key={active.id} items={active.items} onComplete={onComplete} />
            ) : active.mode === "TagMatch" ? (
              <TagMatch key={active.id} items={active.items} onComplete={onComplete} />
            ) : (
              <Hotspot key={active.id} prompt={active.prompt} items={active.items} onComplete={onComplete} />
            )}
          </>
        )}

        {source === "plugins" && (plugin ? (
          <View style={{ gap: space.md }}>
            <Pressable onPress={() => setPlugin(null)} style={styles.back} accessibilityRole="button">
              <Feather name="arrow-left" size={14} color={colors.primaryInk} />
              <Text style={[styles.pillText, { color: colors.primaryInk }]}>All games</Text>
            </Pressable>
            {pluginGame(plugin) === "phonics" ? <Phonics key={plugin.id} title={plugin.name} onComplete={onComplete} />
              : pluginGame(plugin) === "abacus" ? <Abacus key={plugin.id} title={plugin.name} onComplete={onComplete} />
              : <Challenge key={plugin.id} plugin={plugin} onComplete={onComplete} />}
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <TextInput value={query} onChangeText={setQuery} placeholder="Search phonics, abacus, art, coding…" placeholderTextColor={colors.muted}
              style={[styles.search, { backgroundColor: colors.mutedBg, color: colors.text }]} />
            {plugins.map((p) => (
              <Pressable key={p.id} onPress={() => setPlugin(p)} accessibilityRole="button"
                style={({ pressed }) => [styles.pluginRow, { borderColor: colors.border }, pressed && { backgroundColor: colors.mutedBg }]}>
                <Text style={styles.pluginEmoji}>{p.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pluginName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[type.caption, { color: colors.muted }]}>{p.type === "resource" ? "Resource" : p.type === "game" ? "Game" : "Game + resource"}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ))}

        {source === "h5p" && (h5pUrl ? (
          <View style={[styles.h5p, { borderColor: colors.border }]}>
            <WebView source={{ uri: h5pUrl }} originWhitelist={["https://*"]} javaScriptEnabled domStorageEnabled
              mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback style={{ flex: 1 }} />
          </View>
        ) : (
          <Empty icon="external-link" title="Waiting for your teacher" body="When your teacher shares an H5P activity, it opens here." />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function Empty({ icon, title, body }: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; body: string }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.mutedBg }]}><Feather name={icon} size={22} color={colors.muted} /></View>
      <Text style={[type.heading, { color: colors.text, textAlign: "center" }]}>{title}</Text>
      <Text style={[type.caption, { color: colors.muted, textAlign: "center", maxWidth: 260 }]}>{body}</Text>
    </View>
  );
}

function Done({ message }: { message: string }) {
  const colors = useColors();
  return (
    <Animated.View entering={ZoomIn} style={styles.done} accessibilityLiveRegion="polite">
      <Text style={{ fontSize: 40 }}>🎉</Text>
      <Text style={[styles.doneText, { color: colors.success }]}>{message}</Text>
    </Animated.View>
  );
}

/** A short horizontal wiggle for a wrong answer. */
function useShake(): [string | null, (id: string) => void] {
  const [id, setId] = useState<string | null>(null);
  const shake = (next: string) => { setId(next); setTimeout(() => setId(null), 450); };
  return [id, shake];
}

function useOnceComplete(done: boolean, onComplete: () => void) {
  const fired = useRef(false);
  useEffect(() => {
    if (done && !fired.current) { fired.current = true; onComplete(); }
  }, [done, onComplete]);
}

type Rect = { x: number; y: number; w: number; h: number };

/** Drag a piece onto its match — or tap a piece, then tap its match (web offers both). */
function DragDrop({ items, onComplete }: { items: ApiActivityItem[]; onComplete: () => void }) {
  const colors = useColors();
  const [matched, setMatched] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [shakeId, shake] = useShake();
  const targets = useRef<Record<string, Rect>>({});
  const targetRefs = useRef<Record<string, ComponentRef<typeof View> | null>>({});
  // The dragged emoji is drawn inside this container, so screen coordinates are offset by its position.
  const box = useRef<ComponentRef<typeof View>>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const startAt = useRef({ x: 0, y: 0 });
  const allDone = items.length > 0 && items.every((i) => matched[i.id]);
  useOnceComplete(allDone, onComplete);

  function measureTargets() {
    for (const [id, node] of Object.entries(targetRefs.current)) {
      node?.measureInWindow((x, y, w, h) => { targets.current[id] = { x, y, w, h }; });
    }
  }
  const hit = (px: number, py: number) =>
    Object.entries(targets.current).find(([, r]) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)?.[0] ?? null;

  function attempt(itemId: string, targetId: string | null) {
    if (!targetId || matched[itemId]) return;
    if (targetId === itemId) setMatched((m) => ({ ...m, [itemId]: true }));
    else shake(itemId);
  }

  const pieceTouch = (id: string) => ({
    onStartShouldSetResponder: () => !matched[id],
    onMoveShouldSetResponder: () => !matched[id],
    onResponderGrant: (e: GestureResponderEvent) => {
      measureTargets();
      box.current?.measureInWindow((x, y) => setOrigin({ x, y }));
      startAt.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      setDrag({ id, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
    },
    onResponderMove: (e: GestureResponderEvent) => {
      setDrag({ id, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
      setOver(hit(e.nativeEvent.pageX, e.nativeEvent.pageY));
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const target = hit(e.nativeEvent.pageX, e.nativeEvent.pageY);
      // Under ~10px of travel counts as a tap, which selects the piece (the tap-then-tap path).
      const moved = Math.hypot(e.nativeEvent.pageX - startAt.current.x, e.nativeEvent.pageY - startAt.current.y) > 10;
      if (target) attempt(id, target);
      else if (!moved) setSelected((s) => (s === id ? null : id)); // a tap selects
      setDrag(null);
      setOver(null);
    },
    onResponderTerminate: () => { setDrag(null); setOver(null); },
  });

  if (items.length === 0) return null;
  if (allDone) return <Done message="All matched — great job!" />;
  const dragged = items.find((i) => i.id === drag?.id);

  return (
    <View ref={box} style={{ gap: space.lg }}>
      <Text style={[styles.instruction, { color: colors.text }]}>🎯 Drag each piece to its match — or tap a piece, then tap its match</Text>
      <View style={styles.wrap}>
        {items.filter((i) => !matched[i.id]).map((item) => (
          <View key={item.id} {...pieceTouch(item.id)} accessible accessibilityRole="button" accessibilityLabel={`${item.emoji}, matches ${item.label}`}
            style={[styles.piece, { backgroundColor: colors.mutedBg }, selected === item.id && { borderColor: brand.orange, transform: [{ scale: 1.1 }] },
              shakeId === item.id && { borderColor: colors.danger }, drag?.id === item.id && { opacity: 0.3 }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
        ))}
      </View>
      <View style={styles.wrap}>
        {items.map((item) => (
          <Pressable key={item.id} ref={(n) => { targetRefs.current[item.id] = n; }} onLayout={measureTargets}
            onPress={() => { if (selected) { attempt(selected, item.id); setSelected(null); } }} disabled={matched[item.id]}
            accessibilityRole="button" accessibilityLabel={`Match ${item.label}`}
            style={[styles.target, matched[item.id] ? { borderColor: colors.success, backgroundColor: colors.successSoft, borderStyle: "solid" }
              : over === item.id ? { borderColor: brand.orange, backgroundColor: colors.primarySoft } : { borderColor: colors.border }]}>
            <Text style={[styles.targetText, { color: matched[item.id] ? colors.success : colors.textSoft }]}>{matched[item.id] ? item.emoji : item.label}</Text>
          </Pressable>
        ))}
      </View>
      {dragged && drag && (
        <View pointerEvents="none" style={[styles.ghost, { left: 0, top: 0, transform: [{ translateX: drag.x - origin.x - 28 }, { translateY: drag.y - origin.y - 28 }] }]}>
          <Text style={{ fontSize: 40 }}>{dragged.emoji}</Text>
        </View>
      )}
    </View>
  );
}

function TagMatch({ items, onComplete }: { items: ApiActivityItem[]; onComplete: () => void }) {
  const colors = useColors();
  const [selected, setSelected] = useState<string | null>(null);
  const [paired, setPaired] = useState<Record<string, boolean>>({});
  const [shakeId, shake] = useShake();
  const allDone = items.length > 0 && items.every((i) => paired[i.id]);
  useOnceComplete(allDone, onComplete);
  if (items.length === 0) return null;
  if (allDone) return <Done message="Every pair tagged — brilliant!" />;
  return (
    <View style={{ gap: space.lg }}>
      <Text style={[styles.instruction, { color: colors.text }]}>🏷️ Tap a piece, then tap its matching pair</Text>
      <View style={styles.wrap}>
        {items.filter((i) => !paired[i.id]).map((item) => (
          <Pressable key={item.id} onPress={() => setSelected(item.id)} accessibilityRole="button" accessibilityState={{ selected: selected === item.id }}
            style={[styles.piece, { backgroundColor: colors.mutedBg }, selected === item.id && { borderColor: brand.orange, transform: [{ scale: 1.1 }] }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.wrap}>
        {items.map((item) => (
          <Pressable key={item.id} disabled={paired[item.id]} accessibilityRole="button"
            onPress={() => {
              if (!selected) return;
              if (selected === item.id) { setPaired((p) => ({ ...p, [item.id]: true })); setSelected(null); } else shake(item.id);
            }}
            style={[styles.target, paired[item.id] ? { borderColor: colors.success, backgroundColor: colors.successSoft, borderStyle: "solid" }
              : shakeId === item.id ? { borderColor: colors.danger } : { borderColor: colors.border }]}>
            <Text style={[styles.targetText, { color: paired[item.id] ? colors.success : shakeId === item.id ? colors.danger : colors.textSoft }]}>{paired[item.id] ? item.emoji : item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Hotspot({ prompt, items, onComplete }: { prompt: string; items: ApiActivityItem[]; onComplete: () => void }) {
  const colors = useColors();
  const [found, setFound] = useState<Record<string, boolean>>({});
  const [shakeId, shake] = useShake();
  const targets = items.filter((i) => i.isTarget);
  const allDone = targets.length > 0 && targets.every((t) => found[t.id]);
  useOnceComplete(allDone, onComplete);
  if (items.length === 0) return null;
  if (allDone) return <Done message="Found them all — amazing!" />;
  return (
    <View style={{ gap: space.lg }}>
      <Text style={[styles.instruction, { color: colors.text }]}>🔍 {prompt} ({targets.filter((t) => found[t.id]).length}/{targets.length} found)</Text>
      <View style={styles.wrap}>
        {items.map((spot) => (
          <Pressable key={spot.id} accessibilityRole="button" onPress={() => { if (found[spot.id]) return; if (spot.isTarget) setFound((f) => ({ ...f, [spot.id]: true })); else shake(spot.id); }}
            style={[styles.piece, { backgroundColor: found[spot.id] ? colors.successSoft : colors.mutedBg },
              found[spot.id] && { borderColor: colors.success }, shakeId === spot.id && { borderColor: colors.danger }]}>
            <Text style={styles.emoji}>{spot.emoji}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const PHONICS = [
  { sound: "B says buh, like ball", answer: "B", choices: ["B", "D", "P"] },
  { sound: "M says mmm, like moon", answer: "M", choices: ["N", "M", "W"] },
  { sound: "S says sss, like sun", answer: "S", choices: ["C", "Z", "S"] },
  { sound: "F says fff, like fish", answer: "F", choices: ["V", "T", "F"] },
  { sound: "A says ah, like apple", answer: "A", choices: ["E", "O", "A"] },
];

function Phonics({ title, onComplete }: { title: string; onComplete: () => void }) {
  const colors = useColors();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("");
  useOnceComplete(score === 5, onComplete);
  const item = PHONICS[round % PHONICS.length];
  if (score === 5) return <Done message="Five sounds matched — fantastic phonics!" />;
  function answer(letter: string) {
    if (letter !== item.answer) { setMessage("Try again — listen closely!"); say(item.sound); return; }
    setScore((s) => s + 1);
    setMessage("Correct! ⭐");
    setTimeout(() => { setRound((r) => r + 1); setMessage(""); }, 650);
  }
  return (
    <View style={styles.game}>
      <Text style={[styles.gameTag, { color: colors.primaryInk }]}>{title} · {score}/5</Text>
      <Text style={[styles.gameTitle, { color: colors.text }]}>Which letter makes this sound?</Text>
      <Pressable onPress={() => say(item.sound)} style={styles.listen} accessibilityRole="button">
        <Feather name="volume-2" size={18} color="#FFFFFF" /><Text style={styles.listenText}>Listen</Text>
      </Pressable>
      <View style={styles.wrap}>
        {item.choices.map((c) => (
          <Pressable key={c} onPress={() => answer(c)} accessibilityRole="button" style={[styles.letter, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.letterText, { color: colors.text }]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
    </View>
  );
}

function Abacus({ title, onComplete }: { title: string; onComplete: () => void }) {
  const colors = useColors();
  const [target, setTarget] = useState(() => Math.floor(Math.random() * 9) + 1);
  const [moved, setMoved] = useState<Set<number>>(new Set());
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("");
  useOnceComplete(score === 5, onComplete);
  if (score === 5) return <Done message="Five numbers built — amazing abacus work!" />;
  const toggle = (i: number) => setMoved((m) => { const n = new Set(m); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  function check() {
    if (moved.size !== target) { setMessage(`You moved ${moved.size}. Try showing ${target}.`); return; }
    setScore((s) => s + 1);
    setMessage("Correct! ⭐");
    setTimeout(() => { setTarget(Math.floor(Math.random() * 9) + 1); setMoved(new Set()); setMessage(""); }, 650);
  }
  return (
    <View style={styles.game}>
      <Text style={[styles.gameTag, { color: colors.primaryInk }]}>{title} · {score}/5</Text>
      <Text style={[styles.gameTitle, { color: colors.text }]}>Move {target} beads</Text>
      <Pressable onPress={() => say(`Move ${target} beads`)} style={styles.hear} accessibilityRole="button">
        <Feather name="volume-2" size={14} color={colors.primaryInk} /><Text style={[styles.pillText, { color: colors.primaryInk }]}>Hear number</Text>
      </Pressable>
      <View style={styles.frame}>
        {[0, 1].map((row) => (
          <View key={row} style={styles.rod}>
            {[0, 1, 2, 3, 4].map((col) => {
              const i = row * 5 + col;
              const on = moved.has(i);
              return <Pressable key={i} onPress={() => toggle(i)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={[styles.bead, { backgroundColor: on ? "#7C3AED" : "#F97316", transform: [{ translateX: on ? 14 : 0 }] }]} />;
            })}
          </View>
        ))}
      </View>
      <Pressable onPress={check} style={styles.listen} accessibilityRole="button"><Text style={styles.listenText}>Check {moved.size} beads</Text></Pressable>
      <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
    </View>
  );
}

const QUICK_TASKS = ["Show one example to the class.", "Explain this skill in your own words.", "Work with a partner and create a mini challenge.", "Demonstrate the skill without speaking.", "Name three places this skill is useful."];

function Challenge({ plugin, onComplete }: { plugin: LearningPlugin; onComplete: () => void }) {
  const colors = useColors();
  const [task, setTask] = useState(0);
  const [done, setDone] = useState(false);
  if (done) return <Done message={`${plugin.name} challenge complete!`} />;
  return (
    <View style={styles.game}>
      <Text style={{ fontSize: 40 }}>{plugin.emoji}</Text>
      <Text style={[styles.gameTitle, { color: colors.text }]}>{plugin.name}</Text>
      <Animated.View entering={FadeIn} key={task} style={[styles.task, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.gameTag, { color: colors.primaryInk }]}>Class challenge</Text>
        <Text style={[styles.taskText, { color: colors.text }]}>{QUICK_TASKS[task]}</Text>
      </Animated.View>
      <View style={styles.wrap}>
        <Pressable onPress={() => say(`${plugin.name}. ${QUICK_TASKS[task]}`)} style={[styles.outline, { borderColor: colors.border }]} accessibilityRole="button">
          <Feather name="volume-2" size={14} color={colors.text} /><Text style={[styles.pillText, { color: colors.text }]}>Hear it</Text>
        </Pressable>
        <Pressable onPress={() => setTask((t) => (t + 1) % QUICK_TASKS.length)} style={[styles.outline, { borderColor: colors.border }]} accessibilityRole="button">
          <Feather name="shuffle" size={14} color={colors.text} /><Text style={[styles.pillText, { color: colors.text }]}>New challenge</Text>
        </Pressable>
        <Pressable onPress={() => { setDone(true); onComplete(); }} style={styles.listen} accessibilityRole="button">
          <Feather name="check" size={14} color="#FFFFFF" /><Text style={styles.listenText}>Mark complete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { ...StyleSheet.absoluteFill, borderRadius: radius.lg, borderWidth: 1, padding: space.md, gap: space.md, zIndex: 5 },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  sources: { flex: 1, flexDirection: "row", borderRadius: radius.pill, padding: 3 },
  source: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: radius.pill },
  sourceText: { fontFamily: fonts.semibold, fontSize: 12 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 200 },
  pillText: { fontFamily: fonts.semibold, fontSize: 12 },
  back: { flexDirection: "row", alignItems: "center", gap: 4 },
  instruction: { fontFamily: fonts.semibold, fontSize: 14, textAlign: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.md },
  piece: { borderRadius: radius.md, padding: 10, borderWidth: 2, borderColor: "transparent" },
  emoji: { fontSize: 34, lineHeight: 40 },
  target: { minWidth: 58, height: 58, borderRadius: radius.md, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  targetText: { fontFamily: fonts.bold, fontSize: 18 },
  ghost: { position: "absolute" },
  search: { borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 14 },
  pluginRow: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md },
  pluginEmoji: { fontSize: 26 },
  pluginName: { fontFamily: fonts.semibold, fontSize: 14 },
  h5p: { flex: 1, minHeight: 320, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.xl },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  done: { alignItems: "center", gap: space.sm, paddingVertical: space.xl },
  doneText: { fontFamily: fonts.bold, fontSize: 16, textAlign: "center" },
  game: { alignItems: "center", gap: space.md },
  gameTag: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  gameTitle: { fontFamily: fonts.bold, fontSize: 20, textAlign: "center" },
  listen: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: brand.orange, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10 },
  listenText: { fontFamily: fonts.bold, fontSize: 14, color: "#FFFFFF" },
  hear: { flexDirection: "row", alignItems: "center", gap: 4 },
  letter: { width: 76, height: 76, borderRadius: radius.lg, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  letterText: { fontFamily: fonts.bold, fontSize: 30 },
  message: { fontFamily: fonts.semibold, fontSize: 14, minHeight: 20 },
  frame: { borderWidth: 8, borderColor: "#92400E", backgroundColor: "#FEF3C7", borderRadius: radius.md, padding: 10, gap: 8 },
  rod: { flexDirection: "row", gap: 6, borderBottomWidth: 4, borderBottomColor: "#B45309", paddingVertical: 4, paddingRight: 16 },
  bead: { width: 34, height: 34, borderRadius: 12 },
  task: { alignSelf: "stretch", borderRadius: radius.lg, padding: space.xl, alignItems: "center", gap: space.sm },
  taskText: { fontFamily: fonts.semibold, fontSize: 17, textAlign: "center" },
  outline: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
});

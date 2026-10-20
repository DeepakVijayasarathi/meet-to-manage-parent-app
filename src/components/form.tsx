// Form controls for the enrollment flow, styled to match ui.tsx (white surfaces, logo orange).
import Feather from "@expo/vector-icons/Feather";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isoDate } from "@/lib/enrollment";
import { formatDate } from "@/lib/format";
import { fonts, radius, space, type, useColors } from "@/lib/theme";

export function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: error ? colors.danger : colors.textSoft }]}>
        {label}{required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      {children}
      {hint && !error ? <Text style={[type.caption, { color: colors.muted }]}>{hint}</Text> : null}
      {error ? <Text style={[type.caption, { color: colors.danger }]} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

export function TextField({ error, multiline, style, ...props }: TextInputProps & { error?: boolean }) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
      placeholderTextColor={colors.muted}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={[
        styles.input,
        multiline && styles.multiline,
        { color: colors.text, backgroundColor: focused ? colors.card : colors.mutedBg, borderColor: error ? colors.danger : focused ? colors.primary : colors.mutedBg },
        style,
      ]}
    />
  );
}

/** Single-choice pills (gender, relationship, days per week…); `multi` toggles several. */
export function Pills<T extends string | number>({ options, value, onChange, disabled }: {
  options: { value: T; label: string }[];
  value: T | T[] | null;
  onChange: (v: T) => void;
  disabled?: (v: T) => boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.pills}>
      {options.map((o) => {
        const active = Array.isArray(value) ? value.includes(o.value) : value === o.value;
        const off = !active && disabled?.(o.value);
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            disabled={off}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: !!off }}
            style={[styles.pill, active
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.card, borderColor: colors.border, opacity: off ? 0.4 : 1 }]}
          >
            {active && <Feather name="check" size={14} color="#FFFFFF" />}
            <Text style={[type.label, { color: active ? "#FFFFFF" : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Native date picker: Android's dialog, iOS's calendar in a sheet, a typed date on web. */
export function DateField({ value, onChange, placeholder, minimumDate, maximumDate, error }: {
  value: string; onChange: (iso: string) => void; placeholder: string; minimumDate?: Date; maximumDate?: Date; error?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const current = value ? new Date(`${value}T00:00:00`) : maximumDate ?? minimumDate ?? new Date();

  if (Platform.OS === "web") {
    return <TextField value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" error={error} />;
  }
  const show = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current, mode: "date", minimumDate, maximumDate,
        onChange: (e, d) => { if (e.type === "set" && d) onChange(isoDate(d)); },
      });
    } else setOpen(true);
  };
  return (
    <>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={value ? formatDate(`${value}T00:00:00`, { day: "numeric", month: "long", year: "numeric" }) : placeholder}
        style={[styles.input, styles.select, { backgroundColor: colors.mutedBg, borderColor: error ? colors.danger : colors.mutedBg }]}
      >
        <Feather name="calendar" size={17} color={colors.muted} />
        <Text style={[styles.selectText, { color: value ? colors.text : colors.muted }]}>
          {value ? formatDate(`${value}T00:00:00`, { day: "numeric", month: "long", year: "numeric" }) : placeholder}
        </Text>
      </Pressable>
      {Platform.OS === "ios" && (
        <Sheet visible={open} onClose={() => setOpen(false)} title={placeholder}>
          <DateTimePicker value={current} mode="date" display="inline" minimumDate={minimumDate} maximumDate={maximumDate} accentColor={colors.primary}
            onChange={(_, d) => { if (d) { onChange(isoDate(d)); setOpen(false); } }} />
        </Sheet>
      )}
    </>
  );
}

/** A tappable field that opens a bottom sheet of options (long lists like time slots). */
export function SelectField({ value, options, onChange, placeholder, title, disabled, error }: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder: string; title: string;
  disabled?: (v: string) => boolean; error?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${selected?.label ?? placeholder}`}
        style={[styles.input, styles.select, { backgroundColor: colors.mutedBg, borderColor: error ? colors.danger : colors.mutedBg }]}
      >
        <Text style={[styles.selectText, { color: selected ? colors.text : colors.muted }]}>{selected?.label ?? placeholder}</Text>
        <Feather name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <ScrollView style={{ maxHeight: 420 }}>
          {options.map((o) => {
            const active = o.value === value;
            const off = !active && disabled?.(o.value);
            return (
              <Pressable
                key={o.value}
                disabled={off}
                onPress={() => { onChange(o.value); setOpen(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !!off }}
                style={({ pressed }) => [styles.option, active && { backgroundColor: colors.primarySoft }, pressed && { backgroundColor: colors.mutedBg }]}
              >
                <Text style={[type.body, { color: off ? colors.muted : active ? colors.primaryInk : colors.text, fontFamily: active ? fonts.semibold : fonts.regular }]}>
                  {o.label}{off ? "  (already chosen)" : ""}
                </Text>
                {active && <Feather name="check" size={18} color={colors.primaryInk} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + space.lg }]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <Text style={[type.heading, { color: colors.text, flex: 1 }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Feather name="x" size={20} color={colors.muted} />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function CheckRow({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.check, { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.mutedBg }]}
    >
      <View style={[styles.box, checked ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.muted }]}>
        {checked && <Feather name="check" size={14} color="#FFFFFF" />}
      </View>
      <Text style={[type.caption, { color: colors.textSoft, flex: 1, lineHeight: 18, fontSize: 13 }]}>{children}</Text>
    </Pressable>
  );
}

/** Numbered progress across the form's steps. */
export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  const colors = useColors();
  return (
    <View style={styles.stepper} accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} style={styles.step}>
            <View style={styles.stepTop}>
              <View style={[styles.line, { backgroundColor: i === 0 ? "transparent" : i <= current ? colors.primary : colors.border }]} />
              <View style={[styles.dotStep, done || active
                ? { backgroundColor: done ? colors.primary : colors.card, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border }]}>
                {done ? <Feather name="check" size={14} color="#FFFFFF" />
                  : <Text style={[styles.stepNum, { color: active ? colors.primaryInk : colors.muted }]}>{i + 1}</Text>}
              </View>
              <View style={[styles.line, { backgroundColor: i === steps.length - 1 ? "transparent" : i < current ? colors.primary : colors.border }]} />
            </View>
            <Text style={[styles.stepLabel, { color: active ? colors.text : colors.muted, fontFamily: active ? fonts.semibold : fonts.medium }]} numberOfLines={2}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 54, fontFamily: fonts.medium, fontSize: 16 },
  multiline: { minHeight: 96, paddingTop: 14, paddingBottom: 14 },
  select: { flexDirection: "row", alignItems: "center", gap: space.sm },
  selectText: { flex: 1, fontFamily: fonts.medium, fontSize: 16 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  backdrop: { flex: 1, backgroundColor: "rgba(16,24,40,0.35)" },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: space.sm },
  sheetHeader: { flexDirection: "row", alignItems: "center", paddingBottom: space.sm },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.md, paddingVertical: 14, borderRadius: radius.md },
  check: { flexDirection: "row", gap: space.md, alignItems: "flex-start", borderWidth: 1, borderRadius: radius.md, padding: space.md },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepper: { flexDirection: "row" },
  step: { flex: 1, alignItems: "center", gap: 6 },
  stepTop: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
  line: { flex: 1, height: 2 },
  dotStep: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stepNum: { fontFamily: fonts.bold, fontSize: 13 },
  stepLabel: { fontSize: 12, textAlign: "center", paddingHorizontal: 4 },
});

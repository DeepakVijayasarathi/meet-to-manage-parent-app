import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, type Href } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorMessage } from "@/api/client";

import { getChildren, getDashboard, getPendingFeedback, getSchedule } from "@/api/parent";
import type { ApiClassSession, ApiParentChildSummary } from "@/api/types";
import { Appear, Badge, Button, Card, EmptyState, IconTile, Logo, SectionHeader, Skeleton, StatCard, type IconName, type Tone } from "@/components/ui";
import { SessionRow, dayLabel } from "@/components/sessions";
import { belongsToChild, classTitle, countdownLabel, isJoinable, isLive, joinDisplayName, nextClass } from "@/lib/schedule";
import { brand, fonts, layout, radius, space, type, useColors, type Colors } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/tabBar";
import { useAppConfig } from "@/state/appConfig";
import { useRequiredSession, useSession } from "@/state/session";

const DAYS = 14;
const UPCOMING_LIMIT = 6;
const RECENT_LIMIT = 5;

const FEE: Record<ApiParentChildSummary["feeStatus"], { label: string; tone: Tone; note: string }> = {
  paid: { label: "Paid", tone: "success", note: "All caught up" },
  due: { label: "Due", tone: "warning", note: "Pay on the website" },
  overdue: { label: "Overdue", tone: "danger", note: "Please pay soon" },
  suspended: { label: "On hold", tone: "danger", note: "Contact your academy" },
};

const QUICK_LINKS: { key: "reports" | "resources" | "recordings" | "support"; label: string; icon: IconName; tone: Tone; href: Href }[] = [
  { key: "reports", label: "Progress reports", icon: "file-text", tone: "brand", href: "/reports" as Href },
  { key: "resources", label: "Resources", icon: "book-open", tone: "info", href: "/resources" as Href },
  { key: "recordings", label: "Recordings", icon: "play-circle", tone: "success", href: "/recordings" as Href },
  { key: "support", label: "Get help", icon: "life-buoy", tone: "warning", href: "/support" as Href },
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const tabBarSpace = useTabBarSpace();
  const { signOut } = useSession();
  const session = useRequiredSession();
  const { announcement, config } = useAppConfig();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const dashboard = useQuery({ queryKey: ["dashboard", session.token], queryFn: () => getDashboard(session.token) });
  const children = useQuery({ queryKey: ["children", session.token], queryFn: () => getChildren(session.token) });
  const schedule = useQuery({
    queryKey: ["schedule", session.token],
    queryFn: () => getSchedule(session.token, new Date(Date.now() - DAYS * 86_400_000), new Date(Date.now() + DAYS * 86_400_000)),
  });

  const feedback = useQuery({ queryKey: ["feedback", session.token], queryFn: () => getPendingFeedback(session.token) });
  const summaries = dashboard.data?.children ?? [];
  const child = summaries.find((c) => c.childId === selectedId) ?? summaries[0];
  const family = useMemo(() => children.data ?? [], [children.data]);
  const firstName = session.userName.split(" ")[0] || "there";
  const childFirst = child?.name.split(" ")[0];

  // Measured against when the schedule was fetched; pull-to-refresh moves it on.
  const fetchedAt = schedule.dataUpdatedAt;
  const { next, upcoming, recent } = useMemo(() => {
    const now = new Date(fetchedAt);
    const mine = (schedule.data ?? []).filter((s) => !child || belongsToChild(s, child.childId, family));
    const ahead = mine
      .filter((s) => new Date(s.scheduledEndAtUtc).getTime() > now.getTime() || isLive(s, now))
      .sort((a, b) => a.scheduledStartAtUtc.localeCompare(b.scheduledStartAtUtc));
    const nextUp = nextClass(ahead, now);
    return {
      next: nextUp,
      upcoming: ahead.filter((s) => s.id !== nextUp?.id).slice(0, UPCOMING_LIMIT),
      recent: mine
        .filter((s) => s.status === "Completed")
        .sort((a, b) => b.scheduledStartAtUtc.localeCompare(a.scheduledStartAtUtc))
        .slice(0, RECENT_LIMIT),
    };
  }, [schedule.data, fetchedAt, child, family]);

  const refreshing = dashboard.isRefetching || schedule.isRefetching || children.isRefetching;
  const refresh = () => { void dashboard.refetch(); void schedule.refetch(); void children.refetch(); };
  const loadError = dashboard.error ?? schedule.error;
  const initials = session.userName.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  const quickOrder = (config?.quickActions ?? "reports,resources,recordings,support").split(",").map(x => x.trim());
  const quickLinks = quickOrder.map(key => QUICK_LINKS.find(x => x.key === key)).filter((x): x is (typeof QUICK_LINKS)[number] => !!x && config?.features?.[x.key] !== false);
  const confirmSignOut = () => Alert.alert(
    "Sign out?",
    "You'll need your email or mobile number and PIN to sign in again.",
    [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: () => signOut() }],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.ambientTop, { backgroundColor: colors.primarySoft }]} />
        <View style={[styles.ambientSide, { backgroundColor: colors.infoSoft }]} />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <Logo size={34} withWordmark />
        <Pressable
          onPress={() => setMenuOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Account"
          accessibilityState={{ expanded: menuOpen }}
          style={[styles.avatar, { backgroundColor: colors.primarySoft }]}
        >
          <Text style={[styles.avatarText, { color: colors.primaryInk }]}>{initials}</Text>
        </Pressable>
      </View>

      {menuOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="Close account menu" />
          <Card style={[styles.menu, { top: insets.top + 60, right: Math.max(space.lg, (windowWidth - layout.contentMax) / 2) }]}>
            <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>{session.userName}</Text>
            <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>{session.role ?? "Parent"} account</Text>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <Pressable onPress={confirmSignOut} accessibilityRole="button" style={styles.menuItem}>
              <Feather name="log-out" size={16} color={colors.danger} />
              <Text style={[type.label, { color: colors.danger }]}>Sign out</Text>
            </Pressable>
          </Card>
        </>
      )}

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxxl + tabBarSpace }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {announcement ? (
          <View accessibilityRole="alert" style={[styles.announcement, { backgroundColor: colors.primarySoft }]}>
            <Feather name="bell" size={16} color={colors.primaryInk} style={{ marginTop: 2 }} />
            <Text style={[type.body, { color: colors.primaryInk, flex: 1 }]}>{announcement}</Text>
          </View>
        ) : null}

        <Appear style={styles.greeting}>
          <Text style={[type.overline, { color: colors.muted }]}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </Text>
          <Text style={[type.display, { color: colors.text }]}>{greeting()},{"\n"}<Text style={{ color: colors.primary }}>{firstName}</Text></Text>
          <Text style={[type.body, { color: colors.muted }]}>
            {childFirst ? `Here's how ${childFirst} is doing this week.` : "Classes, attendance and fees in one place."}
          </Text>
        </Appear>

        {summaries.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childTabs}>
            {summaries.map((c) => {
              const active = c.childId === child?.childId;
              return (
                <Pressable
                  key={c.childId}
                  onPress={() => setSelectedId(c.childId)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.childTab, active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.childInitial, { backgroundColor: active ? "rgba(255,255,255,0.25)" : colors.mutedBg }]}>
                    <Text style={[styles.childInitialText, { color: active ? "#FFFFFF" : colors.muted }]}>{c.name.trim().charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={[type.label, { color: active ? "#FFFFFF" : colors.text }]}>{c.name.split(" ")[0]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {child && session.role !== "Student" && config?.features?.mito !== false && (
          <Pressable
            onPress={() => router.push(`/mito?childId=${encodeURIComponent(child.childId)}&name=${encodeURIComponent(child.name)}` as Href)}
            accessibilityRole="button"
            accessibilityLabel={`Talk to Mito for ${child.name}`}
            style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
          >
            <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mitoCard}>
              <View style={styles.mitoFace}><Feather name="zap" size={25} color={colors.primary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.mitoEyebrow}>AI LEARNING COMPANION</Text><Text style={styles.mitoTitle}>Learn with {config?.mito?.displayName || "Mito"}</Text><Text style={styles.mitoBody}>{config?.mito?.chatEnabled === false ? "Practice with approved quizzes" : "Ask questions, plan today, or practise"}</Text></View>
              <View style={styles.mitoArrow}><Feather name="arrow-right" size={18} color="#FFFFFF" /></View>
            </LinearGradient>
          </Pressable>
        )}

        {loadError && !dashboard.data && !schedule.data ? (
          <Card>
            <EmptyState
              icon="wifi-off"
              title="Couldn't load your dashboard"
              description={errorMessage(loadError)}
              action={<Button label="Try again" icon="refresh-cw" size="sm" variant="secondary" onPress={refresh} style={{ marginTop: space.sm }} />}
            />
          </Card>
        ) : dashboard.data && !dashboard.data.enrollmentFormCompleted && config?.features?.enrollment !== false ? (
          <Card>
            <EmptyState
              icon="file-text"
              title="Complete enrollment"
              description="Finish your child's enrollment form to see classes here. It takes a few minutes."
              action={<Button label="Start enrollment" icon="arrow-right" size="sm" onPress={() => router.push("/enrollment" as Href)} style={{ marginTop: space.sm }} />}
            />
          </Card>
        ) : (
          <>
            <Appear index={1}>
              {schedule.isPending ? <Skeleton height={168} style={{ borderRadius: radius.xl }} /> : (
                <UpNext session={next} colors={colors} displayName={next ? joinDisplayName(next, family, session.userName) : ""} />
              )}
            </Appear>

            {config?.features?.feedback !== false && feedback.data?.[0] && (
              <Pressable
                onPress={() => router.push("/feedback" as Href)}
                accessibilityRole="button"
                style={({ pressed }) => [pressed && { opacity: 0.9 }]}
              >
                <Card style={styles.feedback}>
                  <IconTile icon="star" tone="warning" size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.heading, { color: colors.text }]}>How was {feedback.data[0].kind === "Demo" ? "the demo class" : feedback.data[0].courseName ?? "the course"}?</Text>
                    <Text style={[type.caption, { color: colors.muted }]}>Rate {feedback.data[0].childName.split(" ")[0]}&apos;s experience in a few taps</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.muted} />
                </Card>
              </Pressable>
            )}

            <Appear index={2} style={styles.grid}>
              <View style={styles.gridRow}>
                <StatCard label="Classes completed" value={String(child?.classesCompleted ?? 0)} icon="check-circle" tone="success" loading={dashboard.isPending} />
                <StatCard label="Classes remaining" value={String(child?.classesRemaining ?? 0)} icon="calendar" tone="brand" loading={dashboard.isPending} />
              </View>
              <View style={styles.gridRow}>
                <AttendanceCard percent={child?.attendancePercent ?? null} loading={dashboard.isPending} colors={colors} />
                <StatCard
                  label={child ? `Fees · ${FEE[child.feeStatus].note}` : "Fees"}
                  valueNode={child ? <Badge label={FEE[child.feeStatus].label} tone={FEE[child.feeStatus].tone} dot /> : undefined}
                  value="—"
                  icon="credit-card"
                  tone={child ? FEE[child.feeStatus].tone : "neutral"}
                  loading={dashboard.isPending}
                />
              </View>
            </Appear>

            <Appear index={3}>
              <SectionHeader title="Quick access" />
              <View style={styles.quickGrid}>
                {quickLinks.map((q) => (
                  <Pressable
                    key={q.label}
                    onPress={() => router.push(q.href)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.quick, pressed && { transform: [{ scale: 0.94 }] }]}
                  >
                    <IconTile icon={q.icon} tone={q.tone} size={58} />
                    <Text style={[type.caption, { color: colors.text, textAlign: "center" }]} numberOfLines={2}>{q.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Appear>

            <Appear index={4}>
              <SectionHeader title="Upcoming classes" caption={upcoming.length ? `Next ${DAYS} days` : undefined} />
              <Card padded={false}>
                {schedule.isPending ? <View style={{ padding: space.lg, gap: space.md }}><Skeleton height={48} /><Skeleton height={48} /></View>
                  : upcoming.length === 0 ? (
                    <EmptyState icon="calendar" title="Nothing else scheduled" description="New classes will appear here as soon as they're booked." />
                  ) : upcoming.map((s, i) => (
                    <Fragment key={s.id}>
                      {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                      <SessionRow session={s} colors={colors} />
                    </Fragment>
                  ))}
              </Card>
            </Appear>

            <Appear index={5}>
              <SectionHeader title="Recent activity" />
              <Card padded={false}>
                {schedule.isPending ? <View style={{ padding: space.lg, gap: space.md }}><Skeleton height={44} /><Skeleton height={44} /></View>
                  : recent.length === 0 ? (
                    <EmptyState icon="clock" title="No activity yet" description="Completed classes will show up here." />
                  ) : recent.map((s, i) => (
                    <Fragment key={s.id}>
                      {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                      <RecentRow session={s} colors={colors} />
                    </Fragment>
                  ))}
              </Card>
            </Appear>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function UpNext({ session, colors, displayName }: { session?: ApiClassSession; colors: Colors; displayName: string }) {
  const { config } = useAppConfig();
  if (!session) {
    return (
      <Card>
        <EmptyState icon="sun" title="No upcoming classes" description={`Nothing is scheduled for the next ${DAYS} days.`} />
      </Card>
    );
  }
  const live = isLive(session);
  const start = new Date(session.scheduledStartAtUtc);
  const minutes = Math.round((new Date(session.scheduledEndAtUtc).getTime() - start.getTime()) / 60_000);
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = new Date(session.scheduledEndAtUtc).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day = dayLabel(session);

  const joinable = isJoinable(session, config?.joinOpensMinutesBefore);
  const countdown = live ? "Live now" : countdownLabel(session);
  const open = () => router.push({ pathname: "/class/[id]", params: { id: session.id } });
  const join = () => router.push({ pathname: "/live/[id]", params: { id: session.id, title: classTitle(session), name: displayName } });
  return (
    <LinearGradient
      colors={[colors.primary, colors.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Image source={require("@/assets/images/mtm-logo.png")} style={styles.heroWatermark} contentFit="contain" pointerEvents="none" />
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityHint="Opens class details"
        accessibilityLabel={`Up next: ${classTitle(session)}, ${day} ${startTime} to ${endTime} with ${session.teacherName}. ${live ? "Live now" : countdownLabel(session)}`}
        style={({ pressed }) => [styles.heroDetails, pressed && { opacity: 0.95 }]}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroLabel}>
            <View style={[styles.heroLabelDot, { backgroundColor: live ? "#BBF7D0" : "#FFFFFF" }]} />
            <Text style={[type.overline, { color: "rgba(255,255,255,0.9)" }]}>{live ? "Happening now" : "Up next"}</Text>
          </View>
          {countdown !== "Tomorrow" && (
            <View style={[styles.heroPill, { backgroundColor: live ? "#16A34A" : "#FFFFFF" }]}>
              <Feather name={live ? "radio" : "clock"} size={12} color={live ? "#FFFFFF" : brand.orangeTo} />
              <Text style={[styles.heroPillText, { color: live ? "#FFFFFF" : brand.orangeTo }]}>{countdown}</Text>
            </View>
          )}
        </View>

        <View style={styles.heroMain}>
          <View style={styles.heroDate}>
            <Text style={styles.heroDateTop}>{day === "Today" ? day.toUpperCase() : start.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</Text>
            <Text style={styles.heroDateDay}>{start.getDate()}</Text>
            <Text style={styles.heroDateMonth}>{start.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.heroTime}>{startTime}</Text>
            <Text style={styles.heroRange}>until {endTime}</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>{classTitle(session)}</Text>
          </View>
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.teacherAvatar}><Text style={styles.teacherInitial}>{session.teacherName.trim().charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroCaption}>Teacher</Text>
            <Text style={styles.heroTeacherName} numberOfLines={1}>{session.teacherName}</Text>
          </View>
          <View style={styles.heroChip}>
            <Feather name="watch" size={12} color="#FFFFFF" />
            <Text style={styles.heroChipText}>{minutes} min</Text>
          </View>
          <View style={styles.heroChip}>
            <Feather name={session.type === "Demo" ? "star" : "video"} size={12} color="#FFFFFF" />
            <Text style={styles.heroChipText}>{session.type === "Demo" ? "Demo" : "Online"}</Text>
          </View>
        </View>
      </Pressable>
      {joinable && (
        <Pressable onPress={join} accessibilityRole="button" accessibilityLabel={`Join ${classTitle(session)}`} style={({ pressed }) => [styles.joinButton, pressed && { opacity: 0.9 }]}>
          <Feather name="video" size={18} color={brand.orangeTo} />
          <Text style={styles.joinText}>{live ? "Join class now" : "Join class"}</Text>
        </Pressable>
      )}
    </LinearGradient>
  );
}

function AttendanceCard({ percent, loading, colors }: { percent: number | null; loading: boolean; colors: Colors }) {
  if (percent === null) return <StatCard label="Attendance · no classes yet" value="—" icon="trending-up" tone="neutral" loading={loading} />;
  const tone: Tone = percent >= 90 ? "success" : percent >= 75 ? "warning" : "danger";
  const bar = tone === "success" ? colors.success : tone === "warning" ? colors.warning : colors.danger;
  return (
    <StatCard
      label="Attendance"
      value={`${percent}%`}
      icon="trending-up"
      tone={tone}
      loading={loading}
      footer={
        <View style={[styles.track, { backgroundColor: colors.mutedBg }]} accessibilityLabel={`Attendance ${percent} percent`}>
          <View style={[styles.fill, { width: `${Math.min(100, percent)}%`, backgroundColor: bar }]} />
        </View>
      }
    />
  );
}

function RecentRow({ session, colors }: { session: ApiClassSession; colors: Colors }) {
  return (
    <View style={styles.row}>
      <IconTile icon="check" tone="success" size={40} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{classTitle(session)}</Text>
        <Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={2}>
          {session.summary?.trim() || `${dayLabel(session)} · ${session.teacherName}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, paddingBottom: space.sm, zIndex: 2, width: "100%", maxWidth: layout.contentMax, alignSelf: "center" },
  ambientTop: { position: "absolute", width: 320, height: 320, borderRadius: 160, top: -210, right: -100, opacity: 0.72 },
  ambientSide: { position: "absolute", width: 220, height: 220, borderRadius: 110, top: 420, left: -175, opacity: 0.25 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: 14 },
  menu: { position: "absolute", width: 220, zIndex: 10, elevation: 8, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: space.md },
  menuItem: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs },
  body: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.xxl, width: "100%", maxWidth: layout.contentMax, alignSelf: "center" },
  announcement: { flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.md },
  greeting: { gap: space.xs, marginTop: space.xs },
  childTabs: { gap: space.sm },
  childTab: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.pill, borderWidth: 1, paddingLeft: 4, paddingRight: space.lg, paddingVertical: 4 },
  childInitial: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  childInitialText: { fontFamily: fonts.bold, fontSize: 13 },
  mitoCard: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.xl, padding: space.lg },
  mitoFace: { width: 54, height: 54, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.96)", alignItems: "center", justifyContent: "center" },
  mitoEyebrow: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, color: "rgba(255,255,255,0.72)", marginBottom: 2 },
  mitoTitle: { fontFamily: fonts.bold, fontSize: 18, color: "#FFFFFF" },
  mitoBody: { fontFamily: fonts.medium, fontSize: 12, color: "rgba(255,255,255,0.86)", marginTop: 2 },
  mitoArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.lg, overflow: "hidden" },
  heroWatermark: { position: "absolute", width: 190, height: 190, right: -42, bottom: -58, opacity: 0.1, transform: [{ rotate: "-8deg" }] },
  heroDetails: { gap: space.lg },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroLabelDot: { width: 8, height: 8, borderRadius: 4 },
  heroPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
  heroPillText: { fontFamily: fonts.bold, fontSize: 12, color: "#FFFFFF" },
  heroMain: { flexDirection: "row", alignItems: "center", gap: space.lg },
  heroDate: { width: 68, paddingVertical: 10, borderRadius: radius.lg, alignItems: "center", backgroundColor: "#FFFFFF" },
  heroDateTop: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: brand.orangeTo },
  heroDateDay: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, color: brand.charcoal },
  heroDateMonth: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1, color: "#6B7280" },
  heroTime: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.8, color: "#FFFFFF", lineHeight: 34 },
  heroRange: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.85)" },
  heroTitle: { fontFamily: fonts.semibold, fontSize: 16, color: "#FFFFFF", marginTop: 4 },
  heroFooter: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.3)" },
  teacherAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  teacherInitial: { fontFamily: fonts.bold, fontSize: 14, color: brand.orangeTo },
  heroCaption: { fontFamily: fonts.medium, fontSize: 11, color: "rgba(255,255,255,0.8)" },
  heroTeacherName: { fontFamily: fonts.semibold, fontSize: 14, color: "#FFFFFF" },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.2)" },
  joinButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, backgroundColor: "#FFFFFF", borderRadius: radius.md, minHeight: 50 },
  joinText: { fontFamily: fonts.bold, fontSize: 16, color: brand.orangeTo },
  feedback: { flexDirection: "row", alignItems: "center", gap: space.md },
  heroChipText: { fontFamily: fonts.semibold, fontSize: 12, color: "#FFFFFF" },
  grid: { gap: space.md },
  quickGrid: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  quick: { flex: 1, alignItems: "center", gap: space.sm },
  gridRow: { flexDirection: "row", gap: space.md },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 72 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14 },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
});

import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { Fragment, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getChildRewards, getChildren } from "@/api/parent";
import { Card, Chips, Divider, EmptyState, ErrorCard, ListRow, Screen, SectionHeader, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

/** Stars and badges a child earned in live classes. Only the signed-in family's own children are ever shown. */
export default function Rewards() {
  const colors = useColors();
  const session = useRequiredSession();
  const params = useLocalSearchParams<{ childId?: string }>();
  const children = useQuery({ queryKey: ["children", session.token], queryFn: () => getChildren(session.token) });
  const family = (children.data ?? []).filter((c) => c.isActive);
  const [picked, setPicked] = useState<string | null>(params.childId ?? null);
  const childId = picked && family.some((c) => c.id === picked) ? picked : family[0]?.id;

  const rewards = useQuery({
    queryKey: ["rewards", session.token, childId],
    queryFn: () => getChildRewards(session.token, childId!),
    enabled: !!childId,
  });
  const data = rewards.data;

  return (
    <Screen refreshing={rewards.isRefetching} onRefresh={() => rewards.refetch()}>
      {family.length > 1 && (
        <Chips options={family.map((c) => ({ value: c.id, label: c.firstName }))} value={childId ?? ""} onChange={setPicked} />
      )}

      {children.isPending || (rewards.isPending && !!childId) ? <View style={{ gap: space.md }}><Skeleton height={150} style={{ borderRadius: radius.xl }} /><Skeleton height={64} /></View>
        : children.isError ? <ErrorCard message={errorMessage(children.error)} onRetry={() => children.refetch()} />
        : rewards.isError ? <ErrorCard message={errorMessage(rewards.error)} onRetry={() => rewards.refetch()} />
        : !data ? <Card><EmptyState icon="award" title="No children yet" description="Rewards appear once a child is enrolled." /></Card>
        : (
          <>
            <LinearGradient colors={[colors.primary, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <Feather name="star" size={26} color="#FFFFFF" />
              <Text style={styles.count}>{data.totalStars}</Text>
              <Text style={styles.heroNote}>
                {data.totalStars === 1 ? "star" : "stars"} earned by {data.childName.split(" ")[0]}
                {data.starsLast30Days > 0 ? ` · +${data.starsLast30Days} in the last 30 days` : ""}
              </Text>
            </LinearGradient>

            {data.nextMilestoneStars !== null && (
              <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <Feather name="target" size={20} color={colors.primary} />
                <Text style={[type.caption, { color: colors.textSoft, flex: 1 }]}>
                  Next goal: <Text style={{ fontFamily: fonts.bold, color: colors.text }}>{data.nextMilestoneLabel}</Text>. Earn {data.nextMilestoneStars} stars in a single class.
                </Text>
              </Card>
            )}

            <SectionHeader title="Badges" caption={data.rewards.length ? `${data.rewards.length} earned` : undefined} />
            {data.rewards.length === 0 ? (
              <Card><EmptyState icon="award" title="No badges yet" description="Stars and badges are awarded in live classes. They'll show up here." /></Card>
            ) : (
              <Card padded={false}>
                {data.rewards.map((r, i) => (
                  <Fragment key={`${r.label}-${r.earnedAtUtc}`}>
                    {i > 0 && <Divider />}
                    <ListRow
                      icon={r.kind === "Milestone" ? "flag" : "award"}
                      tone="warning"
                      title={r.label}
                      subtitle={`${r.kind === "Milestone" ? "Milestone" : "Badge"} · ${formatDate(r.earnedAtUtc)}`}
                    />
                  </Fragment>
                ))}
              </Card>
            )}
          </>
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.xs, alignItems: "center", overflow: "hidden" },
  count: { fontFamily: fonts.bold, fontSize: 48, letterSpacing: -1, color: "#FFFFFF" },
  heroNote: { fontFamily: fonts.medium, fontSize: 14, color: "rgba(255,255,255,0.92)", textAlign: "center" },
});

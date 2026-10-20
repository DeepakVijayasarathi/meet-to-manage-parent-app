import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Fragment } from "react";
import { View } from "react-native";

import { errorMessage } from "@/api/client";
import { getRecordings } from "@/api/parent";
import { Card, Divider, EmptyState, ErrorCard, ListRow, Screen, Skeleton } from "@/components/ui";
import { formatDate, formatDuration } from "@/lib/format";
import { space } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

export default function Recordings() {
  const session = useRequiredSession();
  const recordings = useQuery({ queryKey: ["recordings", session.token], queryFn: () => getRecordings(session.token) });
  const items = [...(recordings.data ?? [])].sort((a, b) => b.scheduledStartAtUtc.localeCompare(a.scheduledStartAtUtc));

  return (
    <Screen refreshing={recordings.isRefetching} onRefresh={() => recordings.refetch()}>
      {recordings.isPending ? <View style={{ gap: space.md }}><Skeleton height={64} /><Skeleton height={64} /></View>
        : recordings.isError ? <ErrorCard message={errorMessage(recordings.error)} onRetry={() => recordings.refetch()} />
        : items.length === 0 ? (
          <Card><EmptyState icon="video" title="No recordings yet" description="Recorded classes appear here shortly after they finish." /></Card>
        ) : (
          <Card padded={false}>
            {items.map((r, i) => {
              const title = r.batchName ?? "Class recording";
              return (
                <Fragment key={r.id}>
                  {i > 0 && <Divider />}
                  <ListRow
                    icon="play"
                    tone="success"
                    title={title}
                    subtitle={[
                      formatDate(r.scheduledStartAtUtc, { weekday: "short", day: "numeric", month: "short" }),
                      formatDuration(r.durationSeconds),
                      r.expiresAtUtc ? `Available until ${formatDate(r.expiresAtUtc, { day: "numeric", month: "short" })}` : null,
                    ].filter(Boolean).join(" · ")}
                    onPress={() => router.push({ pathname: "/recordings/play", params: { url: r.storageUrl, title } })}
                  />
                </Fragment>
              );
            })}
          </Card>
        )}
    </Screen>
  );
}

import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Fragment } from "react";
import { View } from "react-native";

import { errorMessage } from "@/api/client";
import { getSupportTickets } from "@/api/parent";
import { Badge, Button, Card, Divider, EmptyState, ErrorCard, ListRow, Screen, Skeleton } from "@/components/ui";
import { TICKET_STATUS, categoryLabel } from "@/lib/support";
import { timeAgo } from "@/lib/format";
import { space } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

export default function Support() {
  const session = useRequiredSession();
  const tickets = useQuery({ queryKey: ["tickets", session.token], queryFn: () => getSupportTickets(session.token) });
  const items = [...(tickets.data ?? [])].sort((a, b) => b.lastActivityAtUtc.localeCompare(a.lastActivityAtUtc));

  return (
    <Screen refreshing={tickets.isRefetching} onRefresh={() => tickets.refetch()}>
      <Button label="New request" icon="plus" onPress={() => router.push("/support/new")} />
      {tickets.isPending ? <View style={{ gap: space.md }}><Skeleton height={72} /><Skeleton height={72} /></View>
        : tickets.isError ? <ErrorCard message={errorMessage(tickets.error)} onRetry={() => tickets.refetch()} />
        : items.length === 0 ? (
          <Card><EmptyState icon="life-buoy" title="How can we help?" description="Ask about class timings, a teacher, fees or a technical problem. Our team usually replies within a day." /></Card>
        ) : (
          <Card padded={false}>
            {items.map((t, i) => {
              const status = TICKET_STATUS[t.status];
              return (
                <Fragment key={t.id}>
                  {i > 0 && <Divider />}
                  <ListRow
                    icon="message-square"
                    tone={status.tone}
                    title={t.subject}
                    subtitle={`${t.reference} · ${categoryLabel(t.category)} · ${timeAgo(t.lastActivityAtUtc)}`}
                    right={<Badge label={t.awaitingStaffReply || t.status !== "InProgress" ? status.label : "Replied"} tone={t.awaitingStaffReply || t.status !== "InProgress" ? status.tone : "success"} />}
                    onPress={() => router.push({ pathname: "/support/[id]", params: { id: t.id } })}
                  />
                </Fragment>
              );
            })}
          </Card>
        )}
    </Screen>
  );
}

import { router } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { View } from "react-native";

import { errorMessage } from "@/api/client";
import { Card, Chips, Divider, EmptyState, ErrorCard, ListRow, Screen, Skeleton } from "@/components/ui";
import { formatDate, monthName } from "@/lib/format";
import { space } from "@/lib/theme";
import { useReports } from "@/lib/queries";

export default function Reports() {
  const reports = useReports();
  const [child, setChild] = useState("all");

  const sent = useMemo(
    () => (reports.data ?? []).filter((r) => r.status === "Sent")
      .sort((a, b) => b.periodYear - a.periodYear || b.periodMonth - a.periodMonth),
    [reports.data],
  );
  const names = [...new Map(sent.map((r) => [r.childId, r.childName])).entries()];
  const shown = child === "all" ? sent : sent.filter((r) => r.childId === child);

  return (
    <Screen refreshing={reports.isRefetching} onRefresh={() => reports.refetch()}>
      {names.length > 1 && (
        <Chips options={[{ value: "all", label: "All children" }, ...names.map(([id, name]) => ({ value: id, label: name.split(" ")[0] }))]} value={child} onChange={setChild} />
      )}
      {reports.isPending ? <View style={{ gap: space.md }}><Skeleton height={64} /><Skeleton height={64} /></View>
        : reports.isError ? <ErrorCard message={errorMessage(reports.error)} onRetry={() => reports.refetch()} />
        : shown.length === 0 ? (
          <Card><EmptyState icon="file-text" title="No reports yet" description="Teachers share a progress report each month. You'll find them here." /></Card>
        ) : (
          <Card padded={false}>
            {shown.map((r, i) => (
              <Fragment key={r.id}>
                {i > 0 && <Divider />}
                <ListRow
                  icon="file-text"
                  title={monthName(r.periodYear, r.periodMonth)}
                  subtitle={`${r.childName}${r.sentAtUtc ? ` · Shared ${formatDate(r.sentAtUtc, { day: "numeric", month: "short" })}` : ""}`}
                  onPress={() => router.push({ pathname: "/reports/[id]", params: { id: r.id } })}
                />
              </Fragment>
            ))}
          </Card>
        )}
    </Screen>
  );
}

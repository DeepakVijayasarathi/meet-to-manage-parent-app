import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { View } from "react-native";

import { errorMessage } from "@/api/client";
import { getHomework } from "@/api/parent";
import { Badge, Card, Chips, Divider, EmptyState, ErrorCard, ListRow, Screen, Segmented, Skeleton } from "@/components/ui";
import { homeworkBucket, homeworkSubtitle, type HomeworkBucket } from "@/lib/homework";
import { space } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

const EMPTY: Record<HomeworkBucket, { title: string; description: string }> = {
  todo: { title: "Nothing to do", description: "New homework and tests appear here as soon as a teacher sets them." },
  done: { title: "Nothing waiting", description: "Work you've handed in shows here until the teacher checks it." },
  results: { title: "No results yet", description: "Checked homework and released test marks appear here." },
};

export default function Homework() {
  const session = useRequiredSession();
  const work = useQuery({ queryKey: ["homework", session.token], queryFn: () => getHomework(session.token) });
  const [tab, setTab] = useState<HomeworkBucket>("todo");
  const [child, setChild] = useState("all");

  const all = useMemo(() => work.data ?? [], [work.data]);
  const names = [...new Map(all.map((a) => [a.childId, a.childName])).entries()];
  const mine = child === "all" ? all : all.filter((a) => a.childId === child);
  const count = (b: HomeworkBucket) => mine.filter((a) => homeworkBucket(a) === b).length;
  const shown = mine.filter((a) => homeworkBucket(a) === tab);

  return (
    <Screen refreshing={work.isRefetching} onRefresh={() => work.refetch()}>
      <Segmented
        options={[{ value: "todo", label: `To do (${count("todo")})` }, { value: "done", label: `Handed in (${count("done")})` }, { value: "results", label: `Results (${count("results")})` }]}
        value={tab}
        onChange={setTab}
      />
      {names.length > 1 && (
        <Chips options={[{ value: "all", label: "All children" }, ...names.map(([id, name]) => ({ value: id, label: name.split(" ")[0] }))]} value={child} onChange={setChild} />
      )}
      {work.isPending ? <View style={{ gap: space.md }}><Skeleton height={64} /><Skeleton height={64} /></View>
        : work.isError ? <ErrorCard message={errorMessage(work.error)} onRetry={() => work.refetch()} />
        : shown.length === 0 ? <Card><EmptyState icon="edit-3" {...EMPTY[tab]} /></Card>
        : (
          <Card padded={false}>
            {shown.map((a, i) => (
              <Fragment key={a.submissionId}>
                {i > 0 && <Divider />}
                <ListRow
                  icon={a.kind === "Test" ? "award" : "edit-3"}
                  tone={a.isOverdue ? "danger" : a.kind === "Test" ? "info" : "brand"}
                  title={a.title}
                  subtitle={homeworkSubtitle(a)}
                  right={a.isOverdue ? <Badge label="Overdue" tone="danger" />
                    : tab === "results" && a.marks != null ? <Badge label={`${a.marks}${a.maxMarks ? `/${a.maxMarks}` : ""}`} tone="success" />
                    : undefined}
                  onPress={() => router.push(`/homework/${a.submissionId}` as Href)}
                />
              </Fragment>
            ))}
          </Card>
        )}
    </Screen>
  );
}

import { useMutation, useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { Fragment, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getResourcePlayUrl, getResources } from "@/api/parent";
import type { ApiResource, ApiResourceType } from "@/api/types";
import { Card, Chips, Divider, EmptyState, ErrorCard, ListRow, Screen, Skeleton, type IconName, type Tone } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { brand, space, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

const KIND: Record<ApiResourceType, { label: string; icon: IconName; tone: Tone }> = {
  ReadingBook: { label: "Reading books", icon: "book", tone: "info" },
  Worksheet: { label: "Worksheets", icon: "edit-3", tone: "brand" },
  Other: { label: "Other", icon: "paperclip", tone: "neutral" },
};

export default function Resources() {
  const colors = useColors();
  const session = useRequiredSession();
  const [kind, setKind] = useState<"all" | ApiResourceType>("all");
  const [error, setError] = useState<string | null>(null);
  const resources = useQuery({ queryKey: ["resources", session.token], queryFn: () => getResources(session.token) });

  // Each open fetches a fresh, short-lived link; the file opens in the in-app browser.
  const openResource = useMutation({
    mutationFn: async (r: ApiResource) => {
      const { url } = await getResourcePlayUrl(session.token, r.id);
      await WebBrowser.openBrowserAsync(url, { toolbarColor: brand.charcoal, controlsColor: brand.orange });
    },
    onMutate: () => setError(null),
    onError: (err) => setError(errorMessage(err, "Couldn't open this resource.")),
  });

  const all = resources.data ?? [];
  const shown = kind === "all" ? all : all.filter((r) => r.type === kind);
  const kinds = (Object.keys(KIND) as ApiResourceType[]).filter((k) => all.some((r) => r.type === k));

  return (
    <Screen refreshing={resources.isRefetching} onRefresh={() => resources.refetch()}>
      {kinds.length > 1 && (
        <Chips options={[{ value: "all" as const, label: "All" }, ...kinds.map((k) => ({ value: k, label: KIND[k].label }))]} value={kind} onChange={setKind} />
      )}
      {error && <ErrorCard message={error} onRetry={() => setError(null)} />}
      {resources.isPending ? <View style={{ gap: space.md }}><Skeleton height={64} /><Skeleton height={64} /></View>
        : resources.isError ? <ErrorCard message={errorMessage(resources.error)} onRetry={() => resources.refetch()} />
        : shown.length === 0 ? (
          <Card><EmptyState icon="book-open" title="No resources yet" description="Worksheets and books your teacher shares will appear here." /></Card>
        ) : (
          <Card padded={false}>
            {shown.map((r, i) => {
              const k = KIND[r.type] ?? KIND.Other;
              const busy = openResource.isPending && openResource.variables?.id === r.id;
              return (
                <Fragment key={r.id}>
                  {i > 0 && <Divider />}
                  <ListRow
                    icon={k.icon}
                    tone={k.tone}
                    title={r.title}
                    subtitle={[r.batchName, formatBytes(r.fileSizeBytes)].filter(Boolean).join(" · ") || r.description || k.label}
                    onPress={() => openResource.mutate(r)}
                    chevron={!busy}
                    right={busy ? <ActivityIndicator color={colors.primary} /> : undefined}
                  />
                </Fragment>
              );
            })}
          </Card>
        )}
    </Screen>
  );
}

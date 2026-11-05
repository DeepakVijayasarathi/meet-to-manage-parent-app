import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Fragment } from "react";
import { Share, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getCertificates } from "@/api/parent";
import type { ApiCertificate } from "@/api/types";
import { Button, Card, Divider, EmptyState, ErrorCard, ListRow, Screen, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { space } from "@/lib/theme";
import { useAppConfig } from "@/state/appConfig";
import { useRequiredSession } from "@/state/session";

/** Each child's course-completion certificates, to share or download from the portal. */
export default function Certificates() {
  const session = useRequiredSession();
  const { webBaseUrl } = useAppConfig();
  const certificates = useQuery({ queryKey: ["certificates", session.token], queryFn: () => getCertificates(session.token) });
  const items = certificates.data ?? [];

  const share = (c: ApiCertificate) => {
    const base = webBaseUrl?.replace(/\/$/, "");
    const link = base ? `${base}${session.tenantCode ? `/t/${session.tenantCode}` : ""}/verify/${c.code}` : null;
    void Share.share({
      title: "Certificate of completion",
      message: `${c.studentName.split(" ")[0]} completed ${c.courseName}!${link ? ` ${link}` : ""}`,
    });
  };

  return (
    <Screen refreshing={certificates.isRefetching} onRefresh={() => certificates.refetch()}>
      {certificates.isPending ? <View style={{ gap: space.md }}><Skeleton height={72} /><Skeleton height={72} /></View>
        : certificates.isError ? <ErrorCard message={errorMessage(certificates.error)} onRetry={() => certificates.refetch()} />
        : items.length === 0 ? (
          <Card><EmptyState icon="award" title="No certificates yet" description="When your child finishes a course, the certificate appears here to download and share." /></Card>
        ) : (
          <>
            <Card padded={false}>
              {items.map((c, i) => (
                <Fragment key={c.id}>
                  {i > 0 && <Divider />}
                  <ListRow
                    icon="award"
                    tone="success"
                    title={c.courseName}
                    subtitle={`${c.studentName} · ${formatDate(c.issuedAtUtc)}`}
                    onPress={() => share(c)}
                    chevron={false}
                    right={<Button label="Share" icon="share-2" variant="ghost" size="sm" onPress={() => share(c)} />}
                  />
                </Fragment>
              ))}
            </Card>
            <Button
              label="Download certificates"
              icon="download"
              variant="secondary"
              onPress={() => router.push({ pathname: "/portal", params: { path: "/parent/certificates", title: "Certificates" } })}
            />
          </>
        )}
    </Screen>
  );
}

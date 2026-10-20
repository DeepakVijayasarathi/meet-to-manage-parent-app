import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Badge, Card, EmptyState, IconTile, Screen, Skeleton } from "@/components/ui";
import { formatDate, monthName } from "@/lib/format";
import { useReports } from "@/lib/queries";
import { fonts, space, type, useColors } from "@/lib/theme";

export default function Report() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const reports = useReports();
  const report = reports.data?.find((r) => r.id === id);

  if (reports.isPending) return <Screen><Skeleton height={90} /><Skeleton height={260} /></Screen>;
  if (!report) return <Screen><Card><EmptyState icon="file-text" title="Report not found" description="It may have been withdrawn by the academy." /></Card></Screen>;

  const month = monthName(report.periodYear, report.periodMonth);
  return (
    <Screen>
      <Stack.Screen options={{ title: month }} />
      <Card style={styles.header}>
        <IconTile icon="award" size={48} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.heading, { color: colors.text }]}>{report.childName}</Text>
          <Text style={[type.caption, { color: colors.muted }]}>{month} progress report</Text>
          {report.sentAtUtc && <Badge label={`Shared ${formatDate(report.sentAtUtc)}`} tone="success" />}
        </View>
      </Card>
      <Card>
        <Text style={[type.overline, { color: colors.muted, marginBottom: space.md }]}>Teacher&apos;s notes</Text>
        <Text style={[styles.content, { color: colors.text }]} selectable>{report.content.trim()}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.lg },
  content: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26 },
});

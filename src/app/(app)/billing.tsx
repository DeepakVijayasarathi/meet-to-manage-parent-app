import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getInvoices } from "@/api/parent";
import type { ApiInvoice, ApiInvoiceStatus } from "@/api/types";
import { Badge, Card, Divider, EmptyState, ErrorCard, ListRow, Screen, Skeleton, StatCard, type Tone } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { fonts, space, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

const STATUS: Record<ApiInvoiceStatus, { label: string; tone: Tone }> = {
  Pending: { label: "Due", tone: "warning" },
  PartiallyPaid: { label: "Part paid", tone: "info" },
  Paid: { label: "Paid", tone: "success" },
  Overdue: { label: "Overdue", tone: "danger" },
  Cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Receipts and billing history, shown inside the app from the same invoices the Fees tab lists. */
export default function Billing() {
  const colors = useColors();
  const session = useRequiredSession();
  const invoices = useQuery({ queryKey: ["invoices", session.token], queryFn: () => getInvoices(session.token) });

  // Anything that has received money is a receipt; newest payment first.
  const history = useMemo(
    () => [...(invoices.data ?? [])].filter((i) => i.amountPaid > 0 || i.status === "Paid")
      .sort((a, b) => (b.paidAtUtc ?? b.issuedAtUtc).localeCompare(a.paidAtUtc ?? a.issuedAtUtc)),
    [invoices.data],
  );
  const currency = invoices.data?.[0]?.currency ?? "INR";
  const totalPaid = history.reduce((sum, i) => sum + i.amountPaid, 0);

  return (
    <Screen refreshing={invoices.isRefetching} onRefresh={() => invoices.refetch()}>
      {invoices.isPending ? <View style={{ gap: space.md }}><Skeleton height={110} /><Skeleton height={64} /><Skeleton height={64} /></View>
        : invoices.isError ? <ErrorCard message={errorMessage(invoices.error)} onRetry={() => invoices.refetch()} />
        : history.length === 0 ? <Card><EmptyState icon="file-text" title="No payments yet" description="Receipts for the fees you pay will appear here." /></Card>
        : (
          <View style={styles.list}>
            <StatCard icon="check-circle" tone="success" label={`Total paid · ${history.length} ${history.length === 1 ? "payment" : "payments"}`} value={formatCurrency(totalPaid, currency)} />
            <Card padded={false}>
              {history.map((inv, i) => <Fragment key={inv.id}>{i > 0 && <Divider />}<HistoryRow inv={inv} color={colors.text} /></Fragment>)}
            </Card>
          </View>
        )}
    </Screen>
  );
}

function HistoryRow({ inv, color }: { inv: ApiInvoice; color: string }) {
  const s = STATUS[inv.status];
  const remaining = Math.max(0, inv.amount - inv.amountPaid);
  return (
    <ListRow
      icon={inv.status === "Paid" ? "check-circle" : "file-text"}
      tone={s.tone}
      title={inv.courseName ?? inv.departmentName}
      subtitle={[
        inv.childName,
        `#${inv.invoiceNumber}`,
        inv.paidAtUtc ? `Paid ${formatDate(inv.paidAtUtc)}` : null,
        remaining > 0 ? `${formatCurrency(remaining, inv.currency)} left` : null,
      ].filter(Boolean).join(" · ")}
      chevron={false}
      right={
        <View style={styles.right}>
          <Text style={[styles.amount, { color }]}>{formatCurrency(inv.amountPaid, inv.currency)}</Text>
          <Badge label={s.label} tone={s.tone} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xl },
  right: { alignItems: "flex-end", gap: 6 },
  amount: { fontFamily: fonts.bold, fontSize: 15 },
});

import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { errorMessage } from "@/api/client";
import { getInvoices } from "@/api/parent";
import type { ApiInvoice, ApiInvoiceStatus } from "@/api/types";
import { Badge, Button, Card, Divider, EmptyState, ErrorCard, ListRow, Screen, Segmented, Skeleton, type Tone } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { brand, fonts, radius, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

const STATUS: Record<ApiInvoiceStatus, { label: string; tone: Tone }> = {
  Pending: { label: "Due", tone: "warning" },
  PartiallyPaid: { label: "Part paid", tone: "info" },
  Paid: { label: "Paid", tone: "success" },
  Overdue: { label: "Overdue", tone: "danger" },
  Cancelled: { label: "Cancelled", tone: "neutral" },
};
const OPEN: ApiInvoiceStatus[] = ["Pending", "PartiallyPaid", "Overdue"];
type Filter = "all" | "due" | "paid";

const balance = (i: ApiInvoice) => Math.max(0, i.amount - i.amountPaid);

/** Payment runs on the web portal's secure checkout (gateways, T&C, receipts), opened in-app already signed in. */
function openBilling() {
  router.push({ pathname: "/portal", params: { path: "/parent/billing", title: "Pay fees" } });
}

export default function Fees() {
  const colors = useColors();
  const session = useRequiredSession();
  const [filter, setFilter] = useState<Filter>("all");
  const invoices = useQuery({ queryKey: ["invoices", session.token], queryFn: () => getInvoices(session.token) });

  const all = useMemo(() => [...(invoices.data ?? [])].sort((a, b) => b.issuedAtUtc.localeCompare(a.issuedAtUtc)), [invoices.data]);
  const open = all.filter((i) => OPEN.includes(i.status));
  const outstanding = open.reduce((sum, i) => sum + balance(i), 0);
  const overdue = open.filter((i) => i.status === "Overdue").length;
  const currency = all[0]?.currency ?? "INR";
  const shown = filter === "due" ? open : filter === "paid" ? all.filter((i) => i.status === "Paid") : all;

  return (
    <Screen title="Fees" subtitle="Invoices and payments for your family" refreshing={invoices.isRefetching} onRefresh={() => invoices.refetch()}>
      {invoices.isPending ? <Skeleton height={170} style={{ borderRadius: radius.xl }} /> : invoices.isError ? null : (
        <LinearGradient colors={[brand.orangeFrom, brand.orangeTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summary}>
          <Text style={[type.overline, { color: "rgba(255,255,255,0.9)" }]}>Outstanding balance</Text>
          <Text style={styles.amount}>{formatCurrency(outstanding, currency)}</Text>
          <Text style={styles.summaryNote}>
            {outstanding === 0 ? "You're all caught up. Thank you!" : `${open.length} open ${open.length === 1 ? "invoice" : "invoices"}${overdue ? ` · ${overdue} overdue` : ""}`}
          </Text>
          {outstanding > 0 && <Button label="Pay securely" icon="lock" variant="secondary" onPress={openBilling} style={{ marginTop: space.md }} />}
        </LinearGradient>
      )}

      <Segmented options={[{ value: "all", label: "All" }, { value: "due", label: "Due" }, { value: "paid", label: "Paid" }]} value={filter} onChange={setFilter} />

      {invoices.isPending ? <View style={{ gap: space.md }}><Skeleton height={64} /><Skeleton height={64} /></View>
        : invoices.isError ? <ErrorCard message={errorMessage(invoices.error)} onRetry={() => invoices.refetch()} />
        : shown.length === 0 ? (
          <Card><EmptyState icon="file" title={filter === "due" ? "Nothing to pay" : "No invoices yet"} description={filter === "due" ? "There are no open invoices right now." : "Invoices from your academy will appear here."} /></Card>
        ) : (
          <Card padded={false}>
            {shown.map((inv, i) => {
              const s = STATUS[inv.status];
              const due = OPEN.includes(inv.status);
              return (
                <Fragment key={inv.id}>
                  {i > 0 && <Divider />}
                  <ListRow
                    icon={inv.status === "Paid" ? "check-circle" : "file-text"}
                    tone={s.tone}
                    title={inv.courseName ?? inv.departmentName}
                    subtitle={[inv.childName, due ? `Due ${formatDate(inv.dueDate)}` : inv.paidAtUtc ? `Paid ${formatDate(inv.paidAtUtc)}` : `#${inv.invoiceNumber}`].filter(Boolean).join(" · ")}
                    onPress={due ? openBilling : undefined}
                    chevron={false}
                    right={
                      <View style={styles.right}>
                        <Text style={[styles.rowAmount, { color: colors.text }]}>{formatCurrency(due ? balance(inv) : inv.amount, inv.currency)}</Text>
                        <Badge label={s.label} tone={s.tone} />
                      </View>
                    }
                  />
                </Fragment>
              );
            })}
          </Card>
        )}

      <View style={styles.secure}>
        <Feather name="shield" size={13} color={colors.muted} />
        <Text style={[type.caption, { color: colors.muted }]}>Payments are processed on our secure website checkout.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: radius.xl, padding: space.xl, gap: space.xs, overflow: "hidden" },
  amount: { fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1, color: "#FFFFFF", marginTop: space.xs },
  summaryNote: { fontFamily: fonts.medium, fontSize: 14, color: "rgba(255,255,255,0.9)" },
  right: { alignItems: "flex-end", gap: 6 },
  rowAmount: { fontFamily: fonts.bold, fontSize: 15 },
  secure: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
});

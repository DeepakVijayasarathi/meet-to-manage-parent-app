import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, errorMessage } from "@/api/client";
import { acceptTerms, getInvoices, getPaymentMethods, getTermsStatus, payInvoice, refreshInvoicePayment } from "@/api/parent";
import type { ApiInvoice } from "@/api/types";
import { CheckRow, Field, Pills, TextField } from "@/components/form";
import { Button, Card, EmptyState, ErrorCard, Screen, Skeleton } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { captureError, track } from "@/lib/telemetry";
import { fonts, space, type, useColors } from "@/lib/theme";
import { useRequiredSession } from "@/state/session";

type Outcome =
  | { kind: "paid"; remaining: number }
  | { kind: "cash"; message: string }
  | { kind: "pending" };

const balanceOf = (i: ApiInvoice) => Math.max(0, i.amount - i.amountPaid);

/** Only ever open a plain https address, so a bad gateway config can't hand back a javascript:/intent: URL. */
function safeCheckoutUrl(url: string | null): string | null {
  try {
    return url && new URL(url).protocol === "https:" ? url : null;
  } catch { return null; }
}

/**
 * Pay an invoice from the app's own screens. The gateway checkout (cards, UPI, netbanking) opens in the system
 * browser sheet; when it closes we ask the server to reconcile with the gateway, so the invoice flips to Paid even if
 * the webhook is slow. Mirrors the web portal's PayNowModal (terms, method, amount, pay, verify).
 */
export default function PayInvoice() {
  const colors = useColors();
  const session = useRequiredSession();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pickedMethod, setMethod] = useState("");
  const [custom, setCustom] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Balance when the payment started: "did it go through?" compares against this, not the refreshed invoice.
  const [balanceBefore, setBalanceBefore] = useState<number | null>(null);

  const invoices = useQuery({ queryKey: ["invoices", session.token], queryFn: () => getInvoices(session.token) });
  const terms = useQuery({ queryKey: ["terms", session.token], queryFn: () => getTermsStatus(session.token), staleTime: 0 });
  const methods = useQuery({ queryKey: ["payment-methods", session.token], queryFn: () => getPaymentMethods(session.token) });
  const invoice = invoices.data?.find((i) => i.id === id);
  // Defaults to the academy's first enabled method until the family picks another.
  const method = pickedMethod || methods.data?.[0]?.key || "";

  const balance = invoice ? balanceOf(invoice) : 0;
  const parsed = custom.trim() === "" ? null : Number(custom);
  const customInvalid = parsed !== null && (!Number.isFinite(parsed) || parsed < 1 || parsed > balance);
  const payAmount = parsed !== null && !customInvalid ? parsed : balance;
  const termsRequired = terms.data?.required ?? false;

  const settle = async (before: number): Promise<boolean> => {
    const fresh = await refreshInvoicePayment(session.token, id);
    void queryClient.invalidateQueries({ queryKey: ["invoices", session.token] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard", session.token] });
    const remaining = Math.max(0, fresh.amount - fresh.amountPaid);
    // An installment leaves the invoice PartiallyPaid, so success is "the balance dropped", not "status is Paid".
    if (fresh.status === "Paid" || remaining < before - 0.005) {
      setOutcome({ kind: "paid", remaining });
      track("payment_completed");
      return true;
    }
    return false;
  };

  const pay = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      setError(null);
      if (termsRequired && !accepted) throw new Error("Please accept the Terms & Conditions to continue.");
      if (customInvalid) throw new Error(`Enter an amount between ${formatCurrency(1, invoice.currency)} and ${formatCurrency(balance, invoice.currency)}.`);
      if (termsRequired) { await acceptTerms(session.token); void terms.refetch(); }

      const result = await payInvoice(session.token, invoice.id, method, payAmount < balance ? payAmount : undefined);
      if (result.mode === "unavailable") throw new Error(result.message || "This payment method is not available right now.");
      if (result.mode === "cash") { setOutcome({ kind: "cash", message: result.message }); return; }

      const url = safeCheckoutUrl(result.url);
      if (!url) throw new Error("The payment gateway returned an invalid checkout link. Please try another method.");
      setBalanceBefore(balance);
      track("payment_started");
      await WebBrowser.openBrowserAsync(url, { showTitle: true, enableBarCollapsing: false });
      if (!(await settle(balance))) setOutcome({ kind: "pending" });
    },
    onError: (e) => {
      if (!(e instanceof ApiError)) captureError(e, "pay_invoice");
      setError(errorMessage(e));
    },
  });

  const recheck = useMutation({
    mutationFn: async () => {
      if (!(await settle(balanceBefore ?? balance))) throw new Error("We haven't received this payment yet. If you've just paid, wait a moment and try again.");
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const loading = invoices.isPending || terms.isPending || methods.isPending;
  const title = invoice ? (invoice.courseName ?? invoice.departmentName) : "Invoice";

  return (
    <Screen>
      <Stack.Screen options={{ title: "Pay fees" }} />
      {loading ? <View style={{ gap: space.md }}><Skeleton height={110} /><Skeleton height={80} /></View>
        : invoices.isError ? <ErrorCard message={errorMessage(invoices.error)} onRetry={() => invoices.refetch()} />
        : !invoice ? <Card><EmptyState icon="file" title="Invoice not found" description="It may have been removed. Pull to refresh on the Fees tab." /></Card>
        : outcome?.kind === "paid" ? (
          <Card>
            <EmptyState
              icon="check-circle"
              title="Payment received"
              description={outcome.remaining > 0 ? `Thank you! ${formatCurrency(outcome.remaining, invoice.currency)} is still outstanding on this invoice.` : "Thank you! This invoice is fully paid."}
              action={<Button label="Back to fees" icon="arrow-left" onPress={() => router.back()} style={{ marginTop: space.sm }} />}
            />
          </Card>
        ) : outcome?.kind === "cash" ? (
          <Card>
            <EmptyState icon="clock" title="Waiting for your academy" description={outcome.message}
              action={<Button label="Done" onPress={() => router.back()} style={{ marginTop: space.sm }} />} />
          </Card>
        ) : outcome?.kind === "pending" ? (
          <Card style={{ gap: space.md }}>
            <EmptyState icon="clock" title="Checking your payment" description="We haven't seen the payment confirmed yet. If you completed it, it can take a minute to arrive; your invoice also updates automatically." />
            {error && <Text style={[type.label, { color: colors.danger, textAlign: "center" }]}>{error}</Text>}
            <Button label="Check again" icon="refresh-cw" onPress={() => { setError(null); recheck.mutate(); }} loading={recheck.isPending} />
            <Button label="Back to fees" variant="secondary" onPress={() => router.back()} />
          </Card>
        ) : (
          <View style={styles.form}>
            <Card style={{ gap: space.xs }}>
              <Text style={[type.overline, { color: colors.muted }]}>{title}</Text>
              <Text style={[styles.amount, { color: colors.text }]}>{formatCurrency(balance, invoice.currency)}</Text>
              <Text style={[type.caption, { color: colors.muted }]}>
                {[invoice.childName, `Invoice #${invoice.invoiceNumber}`, `Due ${formatDate(invoice.dueDate)}`].filter(Boolean).join(" · ")}
              </Text>
            </Card>

            {methods.isError ? <ErrorCard message={errorMessage(methods.error)} onRetry={() => methods.refetch()} />
              : (methods.data ?? []).length === 0 ? (
                <Card><EmptyState icon="credit-card" title="No payment methods" description="Your academy hasn't enabled online payments yet. Please contact them." /></Card>
              ) : (
                <>
                  <Card style={{ gap: space.xl }}>
                    <Field label="Payment method">
                      <Pills options={(methods.data ?? []).map((m) => ({ value: m.key, label: m.name }))} value={method} onChange={setMethod} />
                    </Field>
                    <Field
                      label="Amount (optional)"
                      hint={`Leave empty to pay the full ${formatCurrency(balance, invoice.currency)}, or enter a smaller instalment.`}
                      error={customInvalid ? `Enter an amount between ${formatCurrency(1, invoice.currency)} and ${formatCurrency(balance, invoice.currency)}.` : undefined}
                    >
                      <TextField value={custom} onChangeText={setCustom} keyboardType="decimal-pad" placeholder={String(Math.round(balance))} error={customInvalid} accessibilityLabel="Amount to pay" />
                    </Field>
                    {termsRequired && (
                      <CheckRow checked={accepted} onChange={setAccepted}>
                        I accept the academy&apos;s Terms &amp; Conditions for fee payments. (Asked once, before your first payment.)
                      </CheckRow>
                    )}
                  </Card>
                  {error && <Text style={[type.label, { color: colors.danger }]} accessibilityRole="alert">{error}</Text>}
                  <View style={{ gap: space.md }}>
                    <Button
                      label={`Pay ${formatCurrency(payAmount, invoice.currency)}`}
                      icon="lock"
                      onPress={() => pay.mutate()}
                      loading={pay.isPending}
                      disabled={!method || customInvalid || (termsRequired && !accepted)}
                    />
                    <Text style={[type.caption, { color: colors.muted, textAlign: "center", paddingHorizontal: space.md }]}>
                      {method === "cash" ? "Your academy will confirm the cash payment once they receive it." : "You'll complete the payment on the gateway's secure page, then return here."}
                    </Text>
                  </View>
                </>
              )}
          </View>
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl },
  amount: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -1 },
});

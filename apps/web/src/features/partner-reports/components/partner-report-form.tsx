"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { IconCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { AppSelect, FormField, LoadingButton } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SavePartnerReportFormValues } from "@/features/partner-reports/schemas/report.schema";
import { currencyOptionLabel } from "@/features/partner-reports/lib/currency";

type StepId =
  | "reporter"
  | "summary"
  | "financials"
  | "engagements"
  | "decisions"
  | "people";

const ALL_STEPS: { id: StepId; label: string }[] = [
  { id: "reporter", label: "Reporter & period" },
  { id: "summary", label: "Summary" },
  { id: "financials", label: "Financials" },
  { id: "engagements", label: "Engagements" },
  { id: "decisions", label: "Decisions" },
  { id: "people", label: "People & outlook" },
];

const STEP_FIELDS: Record<StepId, (keyof SavePartnerReportFormValues)[]> = {
  reporter: ["reportingOfficerName", "department", "periodType", "periodLabel"],
  summary: ["executiveSummary"],
  financials: ["currency", "billingItems", "remark"],
  engagements: ["engagementUpdates"],
  decisions: ["decisions"],
  people: ["peopleCapacity", "outlook"],
};

interface PartnerReportFormProps {
  form: UseFormReturn<SavePartnerReportFormValues>;
  financialsEnabled?: boolean;
  onSaveDraft: () => void | Promise<void>;
  onSubmitReport: () => void | Promise<void>;
  saving?: boolean;
  submitting?: boolean;
}

function parseAmount(value: string | undefined): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Round to 2dp then format with thousand separators (e.g. 12,222.00). */
function formatMoney(n: number | null): string {
  if (n == null) return "—";
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PartnerReportForm({
  form,
  financialsEnabled = true,
  onSaveDraft,
  onSubmitReport,
  saving,
  submitting,
}: PartnerReportFormProps) {
  const steps = useMemo(
    () =>
      financialsEnabled
        ? ALL_STEPS
        : ALL_STEPS.filter((s) => s.id !== "financials"),
    [financialsEnabled],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;
  const isLast = stepIndex >= steps.length - 1;

  const billings = useFieldArray({
    control: form.control,
    name: "billingItems",
  });
  const updates = useFieldArray({
    control: form.control,
    name: "engagementUpdates",
  });
  const decisions = useFieldArray({ control: form.control, name: "decisions" });
  // useWatch tracks nested field edits; form.watch + useMemo can miss in-place updates.
  const billingWatch =
    useWatch({ control: form.control, name: "billingItems" }) ?? [];

  const totals = (() => {
    let fee = 0;
    let collections = 0;
    let any = false;
    let overCollected = false;
    for (const item of billingWatch) {
      const bill = parseAmount(item.amount);
      const received = parseAmount(item.amountReceived) ?? 0;
      if (bill == null) continue;
      fee += bill;
      collections += received;
      if (received > bill) overCollected = true;
      any = true;
    }
    if (!any) {
      return {
        fee: null as number | null,
        collections: null as number | null,
        outstanding: null as number | null,
        overCollected: false,
      };
    }
    const feeR = Math.round((fee + Number.EPSILON) * 100) / 100;
    const colR = Math.round((collections + Number.EPSILON) * 100) / 100;
    return {
      fee: feeR,
      collections: colR,
      outstanding: Math.round((feeR - colR + Number.EPSILON) * 100) / 100,
      overCollected,
    };
  })();

  async function goNext() {
    const ok = await form.trigger(STEP_FIELDS[step.id]);
    if (!ok) return;
    if (isLast) {
      await onSubmitReport();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Report steps" className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <button
              key={s.id}
              type="button"
              disabled={i > stepIndex}
              onClick={() => {
                if (i <= stepIndex) setStepIndex(i);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                active && "border-primary bg-primary/10 text-primary",
                done && !active && "border-border bg-muted/40 text-foreground",
                !done &&
                  !active &&
                  "border-border bg-background text-muted-foreground",
                i > stepIndex && "cursor-not-allowed opacity-50",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px]",
                  active || done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {done ? <IconCheck className="size-2.5" /> : i + 1}
              </span>
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        {step.id === "reporter" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Name"
              required
              error={form.formState.errors.reportingOfficerName?.message}
            >
              <Input {...form.register("reportingOfficerName")} />
            </FormField>
            <FormField
              label="Company / Department"
              required
              error={form.formState.errors.department?.message}
            >
              <Input {...form.register("department")} />
            </FormField>
            <FormField label="Period type" required>
              <AppSelect
                value={form.watch("periodType")}
                onValueChange={(v) =>
                  form.setValue(
                    "periodType",
                    v as SavePartnerReportFormValues["periodType"],
                  )
                }
                options={[
                  { value: "Weekly", label: "Weekly" },
                  { value: "Monthly", label: "Monthly" },
                  { value: "Quarterly", label: "Quarterly" },
                  { value: "AdHoc", label: "Ad hoc" },
                ]}
              />
            </FormField>
            <FormField label="Period label">
              <Input
                placeholder="e.g. Week ending 7 Aug 2026"
                {...form.register("periodLabel")}
              />
            </FormField>
          </div>
        ) : null}

        {step.id === "summary" ? (
          <FormField label="Executive summary">
            <Textarea rows={6} {...form.register("executiveSummary")} />
          </FormField>
        ) : null}

        {step.id === "financials" ? (
          <div className="space-y-4">
            <FormField label="Currency" className="max-w-xs">
              <AppSelect
                value={form.watch("currency") || ""}
                onValueChange={(v) =>
                  form.setValue(
                    "currency",
                    v as SavePartnerReportFormValues["currency"],
                  )
                }
                placeholder="Select"
                options={[
                  { value: "NGN", label: currencyOptionLabel("NGN") },
                  { value: "USD", label: currencyOptionLabel("USD") },
                ]}
              />
            </FormField>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Billings</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    billings.append({
                      description: "",
                      amount: "",
                      amountReceived: "",
                    })
                  }
                >
                  <IconPlus className="size-4" />
                  Add line
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Bill amount
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Amount received
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Balance
                      </th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {billings.fields.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          No billing lines yet — add a line to start.
                        </td>
                      </tr>
                    ) : (
                      billings.fields.map((field, index) => {
                        const bill = parseAmount(billingWatch[index]?.amount);
                        const received =
                          parseAmount(billingWatch[index]?.amountReceived) ?? 0;
                        const balance = bill == null ? null : bill - received;
                        const over = balance != null && balance < 0;
                        return (
                          <tr key={field.id} className="border-t border-border">
                            <td className="px-2 py-1.5">
                              <Input
                                placeholder="Description"
                                className="h-9 border-border bg-background shadow-sm"
                                {...form.register(
                                  `billingItems.${index}.description`,
                                )}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                placeholder="0.00"
                                className="h-9 border-border bg-background text-right tabular-nums shadow-sm"
                                {...form.register(
                                  `billingItems.${index}.amount`,
                                )}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input
                                placeholder="0.00"
                                className={cn(
                                  "h-9 border-border bg-background text-right tabular-nums shadow-sm",
                                  over &&
                                    "border-destructive/50 text-destructive",
                                )}
                                {...form.register(
                                  `billingItems.${index}.amountReceived`,
                                )}
                              />
                            </td>
                            <td
                              className={cn(
                                "px-3 py-1.5 text-right font-medium tabular-nums",
                                over
                                  ? "text-destructive"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatMoney(balance)}
                            </td>
                            <td className="px-1 py-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="px-2"
                                onClick={() => billings.remove(index)}
                                aria-label="Remove billing line"
                              >
                                <IconTrash className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/40">
                    <tr>
                      <td className="px-3 py-3 text-sm font-semibold tracking-tight">
                        Total amount
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="block whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Fee revenue
                        </span>
                        <span className="text-base font-semibold tabular-nums tracking-tight">
                          {formatMoney(totals.fee)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="block whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Collections
                        </span>
                        <span className="text-base font-semibold tabular-nums tracking-tight">
                          {formatMoney(totals.collections)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="block whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Outstanding
                        </span>
                        <span
                          className={cn(
                            "text-base font-semibold tabular-nums tracking-tight",
                            totals.outstanding != null &&
                              totals.outstanding < 0 &&
                              "text-destructive",
                          )}
                        >
                          {formatMoney(totals.outstanding)}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {totals.overCollected ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  One or more lines show amount received exceeding bill amount
                  (highlighted in red). You can still save — confirm this is
                  intended and explain in remarks field bellow.
                </p>
              ) : null}
            </div>

            <FormField label="Remark">
              <Textarea
                rows={3}
                placeholder="Optional notes on the financials"
                {...form.register("remark")}
              />
            </FormField>
          </div>
        ) : null}

        {step.id === "engagements" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updates.append({
                    clientEngagement: "",
                    update: "",
                    status: "OnTrack",
                  })
                }
              >
                <IconPlus className="size-4" />
                Add
              </Button>
            </div>
            {updates.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No engagement updates yet.
              </p>
            ) : (
              <div className="space-y-2">
                {updates.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1fr_1fr_8rem_auto]"
                  >
                    <Input
                      placeholder="Client / engagement"
                      {...form.register(
                        `engagementUpdates.${index}.clientEngagement`,
                      )}
                    />
                    <Input
                      placeholder="Update"
                      {...form.register(`engagementUpdates.${index}.update`)}
                    />
                    <AppSelect
                      value={form.watch(`engagementUpdates.${index}.status`)}
                      onValueChange={(v) =>
                        form.setValue(
                          `engagementUpdates.${index}.status`,
                          v as "OnTrack" | "Watch" | "AtRisk" | "NewWin",
                        )
                      }
                      options={[
                        { value: "OnTrack", label: "On track" },
                        { value: "Watch", label: "Watch" },
                        { value: "AtRisk", label: "At risk" },
                        { value: "NewWin", label: "New win" },
                      ]}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      onClick={() => updates.remove(index)}
                      aria-label="Remove update"
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {step.id === "decisions" ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  decisions.append({ decision: "", priority: "ThisPeriod" })
                }
              >
                <IconPlus className="size-4" />
                Add
              </Button>
            </div>
            {decisions.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No decisions listed.
              </p>
            ) : (
              <div className="space-y-2">
                {decisions.fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1fr_10rem_auto]"
                  >
                    <Input
                      placeholder="Decision needed"
                      {...form.register(`decisions.${index}.decision`)}
                    />
                    <AppSelect
                      value={form.watch(`decisions.${index}.priority`)}
                      onValueChange={(v) =>
                        form.setValue(
                          `decisions.${index}.priority`,
                          v as "Urgent" | "ThisPeriod" | "ForInformation",
                        )
                      }
                      options={[
                        { value: "Urgent", label: "Urgent" },
                        { value: "ThisPeriod", label: "This period" },
                        { value: "ForInformation", label: "For information" },
                      ]}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      onClick={() => decisions.remove(index)}
                      aria-label="Remove decision"
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {step.id === "people" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="People & capacity">
              <Textarea rows={4} {...form.register("peopleCapacity")} />
            </FormField>
            <FormField label="Outlook">
              <Textarea rows={4} {...form.register("outlook")} />
            </FormField>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button
          type="button"
          variant="outline"
          disabled={stepIndex === 0}
          onClick={goBack}
        >
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <LoadingButton
            type="button"
            variant="outline"
            loading={Boolean(saving)}
            onClick={() => void onSaveDraft()}
          >
            Save draft
          </LoadingButton>
          <LoadingButton
            type="button"
            loading={Boolean(submitting || (isLast && saving))}
            onClick={() => void goNext()}
          >
            {isLast ? "Submit" : "Next"}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

/** Map form values to API body (drop empty optionals). */
export function toSavePayload(values: SavePartnerReportFormValues) {
  return {
    reportingOfficerName: values.reportingOfficerName.trim(),
    department: values.department.trim(),
    periodType: values.periodType,
    periodLabel: values.periodLabel?.trim() || undefined,
    executiveSummary: values.executiveSummary?.trim() || undefined,
    currency: values.currency || undefined,
    billingItems: values.billingItems
      .filter((b) => b.description.trim() && b.amount.trim())
      .map((b) => ({
        description: b.description.trim(),
        amount: b.amount.trim(),
        amountReceived: b.amountReceived.trim() || "0",
      })),
    remark: values.remark?.trim() || undefined,
    peopleCapacity: values.peopleCapacity?.trim() || undefined,
    outlook: values.outlook?.trim() || undefined,
    engagementUpdates: values.engagementUpdates.filter(
      (u) => u.clientEngagement.trim() && u.update.trim(),
    ),
    decisions: values.decisions.filter((d) => d.decision.trim()),
  };
}

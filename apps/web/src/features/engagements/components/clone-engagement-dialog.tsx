"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormDialog, FormField, LoadingButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { useCloneEngagement } from "@/features/engagements/hooks/use-engagements";
import { BffClientError } from "@/lib/bff/client";

export function CloneEngagementDialog({
  engagementId,
  sourcePeriodLabel,
  open,
  onOpenChange,
  onCloned,
}: {
  engagementId: string;
  sourcePeriodLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloned: (id: string) => void;
}) {
  const clone = useCloneEngagement(engagementId);
  const [periodLabel, setPeriodLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetCompletionDate, setTargetCompletionDate] = useState("");

  useEffect(() => {
    if (open) setPeriodLabel(sourcePeriodLabel ?? "");
  }, [open, sourcePeriodLabel]);

  async function submit() {
    try {
      const created = await clone.mutateAsync({
        periodLabel: periodLabel.trim() || undefined,
        startDate: startDate || undefined,
        targetCompletionDate: targetCompletionDate || undefined,
      });
      toast.success("Engagement cloned in Planning");
      onOpenChange(false);
      onCloned(created.id);
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : "Failed to clone engagement");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Clone for new period"
      description="Copies the engagement setup and request classes. Team members, requests, and documents are not copied."
      footer={
        <LoadingButton type="button" loading={clone.isPending} onClick={submit}>
          Clone engagement
        </LoadingButton>
      }
    >
      <div className="space-y-4">
        <FormField label="Period label">
          <Input value={periodLabel} onChange={(event) => setPeriodLabel(event.target.value)} placeholder="e.g. FY27" />
        </FormField>
        <FormField label="Start date">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </FormField>
        <FormField label="Target completion date">
          <Input type="date" value={targetCompletionDate} onChange={(event) => setTargetCompletionDate(event.target.value)} />
        </FormField>
      </div>
    </FormDialog>
  );
}

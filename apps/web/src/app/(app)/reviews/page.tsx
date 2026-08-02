'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { DataTable } from '@/components/data/data-table';
import { AppSelect, FormDialog, FormField, LoadingButton } from '@/components/forms';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  type Review,
  type ReviewDecision,
  useDecideReview,
  useReviewsList,
} from '@/features/reviews/hooks/use-reviews';
import { BffClientError } from '@/lib/bff/client';

export default function ReviewsPage() {
  const { can } = useAuthContext();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Review | null>(null);
  const reviews = useReviewsList(`status=ForReview&page=${page}&pageSize=20`);

  const columns = useMemo<ColumnDef<Review, unknown>[]>(
    () => [
      {
        header: 'Item',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.requestId ? 'Request review' : 'Document review'}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.requestId ?? row.original.documentId}
            </p>
          </div>
        ),
      },
      { header: 'Submitted by', cell: ({ row }) => row.original.preparerName || '—' },
      {
        header: 'Submitted',
        cell: ({ row }) => new Date(row.original.submittedAt).toLocaleString(),
      },
      { header: 'Status', cell: () => <Badge variant="outline">Pending</Badge> },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              setSelected(row.original);
            }}
          >
            Decide
          </Button>
        ),
      },
    ],
    [],
  );

  if (!can('review:decide')) {
    return (
      <div className="space-y-5">
        <PageToolbar title="Reviews" breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Reviews' }]} />
        <p className="text-sm text-destructive">You do not have permission to decide reviews.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageToolbar
        title="Review queue"
        description="Items assigned to you and awaiting a decision"
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Reviews' }]}
      />
      <DataTable
        columns={columns}
        data={reviews.data?.data ?? []}
        meta={reviews.data?.meta}
        isPending={reviews.isPending || reviews.isFetching}
        error={reviews.isError ? 'Failed to load reviews' : null}
        onPageChange={setPage}
        onRowClick={setSelected}
        emptyMessage="No reviews are awaiting your decision"
      />
      {selected ? (
        <DecideReviewDialog
          review={selected}
          open
          onOpenChange={(open) => !open && setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function DecideReviewDialog({
  review,
  open,
  onOpenChange,
}: {
  review: Review;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const decide = useDecideReview();
  const [decision, setDecision] = useState<ReviewDecision>('Approved');
  const [notes, setNotes] = useState('');
  const targetHref = review.requestId ? `/requests/${review.requestId}` : null;

  async function submit() {
    if (decision === 'SentBack' && !notes.trim()) {
      toast.error('Notes are required when sending work back');
      return;
    }
    try {
      await decide.mutateAsync({ id: review.id, decision, notes: notes.trim() || undefined });
      toast.success(decision === 'Approved' ? 'Review approved' : 'Review sent back');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to decide review');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Decide review"
      description={`Submitted by ${review.preparerName || 'a team member'}.`}
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          {targetHref ? (
            <Button type="button" variant="outline" asChild>
              <Link href={targetHref}>Open request</Link>
            </Button>
          ) : null}
          <LoadingButton type="button" loading={decide.isPending} onClick={submit}>
            Save decision
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Decision" required>
          <AppSelect
            value={decision}
            onValueChange={(value) => setDecision(value as ReviewDecision)}
            options={[
              { value: 'Approved', label: 'Approved' },
              { value: 'SentBack', label: 'Sent back' },
            ]}
          />
        </FormField>
        <FormField label="Notes" required={decision === 'SentBack'}>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
        </FormField>
      </div>
    </FormDialog>
  );
}

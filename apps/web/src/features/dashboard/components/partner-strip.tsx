'use client';

import Link from 'next/link';
import { IconArrowUpRight, IconFilePlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS, ChartLegend, DonutChart, type DonutSlice } from './charts';
import { DASH_ASSETS, SceneBanner } from './decor';
import type { PartnerStrip } from '../types';

export function PartnerStripCard({ partner }: { partner: PartnerStrip }) {
  if (partner.mode === 'principal') {
    const slices: DonutSlice[] = [
      { name: 'Awaiting review', value: partner.awaitingReview, color: CHART_COLORS.amber },
      { name: 'Reviewed', value: partner.reviewed, color: CHART_COLORS.primary },
      { name: 'Drafts', value: partner.drafts, color: CHART_COLORS.slate },
    ];

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Reports</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Principal review pipeline
            </p>
          </div>
          <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
            <Link href="/reports">
              Open
              <IconArrowUpRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-4 sm:grid-cols-2">
            <DonutChart
              data={slices}
              centerValue={String(partner.total)}
              centerLabel="reports"
              height={150}
            />
            <div className="space-y-3">
              <ChartLegend items={slices} />
              {partner.awaitingDecision > 0 ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {partner.awaitingDecision} matter
                  {partner.awaitingDecision === 1 ? '' : 's'} awaiting your decision
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const nudge =
    partner.expectation === 'requested'
      ? 'The Principal requested a report'
      : partner.expectation === 'due'
        ? 'A report is due for this period'
        : 'Draft and submit your reports when ready.';

  return (
    <SceneBanner
      title="My reporting"
      description={nudge}
      art={DASH_ASSETS.pdf}
      artDark={DASH_ASSETS.pdfDark}
      artSize={72}
      actions={
        partner.canSubmit ? (
          <Button asChild size="sm">
            <Link href="/reports/new">
              <IconFilePlus className="size-4" />
              New report
            </Link>
          </Button>
        ) : (
          <div className="flex flex-wrap gap-5">
            {[
              { label: 'Drafts', value: partner.drafts },
              { label: 'Submitted', value: partner.submitted },
              { label: 'Reviewed', value: partner.reviewed },
            ].map((s) => (
              <Link key={s.label} href="/reports" className="group text-right">
                <p className="text-2xl font-bold tabular-nums group-hover:text-primary">
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Link>
            ))}
          </div>
        )
      }
    />
  );
}

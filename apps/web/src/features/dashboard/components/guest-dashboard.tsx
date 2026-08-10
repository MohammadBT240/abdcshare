'use client';

import Link from 'next/link';
import { IconCircleCheck, IconFilePlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttentionList } from './attention-list';
import { CHART_COLORS, ChartLegend, DonutChart, type DonutSlice } from './charts';
import { DASH_ASSETS, SceneBanner } from './decor';
import type { GuestDashboard as GuestData } from '../types';

export function GuestDashboard({ data }: { data: GuestData }) {
  const { reporting } = data;
  const nudge =
    reporting.expectation === 'requested'
      ? 'The Principal has requested your report.'
      : reporting.expectation === 'due'
        ? 'Your report is due for this period.'
        : 'Submit whenever you are ready — reporting is never blocked.';

  const slices: DonutSlice[] = [
    { name: 'Drafts', value: reporting.drafts, color: CHART_COLORS.amber },
    { name: 'Submitted', value: reporting.submitted, color: CHART_COLORS.sky },
    { name: 'Reviewed', value: reporting.reviewed, color: CHART_COLORS.primary },
  ];
  const total = reporting.drafts + reporting.submitted + reporting.reviewed;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SceneBanner
        title="Principal reporting"
        description={
          reporting.requestNote ? `${nudge} “${reporting.requestNote}”` : nudge
        }
        art={DASH_ASSETS.pdf}
        artDark={DASH_ASSETS.pdfDark}
        artSize={80}
        actions={
          reporting.canSubmit ? (
            <Button asChild>
              <Link href="/reports/new">
                <IconFilePlus className="size-4" />
                New report
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DonutChart
              data={slices}
              centerValue={String(total)}
              centerLabel="reports"
              height={160}
            />
            <ChartLegend items={slices} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {[
                'Draft your report — save as many times as you need',
                'Submit it to the Principal when ready',
                'The Principal reviews and may leave notes',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <IconCircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/reports">View my reports</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <AttentionList items={data.attention} />
    </div>
  );
}

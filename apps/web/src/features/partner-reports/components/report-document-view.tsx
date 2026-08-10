'use client';

import { formatStatusLabel } from '@/components/data';
import type { PartnerReport } from '@/features/partner-reports/hooks/use-partner-reports';
import {
  currencySymbol,
  formatReportMoney,
} from '@/features/partner-reports/lib/currency';
import { cn } from '@/lib/utils';

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseMoney(value: string | null | undefined): number {
  return Number(String(value ?? '0').replace(/,/g, '')) || 0;
}

function lineBalance(amount: string, received: string): number {
  return parseMoney(amount) - parseMoney(received);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-end gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800 dark:text-teal-300">
          {title}
        </h2>
        <div className="mb-1 h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}

export function ReportDocumentView({ report }: { report: PartnerReport }) {
  const billings = report.billingItems ?? [];
  const hasFinancials =
    Boolean(report.currency) ||
    billings.length > 0 ||
    Boolean(report.feeRevenue) ||
    Boolean(report.collectionsReceived) ||
    Boolean(report.outstanding) ||
    Boolean(report.remark?.trim());

  return (
    <article className="mx-auto max-w-3xl rounded-xl border border-border bg-card shadow-sm">
      <div className="space-y-6 px-6 py-7 sm:px-10 sm:py-9">
        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Confidential — For the Principal
          </p>
          <div className="mt-3 h-px bg-border" />
          <div className="pt-4">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {report.department}
            </h1>
            <p className="mt-1 text-base font-medium text-foreground">
              {report.reportingOfficerName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[formatStatusLabel(report.periodType), report.periodLabel, formatStatusLabel(report.status)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </header>

        <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Submitted {fmtDate(report.submittedAt)}
            {report.reviewedAt ? ` · Reviewed ${fmtDate(report.reviewedAt)}` : ''}
          </p>
        </div>

        <Section title="Executive summary">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {report.executiveSummary?.trim() || 'No executive summary provided.'}
          </p>
        </Section>

        {hasFinancials ? (
          <Section title="Financials">
            <p className="text-sm text-muted-foreground">
              Currency ·{' '}
              {report.currency
                ? `${currencySymbol(report.currency)} (${report.currency})`
                : '—'}
            </p>
            {billings.length ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Bill amount</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billings.map((b, i) => {
                      const balance = lineBalance(b.amount, b.amountReceived ?? '0');
                      const over = balance < 0;
                      return (
                        <tr key={`${b.description}-${i}`} className="border-t border-border">
                          <td className="px-3 py-2">{b.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatReportMoney(report.currency, b.amount)}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right tabular-nums font-medium',
                              over && 'text-destructive',
                            )}
                          >
                            {formatReportMoney(report.currency, b.amountReceived ?? '0')}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right tabular-nums',
                              over ? 'font-medium text-destructive' : 'text-muted-foreground',
                            )}
                          >
                            {formatReportMoney(report.currency, balance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-border bg-muted/30">
                    <tr>
                      <td className="px-3 py-2.5 text-sm font-semibold">Total amount</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="block whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Fee revenue
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatReportMoney(report.currency, report.feeRevenue)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="block whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Collections
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatReportMoney(report.currency, report.collectionsReceived)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="block whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Outstanding
                        </span>
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            parseMoney(report.outstanding) < 0 && 'text-destructive',
                          )}
                        >
                          {formatReportMoney(report.currency, report.outstanding)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No billing lines.</p>
            )}
            {report.remark?.trim() ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Remark · </span>
                {report.remark}
              </p>
            ) : null}
          </Section>
        ) : null}

        <Section title="Client / engagement updates">
          {(report.engagementUpdates ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No engagement updates listed.</p>
          ) : (
            <ul className="space-y-3">
              {report.engagementUpdates.map((u, i) => (
                <li key={`${u.clientEngagement}-${i}`} className="space-y-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{u.clientEngagement}</p>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      {formatStatusLabel(u.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{u.update}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Matters for decision">
          {(report.decisions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions listed.</p>
          ) : (
            <ul className="space-y-2">
              {report.decisions.map((d, i) => (
                <li key={`${d.decision}-${i}`} className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm">{d.decision}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatStatusLabel(d.priority)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="People & capacity">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {report.peopleCapacity?.trim() || '—'}
          </p>
        </Section>

        <Section title="Outlook">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {report.outlook?.trim() || '—'}
          </p>
        </Section>

        {report.reviewNotes?.trim() ? (
          <Section title="Principal notes">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.reviewNotes}</p>
          </Section>
        ) : null}
      </div>
    </article>
  );
}

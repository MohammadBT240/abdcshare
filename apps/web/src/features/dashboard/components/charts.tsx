'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

/** ACA-themed chart palette (green-led, matching the brand tokens). */
export const CHART_COLORS = {
  primary: 'hsl(146 64% 28%)',
  primarySoft: 'hsl(146 45% 55%)',
  amber: 'hsl(38 92% 45%)',
  red: 'hsl(353 62% 43%)',
  sky: 'hsl(200 90% 40%)',
  violet: 'hsl(262 65% 55%)',
  slate: 'hsl(215 15% 60%)',
} as const;

export const SERIES_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.sky,
  CHART_COLORS.amber,
  CHART_COLORS.violet,
  CHART_COLORS.red,
  CHART_COLORS.slate,
];

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  fontSize: 12,
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
};

export interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  height = 200,
}: {
  data: DonutSlice[];
  centerValue?: string;
  centerLabel?: string;
  height?: number;
}) {
  const filtered = data.filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered.length ? filtered : [{ name: 'None', value: 1 }]}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            outerRadius="95%"
            paddingAngle={filtered.length > 1 ? 3 : 0}
            strokeWidth={0}
            cornerRadius={4}
          >
            {(filtered.length ? filtered : [{ name: 'None', value: 1, color: 'hsl(var(--muted))' }]).map(
              (entry, i) => (
                <Cell
                  key={entry.name}
                  fill={entry.color ?? SERIES_PALETTE[i % SERIES_PALETTE.length]}
                />
              ),
            )}
          </Pie>
          {filtered.length ? <Tooltip contentStyle={tooltipStyle} /> : null}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{centerValue ?? total}</span>
        {centerLabel ? (
          <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

export function ChartLegend({ items }: { items: DonutSlice[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={item.name} className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: item.color ?? SERIES_PALETTE[i % SERIES_PALETTE.length] }}
            />
            {item.name}
          </span>
          <span className="font-semibold tabular-nums">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function WeeklyActivityChart({
  data,
  height = 220,
}: {
  data: Array<{ label: string; created: number; completed: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
        <Bar dataKey="created" name="Created" fill={CHART_COLORS.sky} radius={[3, 3, 0, 0]} maxBarSize={18} />
        <Bar dataKey="completed" name="Completed" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendAreaChart({
  data,
  color = CHART_COLORS.primary,
  height = 120,
  name = 'Events',
}: {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
  name?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="value"
          name={name}
          stroke={color}
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DayBarsChart({
  data,
  height = 140,
  color = CHART_COLORS.primary,
  highlightColor = CHART_COLORS.red,
  name = 'Due',
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  highlightColor?: string;
  name?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -26, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
        <Bar dataKey="value" name={name} radius={[3, 3, 0, 0]} maxBarSize={26}>
          {data.map((d, i) => (
            <Cell key={i} fill={i === 0 && d.value > 0 ? highlightColor : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** SmartHR-style multi-color distribution bar with a legend underneath. */
export function SegmentedBar({ segments, className }: { segments: Segment[]; className?: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className={className}>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {total === 0 ? (
          <div className="h-full w-full bg-muted" />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.label}
                className="h-full transition-all"
                style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
                title={`${s.label}: ${s.value}`}
              />
            ))
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
            <span className="font-semibold text-foreground tabular-nums">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** SVG completion ring with a value in the middle. */
export function ProgressRing({
  percent,
  size = 120,
  strokeWidth = 10,
  color = CHART_COLORS.primary,
  label,
  className,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{Math.round(clamped)}%</span>
        {label ? <span className="text-[10px] text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  );
}

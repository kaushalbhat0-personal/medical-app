import {
  BarChart3,
  CalendarCheck,
  CircleDollarSign,
  Receipt,
  Wallet,
} from 'lucide-react';
import dayjs from 'dayjs';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import { ErrorState, EmptyState } from '../components/common';
import { SkeletonCard, SkeletonTable } from '../components/common/skeletons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function RevenueLineChart({
  data,
  className,
}: {
  data: { date: string; revenue: number }[];
  className?: string;
}) {
  const w = 100;
  const h = 40;
  const padX = 4;
  const padY = 4;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const maxRev = Math.max(...data.map((d) => d.revenue), 0.0001);
  const n = data.length;
  const points = data.map((d, i) => {
    const x = n <= 1 ? w / 2 : padX + (i / (n - 1)) * innerW;
    const y = padY + innerH * (1 - d.revenue / maxRev);
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  return (
    <div className={cn('w-full', className)}>
      <div className="relative w-full" style={{ minHeight: 200 }}>
        <svg
          className="h-48 w-full text-primary"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Revenue over the last 7 days"
        >
          <line
            x1={padX}
            y1={h - padY}
            x2={w - padX}
            y2={h - padY}
            className="stroke-border"
            strokeWidth={0.3}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={pathD}
            fill="none"
            className="stroke-primary"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="mt-1 flex w-full justify-between gap-0.5 px-0.5 sm:px-1">
          {data.map((row) => (
            <span
              key={row.date}
              className="text-[10px] text-muted-foreground sm:text-xs"
              style={{ maxWidth: `${100 / n}%` }}
            >
              {dayjs(row.date).format('M/D')}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">Date</p>
    </div>
  );
}

export function AdminDashboard() {
  const { metrics, revenueTrend, doctorPerformance, loading, error, refetch } = useAdminDashboard();

  const showSkeletons = loading && !error;
  const trendEmpty = !error && !loading && revenueTrend.every((d) => d.revenue === 0);
  const noDoctors = !error && !loading && doctorPerformance.length === 0;

  return (
    <div className="page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {showSkeletons && (
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <div className="h-8 w-56 animate-pulse rounded-xl bg-surface" />
            <div className="h-4 w-80 animate-pulse rounded-lg bg-surface" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="h-56 animate-pulse rounded-xl bg-surface" />
          <SkeletonTable rows={4} columns={4} />
        </div>
      )}

      {error && (
        <ErrorState
          title="Failed to load admin dashboard"
          description="Unable to fetch admin metrics. Please try again."
          error={error}
          onRetry={() => void refetch()}
        />
      )}

      {!error && !loading && metrics && (
        <div className="space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-2xl font-semibold">Admin dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">KPIs, revenue trend, and doctor performance</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
            <Card className="rounded-xl border border-border shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Total revenue</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatCurrency(metrics.total_revenue)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-border shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Revenue today</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatCurrency(metrics.revenue_today)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-border shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Appointments today</p>
                  <p className="text-2xl font-semibold tabular-nums">{metrics.appointments_today}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-border shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Completed appointments</p>
                  <p className="text-2xl font-semibold tabular-nums">{metrics.completed_appointments}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border border-border shadow-sm sm:col-span-2 lg:col-span-1">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Pending bills</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatCurrency(metrics.pending_bills)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Revenue (7 days)</CardTitle>
              <p className="text-sm text-muted-foreground">Paid bill amounts by day</p>
            </CardHeader>
            <CardContent>
              {revenueTrend.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No data</div>
              ) : (
                <>
                  {trendEmpty && (
                    <p className="mb-2 text-sm text-muted-foreground">
                      All days show $0.00 in this window
                    </p>
                  )}
                  <RevenueLineChart data={revenueTrend} />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Doctor performance</CardTitle>
              <p className="text-sm text-muted-foreground">Last 7 days, sorted by revenue</p>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              {noDoctors ? (
                <div className="px-6 py-4">
                  <EmptyState
                    title="No doctors"
                    description="Add doctors to see performance metrics for your tenant."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Doctor name</TableHead>
                        <TableHead className="text-right">Appointments</TableHead>
                        <TableHead className="text-right">Completed</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doctorPerformance.map((row) => (
                        <TableRow key={row.doctor_id}>
                          <TableCell className="font-medium">{row.doctor_name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.appointments_count}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.completed_appointments}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(row.total_revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

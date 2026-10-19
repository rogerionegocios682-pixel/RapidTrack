'use client';

/**
 * Gráficos do dashboard/relatórios (Recharts).
 * Recebem dados já calculados pelo servidor a partir do banco.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/format';
import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from '@/lib/types';

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  pending: '#b1b8c9',
  dispatched: '#2f66ff',
  in_progress: '#f59e0b',
  delivered: '#10b981',
  cancelled: '#f43f5e',
  customer_not_found: '#fb923c',
};

const money = (v: number) => formatMoney(Number(v));

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card card-pad">
      <div className="mb-4">
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="card-sub mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-full place-items-center text-sm text-ink-400">
      Sem dados no período
    </div>
  );
}

/* ---------------- Corridas por empresa ---------------- */
export function DeliveriesByCompanyChart({
  data,
}: {
  data: { name: string; total: number; fees: number }[];
}) {
  return (
    <ChartCard title="Corridas por empresa" subtitle="Hoje">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#687391' }}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={56}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#687391' }} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #d5d9e2', fontSize: 12 }}
              formatter={(v: number) => [v, 'Corridas']}
            />
            <Bar dataKey="total" fill="#2f66ff" radius={[6, 6, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ---------------- Corridas por motoboy ---------------- */
export function DeliveriesByMotoboyChart({
  data,
}: {
  data: { name: string; total: number; delivered: number }[];
}) {
  return (
    <ChartCard title="Corridas por motoboy" subtitle="Hoje · total e entregues">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#687391' }}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={56}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#687391' }} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #d5d9e2', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="total" name="Total" fill="#2f66ff" radius={[6, 6, 0, 0]} maxBarSize={32} />
            <Bar
              dataKey="delivered"
              name="Entregues"
              fill="#10b981"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ---------------- Status das corridas ---------------- */
export function StatusPieChart({
  data,
}: {
  data: { status: DeliveryStatus; total: number }[];
}) {
  const chartData = data
    .filter((d) => d.total > 0)
    .map((d) => ({
      name: DELIVERY_STATUS_LABEL[d.status],
      value: d.total,
      color: STATUS_COLORS[d.status],
    }));

  return (
    <ChartCard title="Status das corridas" subtitle="Distribuição de hoje">
      {chartData.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={88}
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #d5d9e2', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ---------------- Taxas por bairro ---------------- */
export function FeesByNeighborhoodChart({
  data,
}: {
  data: { name: string; total: number; fees: number }[];
}) {
  return (
    <ChartCard title="Taxas geradas no dia" subtitle="Por bairro (R$)">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 2, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#687391' }}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={56}
            />
            <YAxis tick={{ fontSize: 11, fill: '#687391' }} tickFormatter={(v) => money(v)} width={78} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #d5d9e2', fontSize: 12 }}
              formatter={(v: number) => [money(v), 'Taxas']}
            />
            <Bar dataKey="fees" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ---------------- Série diária (relatórios) ---------------- */
export function DailySeriesChart({
  data,
}: {
  data: { day: string; total: number; delivered: number; fees: number }[];
}) {
  return (
    <ChartCard title="Evolução diária" subtitle="Corridas e taxa média">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: '#687391' }}
              tickFormatter={(v: string) => v.slice(8, 10) + '/' + v.slice(5, 7)}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#687391' }} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #d5d9e2', fontSize: 12 }}
              formatter={(v: number, name: string) =>
                name === 'Taxas' ? [money(v), name] : [v, name]
              }
              labelFormatter={(v: string) => `Dia ${v}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="total"
              name="Corridas"
              stroke="#2f66ff"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="delivered"
              name="Entregues"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ---------------- Comparativo por motoboy (relatório) ---------------- */
export function MotoboyFeesChart({
  data,
}: {
  data: { name: string; fees: number; total: number }[];
}) {
  return (
    <ChartCard title="Taxas por motoboy" subtitle="Valores acumulados no período">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#687391' }}
              tickFormatter={(v) => money(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#687391' }}
              width={110}
            />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #d5d9e2', fontSize: 12 }}
              formatter={(v: number) => [money(v), 'Taxas']}
            />
            <Bar dataKey="fees" fill="#10b981" radius={[0, 6, 6, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/**
 * Pódio de produtividade dos motoboys do dia.
 * ---------------------------------------------------------------------------
 * Padrão visual adaptado do projeto de referência (Herculano Gestor) para a
 * identidade do Delivery_OS: usa os tokens `brand`/`ink`/`accent` do design
 * system atual, em vez do laranja/navy do ZIP.
 *
 * Os dados vêm SEMPRE do banco (via `getDashboardCharts`), nunca são fixos.
 */
import { Award, Bike, Medal, Trophy } from 'lucide-react';

export interface RankingItem {
  name: string;
  total: number;
  delivered: number;
}

const PODIUM = [
  {
    place: '1º LUGAR',
    icon: Trophy,
    card: 'border-accent-400/50 bg-accent-400/5 ring-1 ring-accent-400/30',
    badge: 'bg-accent-400/20 text-accent-600 ring-accent-400/40',
    iconColor: 'text-accent-500',
  },
  {
    place: '2º LUGAR',
    icon: Medal,
    card: 'border-ink-200 bg-ink-50/60',
    badge: 'bg-ink-200 text-ink-700 ring-ink-300',
    iconColor: 'text-ink-400',
  },
  {
    place: '3º LUGAR',
    icon: Award,
    card: 'border-ink-200 bg-ink-50/60',
    badge: 'bg-amber-100 text-amber-800 ring-amber-200',
    iconColor: 'text-amber-700',
  },
] as const;

export function MotoboyPodium({ data }: { data: RankingItem[] }) {
  // Considera apenas quem concluiu ao menos uma entrega, ordenando por
  // concluídas e, em empate, pelo total despachado.
  const ranking = [...data]
    .filter((d) => d.delivered > 0)
    .sort((a, b) => b.delivered - a.delivered || b.total - a.total)
    .slice(0, 3);

  if (ranking.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
        <Bike className="h-8 w-8 text-ink-300" />
        <p className="text-sm font-semibold text-ink-800">Sem destaques hoje</p>
        <p className="max-w-sm text-sm text-ink-500">
          O pódio aparece quando houver corridas concluídas no dia.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-3">
      {ranking.map((item, index) => {
        const meta = PODIUM[index];
        const Icon = meta.icon;
        return (
          <div
            key={item.name}
            className={`flex flex-col justify-between rounded-xl border p-4 transition ${meta.card}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`badge ${meta.badge} text-[10px] font-bold uppercase tracking-wide`}
              >
                {meta.place}
              </span>
              <Icon className={`h-5 w-5 ${meta.iconColor}`} />
            </div>
            <p className="mt-3 truncate text-sm font-semibold text-ink-900" title={item.name}>
              {item.name}
            </p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold leading-none text-ink-900">
                {item.delivered}
              </span>
              <span className="text-xs text-ink-500">
                entrega{item.delivered === 1 ? '' : 's'} concluída{item.delivered === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-500">{item.total} corrida(s) no dia</p>
          </div>
        );
      })}
    </div>
  );
}
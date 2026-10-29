"use client";

import { useId, useState } from "react";

// Graphiques du tableau de bord admin (maquette Stitch, couleurs de la charte Here!).
// Séries : rouge puis noir (validés : distincts en vision normale et pour les daltoniens, contraste ≥ 3:1).
// Un seul axe des valeurs ; infobulle --color-ink ; tableau pour les lecteurs d'écran.

export type Series = { label: string; one: string; many: string; values: number[] };

const SERIES_COLORS = ["var(--color-primary)", "var(--color-ink)"];

const dayFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "2-digit", month: "short" });
const fullDayFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(max / 4));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => s * 4 >= max) ?? step * 10;
  return nice * 4;
}

function count(n: number, s: Series): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? s.many : s.one}`;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-3 text-[12px] text-text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function DailyChart({
  title,
  days,
  series,
  kind,
}: {
  title: string;
  days: string[]; // AAAA-MM-JJ
  series: Series[]; // deux au plus
  kind: "bar" | "line";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const n = days.length;
  const top = niceMax(Math.max(...series.flatMap((s) => s.values), 0));
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const labelEvery = Math.ceil(n / 6);
  // Barres : centre de la colonne du jour ; courbe : de bord à bord.
  const x = (i: number) => (kind === "bar" ? ((i + 0.5) / n) * 100 : n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / top) * 100;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm lg:col-span-4" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-[15px] font-semibold">{title}</h2>
        <Legend items={series.map((s, i) => ({ label: s.label, color: SERIES_COLORS[i] }))} />
      </div>

      <div className="mt-auto grid grid-cols-[auto_1fr] gap-x-2" aria-hidden="true">
        <div className="relative h-[200px] w-7 font-data text-[10px] text-text-muted tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
              {t.toLocaleString("fr-FR")}
            </span>
          ))}
        </div>
        <div className="relative h-[200px]" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-border" style={{ top: `${y(t)}%` }} />
          ))}
          {kind === "bar" ? (
            <div className="absolute inset-0 flex items-end">
              {days.map((d, i) => (
                <div key={d} className="flex h-full flex-1 items-end justify-center gap-[2px] px-[1px]">
                  {series.map((s, k) => (
                    <div
                      key={s.label}
                      className="w-full max-w-[8px] rounded-t-[4px] transition-opacity"
                      style={{
                        background: SERIES_COLORS[k],
                        height: s.values[i] ? `max(${(s.values[i] / top) * 100}%, 2px)` : 0,
                        opacity: hover === null || hover === i ? 1 : 0.35,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,100 ${series[0].values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} 100,100`} fill={`url(#${gradient})`} />
              {/* La série principale en dernier : elle passe au-dessus. */}
              {[...series.keys()].reverse().map((k) => (
                <polyline
                  key={series[k].label}
                  points={series[k].values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                  fill="none"
                  stroke={SERIES_COLORS[k]}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {hover !== null ? (
                <line x1={x(hover)} x2={x(hover)} y1="0" y2="100" stroke="var(--color-text-muted)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              ) : null}
            </svg>
          )}
          {kind === "line" && hover !== null
            ? series.map((s, k) => (
                <span
                  key={s.label}
                  className="pointer-events-none absolute size-2.5 -translate-1/2 rounded-full border-2 border-background"
                  style={{ left: `${x(hover)}%`, top: `${y(s.values[hover])}%`, background: SERIES_COLORS[k] }}
                />
              ))
            : null}
          {/* Zones de survol : toute la colonne du jour, plus large que les marques. */}
          <div className="absolute inset-0 flex">
            {days.map((d, i) => (
              <div key={d} className="h-full flex-1" onMouseEnter={() => setHover(i)} />
            ))}
          </div>
          {hover !== null ? (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-md bg-ink px-3 py-2 text-[12px] whitespace-nowrap text-white shadow-md"
              style={{ left: `clamp(70px, ${x(hover)}%, calc(100% - 70px))` }}
            >
              {series.map((s, k) => (
                <p key={s.label} className="flex items-center gap-1.5 font-semibold">
                  <span className="size-2 rounded-full" style={{ background: k === 0 ? SERIES_COLORS[0] : "var(--color-white)" }} />
                  {count(s.values[hover], s)}
                </p>
              ))}
              <p className="text-gray-500">{fullDayFormat.format(new Date(days[hover]))}</p>
            </div>
          ) : null}
        </div>
        <div />
        <div className="relative mt-2 h-4 border-t border-border pt-1 font-data text-[10px] text-text-muted">
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <span
                key={d}
                className={`absolute whitespace-nowrap ${i === 0 && kind === "line" ? "" : i + labelEvery >= n ? "-translate-x-full" : "-translate-x-1/2"}`}
                style={{ left: `${x(i)}%` }}
              >
                {dayFormat.format(new Date(d))}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* Lecteurs d'écran : les valeurs en tableau (un <table> garde sa largeur : on masque son conteneur). */}
      <div className="sr-only">
        <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            {series.map((s) => (
              <th key={s.label} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d}>
              <td>{fullDayFormat.format(new Date(d))}</td>
              {series.map((s) => (
                <td key={s.label}>{s.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </section>
  );
}

/** Anneau de répartition : segments séparés par un espace, valeurs écrites dans la légende. */
export function Donut({ total, label, parts }: { total: number; label: string; parts: { label: string; value: number; color: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const gap = parts.filter((p) => p.value).length > 1 ? 1.5 : 0;
  const lengths = parts.map((p) => (total ? (p.value / total) * circumference : 0));
  const segments = parts.map((p, i) => ({
    ...p,
    dash: Math.max(lengths[i] - gap, 0),
    offset: lengths.slice(0, i).reduce((a, b) => a + b, 0),
  }));
  const shown = hover === null ? null : parts[hover];

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface)" strokeWidth="12" />
          {segments.map((s, i) =>
            s.dash ? (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === i ? 14 : 12}
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={-s.offset}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="transition-[stroke-width]"
              />
            ) : null,
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-data text-[24px] leading-none font-bold tabular-nums">{(shown ? shown.value : total).toLocaleString("fr-FR")}</span>
          <span className="mt-1 text-[11px] text-text-muted">{shown ? shown.label.toLocaleLowerCase("fr-FR") : label}</span>
        </div>
      </div>
      <ul className="grid min-w-[180px] flex-1 gap-2.5 text-[13px]">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center justify-between gap-3" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="flex items-center gap-2 text-text-muted">
              <span className="size-2.5 rounded-full" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="font-data tabular-nums">
              <span className="font-semibold">{p.value.toLocaleString("fr-FR")}</span>{" "}
              <span className="text-[12px] text-text-muted">
                ({total ? ((100 * p.value) / total).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0,0"} %)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useId, useState } from "react";

// Courbes du tableau de bord admin, selon DESIGN.md (« Graphiques ») : une seule série par graphique,
// en --color-primary, infobulle --color-ink. Plusieurs mesures : un onglet par mesure, jamais deux axes.

export type Series = { key: string; label: string; one: string; many: string; values: number[] };

const dayFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" });
const fullDayFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(max / 4));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => s * 4 >= max) ?? step * 10;
  return nice * 4;
}

export function DailyChart({
  title,
  days,
  series,
  kind,
}: {
  title: string;
  days: string[]; // AAAA-MM-JJ
  series: Series[];
  kind: "bar" | "line";
}) {
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const current = series[active];
  const values = current.values;
  const top = niceMax(Math.max(...values, 0));
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const total = values.reduce((a, b) => a + b, 0);
  const labelEvery = Math.ceil(days.length / 6);
  const n = days.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / top) * 100;
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <section className="grid content-start gap-4 rounded-lg bg-background p-5 shadow-sm" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-[16px] font-semibold">{title}</h2>
          <p className="text-[13px] text-text-muted">
            {total.toLocaleString("fr-FR")} {total > 1 ? current.many : current.one} sur la période
          </p>
        </div>
        {series.length > 1 ? (
          <div className="flex rounded-full bg-surface p-1" role="group" aria-label="Mesure affichée">
            {series.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                className={`h-8 rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  i === active ? "bg-background text-text shadow-sm" : "text-text-muted hover:text-text"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-2" aria-hidden="true">
        {/* Axe des valeurs */}
        <div className="relative h-[180px] w-7 font-data text-[11px] text-text-muted tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
              {t.toLocaleString("fr-FR")}
            </span>
          ))}
        </div>
        <div className="relative h-[180px]" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border" style={{ top: `${y(t)}%` }} />
          ))}
          {kind === "bar" ? (
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {values.map((v, i) => (
                <div key={days[i]} className="flex h-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-[4px] ${hover === null || hover === i ? "bg-primary" : "bg-primary/40"}`}
                    style={{ height: v ? `max(${(v / top) * 100}%, 2px)` : 0 }}
                  />
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
              <polygon points={`0,100 ${line} 100,100`} fill={`url(#${gradient})`} />
              <polyline
                points={line}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {hover !== null ? (
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1="0"
                  y2="100"
                  stroke="var(--color-text-muted)"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </svg>
          )}
          {kind === "line" && hover !== null ? (
            <span
              className="pointer-events-none absolute size-2.5 -translate-1/2 rounded-full border-2 border-background bg-primary"
              style={{ left: `${x(hover)}%`, top: `${y(values[hover])}%` }}
            />
          ) : null}
          {/* Zones de survol, plus larges que les marques */}
          <div className="absolute inset-0 flex">
            {days.map((d, i) => (
              <div key={d} className="h-full flex-1" onMouseEnter={() => setHover(i)} />
            ))}
          </div>
          {hover !== null ? (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-md bg-ink px-3 py-2 text-[12px] whitespace-nowrap text-white shadow-md"
              style={{ left: `clamp(60px, ${kind === "bar" ? ((hover + 0.5) / n) * 100 : x(hover)}%, calc(100% - 60px))` }}
            >
              <p className="font-semibold">
                {values[hover].toLocaleString("fr-FR")} {values[hover] > 1 ? current.many : current.one}
              </p>
              <p className="text-gray-500">{fullDayFormat.format(new Date(days[hover]))}</p>
            </div>
          ) : null}
        </div>
        {/* Axe des jours */}
        <div />
        <div className="relative mt-2 h-4 font-data text-[11px] text-text-muted">
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <span
                key={d}
                className={`absolute whitespace-nowrap ${i === 0 ? "" : i + labelEvery >= n ? "-translate-x-full" : "-translate-x-1/2"}`}
                style={{ left: `${kind === "bar" ? ((i + 0.5) / n) * 100 : x(i)}%` }}
              >
                {dayFormat.format(new Date(d))}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* Lecture d'écran : les valeurs sous forme de tableau */}
      <table className="sr-only">
        <caption>
          {title} : {current.label}
        </caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">{current.label}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d}>
              <td>{fullDayFormat.format(new Date(d))}</td>
              <td>{values[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

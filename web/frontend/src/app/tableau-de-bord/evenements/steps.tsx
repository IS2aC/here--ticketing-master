// Étapes de l'assistant (DESIGN.md) : faite = pastille noire, en cours = rouge, à venir = contour gris.
const STEPS = ["L'événement", "Les invités", "La carte", "Les relances"];

export function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Étapes">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const state = step < current ? "done" : step === current ? "on" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 ? <span className="hidden h-px w-7 bg-border sm:block" aria-hidden="true" /> : null}
            <span
              aria-current={state === "on" ? "step" : undefined}
              className={`inline-flex items-center gap-2 text-[13px] ${state === "on" ? "font-semibold text-text" : "font-medium text-text-muted"}`}
            >
              <b
                className={`inline-flex size-6 items-center justify-center rounded-full text-[12px] ${
                  state === "done"
                    ? "bg-ink text-white"
                    : state === "on"
                      ? "bg-primary text-white"
                      : "shadow-[inset_0_0_0_1.5px_var(--color-border)]"
                }`}
              >
                {step}
              </b>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

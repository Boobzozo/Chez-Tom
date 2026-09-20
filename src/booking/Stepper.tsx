import React from 'react';

export interface StepDef {
  /** Libellé par défaut de l'étape (ex. "Profil"). */
  label: string;
  /** Valeur choisie à afficher une fois l'étape franchie (ex. "Adulte"). */
  value?: string;
}

/**
 * Stepper narratif : libellés visibles, rappel des choix précédents en doré,
 * barre de progression fine. Sur mobile, seule l'étape en cours garde son
 * libellé ; les autres se réduisent à leur numéro (plus rien de tronqué).
 */
export const Stepper = ({ steps, current }: { steps: StepDef[]; current: number }) => {
  const pct = Math.round((current / steps.length) * 100);

  return (
    <div className="mb-10">
      <ol className="flex justify-between gap-3 mb-3.5 list-none m-0 p-0">
        {steps.map((s, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          const num = String(n).padStart(2, '0');
          const text = done && s.value ? s.value : s.label;
          return (
            <li
              key={s.label}
              aria-current={active ? 'step' : undefined}
              className={`mono-label min-w-0 ${active ? 'truncate' : 'shrink-0'} ${
                done ? 'text-gold' : active ? 'text-dark' : 'text-muted-deep'
              } ${done || active ? 'font-semibold' : ''}`}
              title={text}
            >
              {done ? '✓ ' : ''}
              {num}
              <span className={active ? 'inline' : 'hidden sm:inline'}> — {text}</span>
            </li>
          );
        })}
      </ol>
      <div className="relative h-0.5 bg-hairline" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div
          className="absolute inset-y-0 left-0 bg-dark transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

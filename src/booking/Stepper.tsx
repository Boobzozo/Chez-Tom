import React from 'react';

export interface StepDef {
  /** Libellé par défaut de l'étape (ex. "Profil"). */
  label: string;
  /** Valeur choisie à afficher une fois l'étape franchie (ex. "Adulte"). */
  value?: string;
}

/**
 * Stepper narratif : libellés visibles, rappel des choix précédents en doré,
 * barre de progression fine. Remplace les pastilles 1-2-3-4 abstraites.
 */
export const Stepper = ({ steps, current }: { steps: StepDef[]; current: number }) => {
  const pct = Math.round((current / steps.length) * 100);

  return (
    <div className="mb-10">
      <div className="flex justify-between gap-3 mb-3.5">
        {steps.map((s, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          const num = String(n).padStart(2, '0');
          return (
            <span
              key={s.label}
              className={`mono-label truncate ${
                done ? 'text-gold' : active ? 'text-dark' : 'text-muted-deep'
              } ${done || active ? 'font-semibold' : ''}`}
              title={done && s.value ? s.value : s.label}
            >
              {done ? '✓ ' : ''}
              {num} — {done && s.value ? s.value : s.label}
            </span>
          );
        })}
      </div>
      <div className="relative h-0.5 bg-hairline">
        <div
          className="absolute inset-y-0 left-0 bg-dark transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

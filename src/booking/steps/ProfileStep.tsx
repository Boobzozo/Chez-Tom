import React from 'react';
import type { Category } from '../../types';
import { Stepper, StepDef } from '../Stepper';
import { StepHeader, PrimaryCTA } from '../parts';

/** Indice d'âge pour les profils connus — sinon rien (catégories personnalisées). */
const ageHint = (name: string): string | undefined => {
  const n = name.toLowerCase();
  if (n.includes('adulte')) return '18 ans et +';
  if (n.includes('ado')) return '12 — 17 ans';
  if (n.includes('enfant')) return 'Moins de 12 ans';
  return undefined;
};

const Card = ({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub?: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex-1 min-w-[140px] flex flex-col items-start gap-2 px-5 py-6 text-left transition-colors duration-150 border ${
      active
        ? 'bg-dark border-dark text-white'
        : 'bg-white border-hairline text-ink-soft hover:border-dark'
    }`}
    style={{ borderRadius: 'var(--radius-md)' }}
  >
    <span className="font-serif text-2xl font-medium leading-none">{label}</span>
    {sub && (
      <span className={`text-[11px] tracking-wide ${active ? 'text-white/60' : 'text-muted-deep'}`}>
        {sub}
      </span>
    )}
    {active && <span className="absolute top-3.5 right-3.5 w-1.5 h-1.5 rounded-full bg-gold" />}
  </button>
);

export const ProfileStep = ({
  categories,
  steps,
  selectedId,
  onSelect,
  onContinue,
  canContinue,
}: {
  categories: Category[];
  steps: StepDef[];
  selectedId: string | null;
  onSelect: (cat: Category | null) => void;
  onContinue: () => void;
  canContinue: boolean;
}) => (
  <div>
    <StepHeader
      title="Pour qui réserve-t-on ?"
      sub="Le choix adapte les prestations et la durée du créneau."
    />
    <Stepper steps={steps} current={1} />

    <div className="flex flex-wrap gap-3 mb-10">
      {categories.map((cat) => (
        <Card
          key={cat.id}
          label={cat.name}
          sub={ageHint(cat.name)}
          active={selectedId === cat.id}
          onClick={() => onSelect(cat)}
        />
      ))}
      {categories.length === 0 && (
        <Card
          label="Toutes les prestations"
          active={selectedId === null}
          onClick={() => onSelect(null)}
        />
      )}
    </div>

    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-deep tracking-wide">
        Étape 1 sur 4 · environ 60 secondes
      </span>
      <PrimaryCTA onClick={onContinue} disabled={!canContinue}>
        Continuer
      </PrimaryCTA>
    </div>
  </div>
);

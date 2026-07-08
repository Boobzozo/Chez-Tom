import React from 'react';
import type { Service } from '../../types';
import { Stepper, StepDef } from '../Stepper';
import { StepHeader, BackButton, PrimaryCTA } from '../parts';

const ServiceRow = ({
  service,
  active,
  onSelect,
}: {
  service: Service;
  active: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full flex items-center gap-6 px-7 py-6 mb-2.5 text-left bg-white transition-colors duration-150 border ${
      active ? 'border-dark' : 'border-hairline hover:border-muted'
    }`}
    style={{ borderRadius: 'var(--radius-md)' }}
  >
    <span
      className={`shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center ${
        active ? 'border-dark' : 'border-hairline'
      }`}
    >
      {active && <span className="w-2 h-2 rounded-full bg-dark" />}
    </span>
    <span className="flex-1 min-w-0">
      <span className="font-serif text-xl font-medium text-ink-soft">{service.name}</span>
      <span className="block text-xs text-muted-deep mt-1">
        {service.description ? `${service.description} · ` : ''}
        {service.duration} min
      </span>
    </span>
    <span className="font-serif text-2xl font-medium text-ink-soft">{service.price}€</span>
  </button>
);

export const ServiceStep = ({
  services,
  steps,
  selectedId,
  selectedPrice,
  onSelect,
  onBack,
  onContinue,
}: {
  services: Service[];
  steps: StepDef[];
  selectedId: string | null;
  selectedPrice: number | null;
  onSelect: (s: Service) => void;
  onBack: () => void;
  onContinue: () => void;
}) => (
  <div>
    <StepHeader title="Quelle prestation ?" />
    <Stepper steps={steps} current={2} />

    <div className="mb-8">
      {services.map((s) => (
        <ServiceRow
          key={s.id}
          service={s}
          active={selectedId === s.id}
          onSelect={() => onSelect(s)}
        />
      ))}
      {services.length === 0 && (
        <p className="text-center text-muted-deep italic py-8">
          Aucune prestation disponible pour ce profil.
        </p>
      )}
    </div>

    <div className="flex justify-between items-center">
      <BackButton onClick={onBack} />
      <PrimaryCTA onClick={onContinue} disabled={selectedId === null}>
        {selectedPrice !== null ? `Continuer · ${selectedPrice}€` : 'Continuer'}
      </PrimaryCTA>
    </div>
  </div>
);

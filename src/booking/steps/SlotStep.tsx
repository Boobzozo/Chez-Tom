import React from 'react';
import type { Service } from '../../types';
import { Stepper, StepDef } from '../Stepper';
import { StepHeader, BackButton, PrimaryCTA } from '../parts';

export interface DayCell {
  dateStr: string;
  weekday: string; // "LUN"
  dayNum: number;
  closed: boolean;
  weekdayIndex: number; // 1 = lundi … 6 = samedi (dimanche exclu)
}

const TimeChip = ({
  time,
  active,
  onClick,
}: {
  time: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`py-3 text-sm font-medium transition-colors duration-150 border ${
      active ? 'bg-dark text-white border-dark' : 'bg-white text-ink-soft border-hairline hover:border-dark'
    }`}
    style={{ borderRadius: 'var(--radius-xs)' }}
  >
    {time}
  </button>
);

const SlotGrid = ({
  title,
  times,
  selected,
  onSelect,
}: {
  title: string;
  times: string[];
  selected: string | null;
  onSelect: (t: string) => void;
}) => {
  if (times.length === 0) return null;
  return (
    <div className="mb-7">
      <div className="mono-label text-muted-deep mb-3">{title}</div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {times.map((t) => (
          <TimeChip key={t} time={t} active={selected === t} onClick={() => onSelect(t)} />
        ))}
      </div>
    </div>
  );
};

export const SlotStep = ({
  steps,
  monthLabel,
  days,
  selectedDate,
  onSelectDate,
  slots,
  loading,
  error,
  selectedTime,
  onSelectTime,
  service,
  recapDate,
  onBack,
  onConfirm,
}: {
  steps: StepDef[];
  monthLabel: string;
  days: DayCell[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  slots: string[];
  loading: boolean;
  error: string | null;
  selectedTime: string | null;
  onSelectTime: (t: string) => void;
  service: Service | null;
  recapDate: string;
  onBack: () => void;
  onConfirm: () => void;
}) => {
  const morning = slots.filter((t) => parseInt(t.split(':')[0], 10) < 13);
  const afternoon = slots.filter((t) => parseInt(t.split(':')[0], 10) >= 13);

  return (
    <div>
      <StepHeader
        title="Choisissez votre créneau"
        sub={`${monthLabel} · Salon ouvert du lundi au samedi`}
      />
      <Stepper steps={steps} current={3} />

      {/* Calendrier aligné : chaque jour de semaine toujours dans la même colonne (lundi → samedi) */}
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2 mb-9">
        {days.map((d, i) => {
          const active = selectedDate === d.dateStr;
          return (
            <button
              key={d.dateStr}
              type="button"
              disabled={d.closed}
              onClick={() => !d.closed && onSelectDate(d.dateStr)}
              // Le premier jour se cale dans sa colonne ; les suivants s'enchaînent naturellement.
              style={{ borderRadius: 'var(--radius-xs)', ...(i === 0 ? { gridColumnStart: d.weekdayIndex } : {}) }}
              className={`py-3.5 flex flex-col items-center transition-colors duration-150 border ${
                active
                  ? 'bg-dark text-white border-dark'
                  : 'bg-white text-ink-soft border-hairline hover:border-dark'
              } ${d.closed ? 'opacity-50 cursor-not-allowed hover:border-hairline' : ''}`}
            >
              <span className="text-[9px] tracking-[0.18em] font-semibold opacity-70">{d.weekday}</span>
              <span className="font-serif text-2xl font-medium mt-0.5">{d.dayNum}</span>
              {d.closed && <span className="text-[8px] tracking-widest mt-0.5">FERMÉ</span>}
            </button>
          );
        })}
      </div>

      {/* Créneaux */}
      {loading ? (
        <p className="slots-loading" aria-live="polite">Chargement des créneaux…</p>
      ) : error ? (
        <div
          role="alert"
          className="mb-6 px-4 py-4 bg-white border text-sm text-[color:var(--color-muted-deep)]"
          style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-hairline)' }}
        >
          {error}
        </div>
      ) : slots.length > 0 ? (
        <>
          <SlotGrid title="Matin" times={morning} selected={selectedTime} onSelect={onSelectTime} />
          <SlotGrid title="Après-midi" times={afternoon} selected={selectedTime} onSelect={onSelectTime} />
        </>
      ) : (
        <p className="slots-placeholder">Aucun créneau disponible ce jour — choisissez une autre date.</p>
      )}

      {/* Récap permanent */}
      {selectedTime && service && (
        <div
          className="bg-white border px-6 py-5 mb-6 flex justify-between items-center"
          style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-hairline)' }}
        >
          <div>
            <div className="mono-label text-muted-deep">Votre rendez-vous</div>
            <div className="font-serif text-xl text-ink-soft mt-1">
              {recapDate} · {selectedTime} · {service.name}
            </div>
          </div>
          <div className="font-serif text-3xl text-ink-soft">{service.price}€</div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <BackButton onClick={onBack} />
        <PrimaryCTA onClick={onConfirm} disabled={!selectedTime}>
          Confirmer le créneau
        </PrimaryCTA>
      </div>
    </div>
  );
};

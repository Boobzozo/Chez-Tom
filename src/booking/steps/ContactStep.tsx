import React from 'react';
import { Check } from 'lucide-react';
import type { Service } from '../../types';
import { Stepper, StepDef } from '../Stepper';
import { StepHeader, BackButton, PrimaryCTA } from '../parts';

export interface ContactValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  smsOptIn: boolean;
}

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  name,
  autoComplete,
  inputMode,
  spellCheck,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  name: string;
  autoComplete: string;
  inputMode?: 'text' | 'tel' | 'email';
  spellCheck?: boolean;
}) => {
  const id = `field-${name}`;
  return (
    <div className="flex-1 basis-[calc(50%-8px)] min-w-0">
      <label htmlFor={id} className="mono-label text-muted-deep block mb-2">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={spellCheck}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3.5 bg-white border border-hairline text-sm text-ink-soft outline-none focus:border-dark transition-colors"
        style={{ borderRadius: 'var(--radius-xs)' }}
      />
    </div>
  );
};

export const ContactStep = ({
  steps,
  values,
  onChange,
  service,
  recapLine,
  error,
  submitting,
  canSubmit,
  onBack,
  onSubmit,
}: {
  steps: StepDef[];
  values: ContactValues;
  onChange: (patch: Partial<ContactValues>) => void;
  service: Service | null;
  recapLine: string;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) => (
  <div>
    <StepHeader
      eyebrow="Réservation · Dernière étape"
      title="Vos coordonnées"
      sub="Pour la confirmation et le rappel. Aucune donnée partagée."
    />
    <Stepper steps={steps} current={4} />

    {/* Récap noir */}
    <div className="bg-dark px-7 py-6 mb-8 flex justify-between items-center">
      <div>
        <div className="mono-label text-white/40">Votre rendez-vous</div>
        <div className="font-serif text-xl text-white mt-1.5">{recapLine}</div>
      </div>
      {service && (
        <div className="text-right">
          <div className="font-serif text-3xl text-white">{service.price}€</div>
          <div className="text-[10px] tracking-widest text-white/35 mt-0.5">{service.duration} minutes</div>
        </div>
      )}
    </div>

    {/* Formulaire */}
    <div className="flex flex-wrap gap-4 mb-5">
      <Field label="Prénom" name="given-name" autoComplete="given-name" value={values.firstName} onChange={(v) => onChange({ firstName: v })} placeholder="Thomas" />
      <Field label="Nom" name="family-name" autoComplete="family-name" value={values.lastName} onChange={(v) => onChange({ lastName: v })} placeholder="Dubois" />
      <Field label="Téléphone" name="tel" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={(v) => onChange({ phone: v })} placeholder="+33 6 12 34 56 78" />
      <Field label="E-mail" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} value={values.email} onChange={(v) => onChange({ email: v })} placeholder="thomas@email.com" />
    </div>

    <label className="flex items-start gap-3 mb-8 cursor-pointer">
      <input
        type="checkbox"
        checked={values.smsOptIn}
        onChange={(e) => onChange({ smsOptIn: e.target.checked })}
        className="sr-only peer"
      />
      <span
        aria-hidden="true"
        className={`shrink-0 mt-0.5 w-[18px] h-[18px] border-[1.5px] border-dark flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-1 ${
          values.smsOptIn ? 'bg-dark' : 'bg-white'
        }`}
        style={{ borderRadius: 'var(--radius-xs)' }}
      >
        {values.smsOptIn && <Check size={11} color="white" strokeWidth={3} />}
      </span>
      <span className="text-xs text-muted-deep leading-relaxed">
        J'accepte de recevoir un rappel avant mon rendez-vous. Pas de marketing.
      </span>
    </label>

    {error && (
      <div
        role="alert"
        className="mb-6 px-4 py-4 text-sm"
        style={{
          borderRadius: 'var(--radius-md)',
          background: 'rgba(178,58,43,0.06)',
          color: '#B23A2B',
        }}
      >
        {error}
      </div>
    )}

    <div className="flex justify-between items-center">
      <BackButton onClick={onBack} />
      <PrimaryCTA onClick={onSubmit} disabled={!canSubmit || submitting}>
        {submitting ? 'Confirmation…' : 'Confirmer ma réservation'}
      </PrimaryCTA>
    </div>
  </div>
);

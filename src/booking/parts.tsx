import React from 'react';

/** Eyebrow doré + grand titre serif + sous-titre optionnel. */
export const StepHeader = ({
  eyebrow = 'Réservation',
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
}) => (
  <div className="mb-8">
    <div className="mono-label text-gold-deep mb-3">{eyebrow}</div>
    <h1 className="font-serif font-normal text-4xl md:text-5xl text-ink-soft leading-[1.05] m-0">
      {title}
    </h1>
    {sub && <p className="text-sm text-muted-deep mt-3 max-w-md leading-relaxed">{sub}</p>}
  </div>
);

/** Bouton "Retour" discret avec filet à gauche. */
export const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="btn-ghost">
    <span className="w-4 h-px bg-muted-deep" />
    Retour
  </button>
);

/** CTA primaire noir avec accent doré à droite. */
export const PrimaryCTA = ({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => (
  <button type={type} onClick={onClick} disabled={disabled} className="btn-primary">
    {children}
    <span className="w-4 h-px bg-gold" />
  </button>
);

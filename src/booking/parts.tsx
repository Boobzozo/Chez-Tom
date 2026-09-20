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
    {/* h2 : le seul h1 de la page est celui du hero. */}
    <h2 className="font-serif font-normal text-4xl md:text-5xl text-ink-soft leading-[1.05] m-0">
      {title}
    </h2>
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

/** CTA primaire noir avec accent doré à droite. Pleine largeur sur mobile. */
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
  <button type={type} onClick={onClick} disabled={disabled} className="btn-primary w-full sm:w-auto">
    {children}
    <span className="w-4 h-px bg-gold" />
  </button>
);

/**
 * Rangée de bas d'étape : sur mobile, le CTA passe en pleine largeur au-dessus
 * de l'élément secondaire (Retour, note) ; à partir de 640 px, les deux se font face.
 */
export const StepActions = ({
  secondary,
  children,
}: {
  secondary?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col-reverse gap-5 sm:flex-row sm:justify-between sm:items-center">
    <div className="flex justify-center sm:justify-start">{secondary}</div>
    {children}
  </div>
);

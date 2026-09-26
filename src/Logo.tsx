import type { SVGProps } from 'react';
import { LOGO_VIEWBOX, LOGO_INK_PATH, LOGO_ACCENT_PATH } from './logo-paths';

type MonogramProps = SVGProps<SVGSVGElement> & {
  /** Couleur de la moitié droite (le M). La moitié gauche (T + O) suit `currentColor`. */
  accent?: string;
};

// Écusson TOM seul. Le nom se compose à côté en vrai texte (Inter 600) plutôt
// qu'en chemins : sélectionnable, lisible par les lecteurs d'écran, net à toute taille.
// Tracé maître et déclinaisons print : design-handoff/logo.
export function Monogram({ accent = 'var(--color-gold-deep)', ...rest }: MonogramProps) {
  return (
    <svg viewBox={LOGO_VIEWBOX} {...rest}>
      <path fill="currentColor" fillRule="evenodd" d={LOGO_INK_PATH} />
      <path fill={accent} fillRule="evenodd" d={LOGO_ACCENT_PATH} />
    </svg>
  );
}

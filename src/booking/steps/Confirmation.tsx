import React from 'react';
import { Check } from 'lucide-react';

export const Confirmation = ({
  firstName,
  dayLabel,
  recapLine,
  address,
  calendarUrl,
  onReset,
}: {
  firstName: string;
  dayLabel: string; // "mercredi"
  recapLine: string; // "Coupe + Barbe · Mercredi 7 mai à 14h30"
  address: string;
  calendarUrl?: string;
  onReset: () => void;
}) => (
  <div className="bg-dark px-6 py-16 md:py-24 flex items-center justify-center" style={{ borderRadius: 'var(--radius-md)' }}>
    <div className="text-center max-w-lg">
      <div className="w-14 h-14 rounded-full border-[1.5px] border-gold flex items-center justify-center mx-auto mb-8">
        <Check size={22} color="var(--color-gold)" strokeWidth={2} />
      </div>
      <div className="mono-label text-gold mb-5">Réservation confirmée</div>
      <h2 className="font-serif font-normal text-4xl md:text-5xl text-white leading-[1.05] m-0">
        À {dayLabel},<br />
        <em className="italic text-gold">{firstName || 'bientôt'}.</em>
      </h2>
      <p className="text-sm text-white/50 leading-relaxed mt-6">
        {recapLine}
        <br />
        Un rappel vous sera envoyé avant le rendez-vous.
      </p>

      <div className="mt-10 px-7 py-6 border border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="text-sm text-white/50 text-left">
          <div className="mono-label text-white/30 mb-1.5">Adresse</div>
          {address}
        </div>
        {calendarUrl && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noreferrer"
            className="mono-label px-6 py-3 border border-white/20 text-white hover:border-gold transition-colors whitespace-nowrap"
          >
            Ajouter au calendrier
          </a>
        )}
      </div>

      <button onClick={onReset} className="mt-8 btn-ghost text-white/50 hover:text-white mx-auto">
        Nouvelle réservation
      </button>
    </div>
  </div>
);

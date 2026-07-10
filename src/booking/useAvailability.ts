import { useState, useEffect, useCallback } from 'react';
import type { Service, DayHours } from '../types';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const getDayOfWeek = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return DAY_NAMES[new Date(year, month - 1, day).getDay()];
};

export const pad = (n: number) => n.toString().padStart(2, '0');

export const toDateString = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const getLocalDateString = () => {
  const now = new Date();
  if (now.getDay() === 0) now.setDate(now.getDate() + 1); // dimanche -> lundi
  return toDateString(now);
};

interface UseAvailabilityResult {
  slots: string[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Récupère les créneaux disponibles auprès du serveur du site
 * (calcul local : horaires d'ouverture − réservations − indisponibilités),
 * puis filtre les créneaux déjà passés.
 */
export function useAvailability(
  date: string,
  service: Service | null,
  openingHours: Record<string, DayHours>,
): UseAvailabilityResult {
  const [rawSlots, setRawSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!date || !service) return;

    // Jour fermé : inutile d'appeler le serveur.
    const hours = openingHours[getDayOfWeek(date)];
    if (!hours || hours.closed) {
      setRawSlots([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/availability?date=${date}&duration=${service.duration}`);
      if (res.ok) {
        const data = await res.json();
        setRawSlots(data.slots || []);
      } else {
        setRawSlots([]);
        setError('Impossible de récupérer les créneaux disponibles.');
      }
    } catch (err) {
      console.error('Error fetching available slots:', err);
      setRawSlots([]);
      setError('Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  }, [date, service, openingHours]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Filtre les créneaux déjà passés si la date sélectionnée est aujourd'hui.
  const slots = rawSlots.filter((slot) => {
    if (date === getLocalDateString()) {
      const now = Date.now();
      const slotStart = new Date(`${date}T${slot}:00`).getTime();
      if (slotStart < now) return false;
    }
    return true;
  });

  return { slots, loading, error, refetch: fetchSlots };
}

import { useState, useEffect, useCallback } from 'react';
import type { Service, DayHours } from '../types';

const CHECK_AVAILABILITY_URL = 'https://n8n.srv1043923.hstgr.cloud/webhook/check-availability';

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
 * Récupère les créneaux disponibles auprès du webhook n8n, en tenant compte
 * des horaires du salon (state SQLite) et en filtrant les créneaux passés.
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

    const dayOfWeek = getDayOfWeek(date);
    const hours = openingHours[dayOfWeek];

    if (!hours || hours.closed) {
      setRawSlots([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      date,
      day_of_week: dayOfWeek,
      service_duration: service.duration,
      opening: hours.open || '09:00',
      closing: hours.close || '19:00',
      has_break: !!hours.has_break,
      break_start: hours.break_start || '12:00',
      break_end: hours.break_end || '14:00',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(CHECK_AVAILABILITY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const slots = (data.slots || []).map((s: string) => s.replace('h', ':'));
        setRawSlots(slots);
      } else {
        setRawSlots([]);
        setError('Impossible de récupérer les créneaux disponibles.');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setRawSlots([]);
      if (err.name === 'AbortError') {
        setError('Le service de disponibilité ne répond pas (délai de 5s dépassé).');
      } else {
        console.error('Error fetching available slots:', err);
        setError('Erreur lors de la connexion au service de disponibilité.');
      }
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

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Service, Category, DayHours } from '../types';
import { StepDef } from './Stepper';
import { ProfileStep } from './steps/ProfileStep';
import { ServiceStep } from './steps/ServiceStep';
import { SlotStep, DayCell } from './steps/SlotStep';
import { ContactStep, ContactValues } from './steps/ContactStep';
import { Confirmation } from './steps/Confirmation';
import { useAvailability, getLocalDateString, getDayOfWeek, toDateString, pad } from './useAvailability';

const SALON_ADDRESS = 'Martigné-sur-Mayenne · 53470';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fmtLongDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const fmtWeekday = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long' });
};

export const BookingSection = ({
  services,
  categories,
  openingHours,
}: {
  services: Service[];
  categories: Category[];
  openingHours: Record<string, DayHours>;
}) => {
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactValues>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    smsOptIn: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedInfo, setConfirmedInfo] = useState<{
    firstName: string;
    dayLabel: string;
    recapLine: string;
    calendarUrl?: string;
  } | null>(null);

  const { slots, loading, error: slotsError } = useAvailability(selectedDate, selectedService, openingHours);

  const filteredServices = useMemo(
    () => (selectedCategory ? services.filter((s) => s.category_id === selectedCategory.id) : services),
    [services, selectedCategory],
  );

  // Réinitialise le créneau s'il n'est plus disponible.
  useEffect(() => {
    if (selectedTime && !slots.includes(selectedTime)) setSelectedTime(null);
  }, [slots, selectedTime]);

  // Calendrier aligné : 2 semaines lundi → samedi (dimanches et jours passés exclus),
  // chaque jour de semaine toujours dans la même colonne. Jours fermés visibles mais désactivés.
  const days: DayCell[] = useMemo(() => {
    const WEEKS = 2;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Lundi de la semaine en cours (getDay : 0 = dimanche … 6 = samedi).
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const out: DayCell[] = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      if (d.getDay() === 0) continue; // pas de dimanche
      if (d < today) continue; // pas de jour déjà passé
      const dateStr = toDateString(d);
      const hours = openingHours[getDayOfWeek(dateStr)];
      out.push({
        dateStr,
        weekday: d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase(),
        dayNum: d.getDate(),
        closed: hours ? hours.closed : false,
        weekdayIndex: ((d.getDay() + 6) % 7) + 1, // 1 = lundi … 6 = samedi
      });
    }
    return out;
  }, [openingHours]);

  const monthLabel = useMemo(() => {
    if (!days.length) return '';
    const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const first = toDate(days[0].dateStr);
    const last = toDate(days[days.length - 1].dateStr);
    if (first.getMonth() === last.getMonth()) {
      return capitalize(last.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
    }
    return capitalize(
      `${first.toLocaleDateString('fr-FR', { month: 'long' })} – ${last.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
    );
  }, [days]);

  const steps: StepDef[] = [
    { label: 'Profil', value: selectedCategory?.name },
    { label: 'Prestation', value: selectedService?.name },
    { label: 'Créneau', value: selectedTime ? `${fmtWeekday(selectedDate)} ${selectedTime}` : undefined },
    { label: 'Coordonnées' },
  ];

  const recapDate = capitalize(fmtLongDate(selectedDate));
  const recapLine = selectedService
    ? `${selectedService.name} · ${recapDate} à ${selectedTime ?? ''}`.trim()
    : '';

  const canContinueProfile = selectedCategory !== null || categories.length === 0;
  const canSubmit = Boolean(contact.firstName && contact.lastName && contact.phone && contact.email);

  const buildCalendarUrl = (start: string, end: string) => {
    const toGcal = (iso: string) => iso.replace(/[-:]/g, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Tom Barber · ${selectedService?.name ?? 'Rendez-vous'}`,
      dates: `${toGcal(start)}/${toGcal(end)}`,
      location: SALON_ADDRESS,
      details: 'Votre rendez-vous chez Tom Barber.',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedTime || !canSubmit) return;
    setSubmitting(true);
    setError(null);

    const start = `${selectedDate}T${selectedTime}:00`;
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + selectedService.duration * 60000);
    const end = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;
    const customerName = `${contact.firstName} ${contact.lastName}`.trim();

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          customer_email: contact.email,
          customer_phone: contact.phone,
          service_type: selectedService.name,
          start_time: start,
          end_time: end,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmedInfo({
          firstName: contact.firstName,
          dayLabel: fmtWeekday(selectedDate),
          recapLine: `${selectedService.name} · ${recapDate} à ${selectedTime}`,
          calendarUrl: buildCalendarUrl(start, end),
        });
        setConfirmed(true);
      } else {
        setError(data.error || 'Une erreur est survenue.');
      }
    } catch {
      setError('Erreur de connexion au serveur.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setConfirmed(false);
    setConfirmedInfo(null);
    setStep(1);
    setSelectedCategory(null);
    setSelectedService(null);
    setSelectedTime(null);
    setContact({ firstName: '', lastName: '', phone: '', email: '', smsOptIn: true });
    setError(null);
  };

  return (
    <section id="booking" className="py-24 px-6 bg-paper overflow-hidden">
      <div className="max-w-[720px] mx-auto">
        {confirmed && confirmedInfo ? (
          <Confirmation
            firstName={confirmedInfo.firstName}
            dayLabel={confirmedInfo.dayLabel}
            recapLine={confirmedInfo.recapLine}
            address={SALON_ADDRESS}
            calendarUrl={confirmedInfo.calendarUrl}
            onReset={reset}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              {step === 1 && (
                <ProfileStep
                  categories={categories}
                  steps={steps}
                  selectedId={selectedCategory?.id ?? null}
                  onSelect={setSelectedCategory}
                  canContinue={canContinueProfile}
                  onContinue={() => setStep(2)}
                />
              )}
              {step === 2 && (
                <ServiceStep
                  services={filteredServices}
                  steps={steps}
                  selectedId={selectedService?.id ?? null}
                  selectedPrice={selectedService?.price ?? null}
                  onSelect={setSelectedService}
                  onBack={() => setStep(1)}
                  onContinue={() => selectedService && setStep(3)}
                />
              )}
              {step === 3 && (
                <SlotStep
                  steps={steps}
                  monthLabel={monthLabel}
                  days={days}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  slots={slots}
                  loading={loading}
                  error={slotsError}
                  selectedTime={selectedTime}
                  onSelectTime={setSelectedTime}
                  service={selectedService}
                  recapDate={recapDate}
                  onBack={() => setStep(2)}
                  onConfirm={() => selectedTime && setStep(4)}
                />
              )}
              {step === 4 && (
                <ContactStep
                  steps={steps}
                  values={contact}
                  onChange={(patch) => setContact((c) => ({ ...c, ...patch }))}
                  service={selectedService}
                  recapLine={recapLine}
                  error={error}
                  submitting={submitting}
                  canSubmit={canSubmit}
                  onBack={() => setStep(3)}
                  onSubmit={handleBooking}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
};

export default BookingSection;

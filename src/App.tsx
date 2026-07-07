import React, { useState, useEffect, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors, Calendar, Clock, MapPin, Phone, Instagram, Facebook, Menu, X, Check, ChevronRight, Settings, LogOut, Plus, Trash2, User, Info, Bell, RefreshCw } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { io } from 'socket.io-client';

// --- Types ---
interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface Notification {
  id: number;
  reservation_id: string;
  customer: string;
  service: string;
  date: string;
  time: string;
  created_at: string;
  is_read: number;
}

interface Booking {
  id: number;
  customer_name: string;
  customer_email: string;
  service_type: string;
  start_time: string;
  end_time: string;
}

interface GalleryImage {
  id: number;
  url: string;
  caption: string;
  created_at: string;
}

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
  has_break?: boolean;
  break_start?: string;
  break_end?: string;
}

interface AppSettings {
  show_gallery: string;
  show_about: string;
  admin_password?: string;
  opening_hours?: string; // JSON string
  google_calendar_id?: string;
  notification_email?: string;
}

// --- Components ---

const TimeInput = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
  const [h, m] = (value || "00:00").split(':');
  
  const handleHourChange = (newH: string) => {
    onChange(`${newH.padStart(2, '0')}:${m}`);
  };
  
  const handleMinChange = (newM: string) => {
    onChange(`${h}:${newM.padStart(2, '0')}`);
  };

  return (
    <div className={`flex items-center gap-1 bg-white border border-dark/10 rounded-xl px-2 py-2 ${className} hover:border-gold transition-colors shadow-sm`}>
      <select 
        value={h} 
        onChange={(e) => handleHourChange(e.target.value)}
        className="bg-transparent outline-none text-xs font-bold cursor-pointer appearance-none text-center min-w-[24px]"
      >
        {Array.from({ length: 24 }, (_, i) => {
          const val = i.toString().padStart(2, '0');
          return <option key={val} value={val}>{val}</option>;
        })}
      </select>
      <span className="text-gold font-bold text-xs">:</span>
      <select 
        value={m} 
        onChange={(e) => handleMinChange(e.target.value)}
        className="bg-transparent outline-none text-xs font-bold cursor-pointer appearance-none text-center min-w-[24px]"
      >
        {Array.from({ length: 60 }, (_, i) => {
          const val = i.toString().padStart(2, '0');
          return <option key={val} value={val}>{val}</option>;
        })}
      </select>
      <Clock size={14} className="ml-1 text-dark/20" />
    </div>
  );
};

const getLocalDateString = () => {
  const now = new Date();
  // If today is Sunday, skip to Monday
  if (now.getDay() === 0) {
    now.setDate(now.getDate() + 1);
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const Navbar = ({ isAdmin }: { isAdmin: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-500 ${scrolled ? 'bg-paper/90 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className={`text-2xl font-serif font-bold tracking-[0.3em] transition-colors duration-500 ${scrolled ? 'text-dark' : 'text-paper'}`}>
          CHEZ TOM
        </div>
        
        <div className={`hidden md:flex items-center space-x-8 text-xs uppercase tracking-widest font-medium transition-colors duration-500 ${scrolled ? 'text-dark' : 'text-paper'}`}>
          <a href="#services" className="hover:text-gold transition-colors">Services</a>
          <a href="#booking" className="hover:text-gold transition-colors">Réservation</a>
          <a href="#contact" className="hover:text-gold transition-colors">Contact</a>
        </div>

        <button className={`md:hidden transition-colors ${scrolled ? 'text-dark' : 'text-paper'}`} onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-paper border-b border-dark/5 p-6 flex flex-col space-y-4 text-center md:hidden"
          >
            <a href="#services" onClick={() => setIsOpen(false)}>Services</a>
            <a href="#booking" onClick={() => setIsOpen(false)}>Réservation</a>
            <a href="#contact" onClick={() => setIsOpen(false)}>Contact</a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => (
  <section className="relative min-h-screen flex items-center justify-center pt-20 bg-dark overflow-hidden">
    <motion.div 
      initial={{ scale: 1.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 0.6 }}
      transition={{ duration: 2, ease: "easeOut" }}
      className="absolute inset-0 z-0"
    >
      <img 
        src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=2000" 
        alt="Salon de coiffure Chez Tom - Ambiance authentique et élégante" 
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </motion.div>
    <div className="absolute inset-0 z-[1] bg-black/20"></div>
    <div className="absolute inset-0 z-[2] bg-gradient-to-b from-dark/40 via-transparent to-paper"></div>
    
    <div className="relative z-10 text-center px-6 max-w-4xl">
      <motion.span 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs uppercase tracking-[0.3em] font-semibold text-gold mb-6 block"
      >
        L'art de la coiffure masculine
      </motion.span>
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-5xl md:text-8xl font-serif mb-8 leading-tight luxury-text-shadow text-paper"
      >
        Chez Tom <br /> <span className="italic text-gold">Barbier & Coiffeur</span>
      </motion.h1>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4"
      >
        <a href="#booking" className="btn-primary sm:mr-6">Prendre rendez-vous</a>
        <a href="#services" className="btn-outline !border-paper/30 !text-paper hover:!border-paper">Nos services</a>
      </motion.div>
    </div>
  </section>
);

const Services = ({ services, categories }: { services: Service[], categories: Category[] }) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories]);

  const filteredServices = services.filter(s => s.category_id === activeCategory);

  return (
    <section id="services" className="py-24 md:py-32 px-6 bg-paper relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute top-0 right-0 w-1/3 h-full bg-dark/[0.01] -skew-x-12 translate-x-1/4"></div>
      <div className="absolute top-1/4 left-10 w-px h-64 bg-gradient-to-b from-transparent via-gold/30 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-20 gap-8">
          <div className="max-w-2xl text-center md:text-left">
            <motion.span 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-[10px] uppercase tracking-[0.6em] font-bold text-gold mb-4 md:mb-6 block"
            >
              Menu des Prestations
            </motion.span>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-8xl font-serif leading-tight sm:leading-[1.1] tracking-tight"
            >
              L'Excellence <span className="md:hidden"><br /></span> du <br className="hidden md:block" /><span className="italic text-gold">Savoir-Faire</span>
            </motion.h2>
          </div>
          
          {/* Category Tabs - Optimized with more horizontal room to prevent clipping of rounded edges */}
          <div className="flex overflow-x-auto no-scrollbar gap-4 py-8 md:py-10 -my-8 md:-my-10 -mx-10 px-10 md:mx-0 md:px-0 scroll-smooth justify-center md:justify-start">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-7 md:px-10 py-3 md:py-4 rounded-full text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold transition-all duration-500 whitespace-nowrap border-2 flex-shrink-0 relative ${
                  activeCategory === cat.id 
                    ? 'bg-dark text-paper border-dark shadow-[0_15px_35px_-10px_rgba(0,0,0,0.5)] z-10' 
                    : 'bg-white text-dark/40 border-dark/5 hover:border-gold/40 hover:text-gold shadow-sm z-0'
                }`}
              >
                <motion.span
                  animate={activeCategory === cat.id ? { scale: 1.05 } : { scale: 1 }}
                >
                  {cat.name}
                </motion.span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 md:gap-24 items-stretch">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 flex flex-col justify-between min-h-[350px] md:min-h-[450px]"
          >
            <div className="space-y-10 md:space-y-12">
              {filteredServices.length > 0 ? (
                <div className="space-y-10 md:space-y-10">
                  {filteredServices.map((service, index) => (
                    <motion.div 
                      key={service.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="group"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline gap-4 md:gap-6">
                        <div className="flex-1 w-full">
                          <div className="flex justify-between items-baseline mb-1 sm:mb-2 w-full">
                            <h3 className="text-xl md:text-3xl font-serif group-hover:text-gold transition-colors duration-500">
                              {service.name}
                            </h3>
                            {/* Dotted separator - hidden on mobile to avoid crowding */}
                            <div className="hidden sm:block h-px bg-dark/5 flex-1 mx-6 border-t border-dashed border-dark/15 group-hover:border-gold/30 transition-colors"></div>
                            <span className="text-xl md:text-3xl font-serif text-gold tabular-nums tracking-tighter shrink-0">{service.price}€</span>
                          </div>
                          <p className="text-[9px] md:text-[10px] font-sans font-bold text-dark/25 uppercase tracking-[0.3em] leading-relaxed">
                            Prestation de précision
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-20 px-8 rounded-[2rem] border border-dashed border-dark/10 bg-dark/[0.01] text-center">
                  <p className="text-dark/30 italic font-serif text-lg">Sélectionnez une catégorie pour voir nos tarifs.</p>
                </div>
              )}
            </div>
            
            <div className="pt-12 md:pt-16">
              <motion.a 
                whileHover={{ scale: 1.05, backgroundColor: '#C5A059' }}
                whileTap={{ scale: 0.95 }}
                href="#booking" 
                className="inline-flex items-center justify-center gap-6 bg-dark text-paper px-10 md:px-12 py-5 md:py-6 rounded-full text-[11px] md:text-xs uppercase tracking-[0.5em] font-black transition-all duration-500 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] group relative overflow-hidden"
              >
                <span className="relative z-10">Réserver votre créneau</span>
                <ChevronRight size={18} className="relative z-10 group-hover:translate-x-2 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gold translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              </motion.a>
            </div>
          </motion.div>

          <div className="lg:col-span-5 relative mt-8 lg:mt-0 hidden md:block">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full"
            >
              <div className="h-full min-h-[500px] overflow-hidden rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] relative group">
                <img 
                  src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=1000" 
                  alt="Ambiance Salon"
                  className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/20 to-transparent opacity-70"></div>
                
                <div className="absolute bottom-10 left-10 right-10">
                  <motion.div 
                    initial={{ y: 30, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="p-8 md:p-10 backdrop-blur-xl bg-white/5 border border-white/20 rounded-3xl"
                  >
                    <p className="text-paper text-sm md:text-base font-serif italic leading-relaxed mb-6">
                      "L'élégance n'est pas une question de luxe, mais de soin apporté aux détails."
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-px bg-gold"></div>
                      <span className="text-[10px] uppercase tracking-[0.4em] text-paper/50 font-bold">L'esprit Chez Tom</span>
                    </div>
                  </motion.div>
                </div>
              </div>
              
              {/* Decorative Frame */}
              <div className="absolute -inset-6 border border-gold/10 rounded-[3rem] -z-10 translate-x-3 translate-y-3 hidden lg:block"></div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Gallery = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);

  useEffect(() => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => setImages(data))
      .catch(err => console.error("Error fetching gallery:", err));
  }, []);

  if (images.length === 0) return null;

  return (
    <section id="gallery" className="py-24 px-6 bg-dark overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs uppercase tracking-[0.3em] font-semibold text-gold mb-4 block"
          >
            Réalisations
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-5xl font-serif text-paper"
          >
            Galerie Photos
          </motion.h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img, index) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative aspect-square overflow-hidden rounded-2xl group cursor-pointer"
            >
              <img 
                src={img.url} 
                alt={img.caption} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 text-center">
                <p className="text-paper text-xs font-serif italic">{img.caption}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const BookingSection = ({ services, categories, openingHours }: { services: Service[], categories: Category[], openingHours: Record<string, DayHours> }) => {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1);
  const [isBooking, setIsBooking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const dateScrollRef = React.useRef<HTMLDivElement>(null);

  const CHECK_AVAILABILITY_URL = "https://n8n.srv1043923.hstgr.cloud/webhook/check-availability";

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !selectedService) return;
    
    // 1. Calcul du jour de la semaine (en anglais minuscule)
    const dayOfWeek = getDayOfWeek(selectedDate);
    
    // 2. Récupération des horaires pour ce jour (depuis les données SQLite chargées dans le state)
    const hours = openingHours[dayOfWeek];
    
    // 3. Vérification si le jour est fermé -> On ne contacte pas n8n
    if (!hours || hours.closed) {
      setAvailableSlots([]);
      return;
    }

    setIsLoadingSlots(true);
    setMessage(null); // Réinitialise les messages d'erreur précédents

    // 4. Préparation du payload selon le format exact demandé par n8n
    const payload = {
      date: selectedDate,
      day_of_week: dayOfWeek,
      service_duration: selectedService.duration,
      opening: hours.open || '09:00',
      closing: hours.close || '19:00',
      has_break: !!hours.has_break,
      break_start: hours.break_start || '12:00',
      break_end: hours.break_end || '14:00'
    };

    // 5. Gestion du timeout de 5 secondes via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(CHECK_AVAILABILITY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        // 6. Normalisation des créneaux (n8n renvoie souvent HHhMM, on convertit en HH:mm pour le front)
        const slots = (data.slots || []).map((s: string) => s.replace('h', ':'));
        setAvailableSlots(slots);
      } else {
        setAvailableSlots([]);
        setMessage({ type: 'error', text: 'Impossible de récupérer les créneaux disponibles.' });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setMessage({ type: 'error', text: 'Le service de disponibilité ne répond pas (délai de 5s dépassé).' });
      } else {
        console.error("Error fetching available slots:", err);
        setMessage({ type: 'error', text: 'Erreur lors de la connexion au service de disponibilité.' });
      }
      setAvailableSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const scrollDates = (direction: 'left' | 'right') => {
    if (dateScrollRef.current) {
      const scrollAmount = 240;
      dateScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    fetchAvailableSlots();
  }, [selectedDate, selectedService]);

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  // Robust day of week calculation for YYYY-MM-DD strings
  const getDayOfWeek = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return dayNames[new Date(year, month - 1, day).getDay()];
  };
  
  const dayOfWeek = getDayOfWeek(selectedDate);
  const currentDayHours = openingHours[dayOfWeek];

  const generateTimeSlots = (open: string, close: string, breakStart?: string, breakEnd?: string) => {
    const slots = [];
    let current = new Date(`2000-01-01T${open}:00`);
    const end = new Date(`2000-01-01T${close}:00`);
    
    const bStart = breakStart ? new Date(`2000-01-01T${breakStart}:00`) : null;
    const bEnd = breakEnd ? new Date(`2000-01-01T${breakEnd}:00`) : null;

    while (current < end) {
      const isDuringBreak = bStart && bEnd && current >= bStart && current < bEnd;
      
      if (!isDuringBreak) {
        slots.push(current.toTimeString().slice(0, 5));
      }
      current = new Date(current.getTime() + 30 * 60000);
    }
    return slots;
  };

  const timeSlots = availableSlots.filter(slot => {
    // Check if it's in the past
    if (selectedDate === getLocalDateString()) {
      const now = new Date().getTime();
      const slotStart = new Date(`${selectedDate}T${slot}:00`).getTime();
      if (slotStart < now) return false;
    }
    return true;
  });

  // Reset selected time if it becomes invalid
  useEffect(() => {
    if (selectedTime && !timeSlots.includes(selectedTime)) {
      setSelectedTime(null);
    }
  }, [selectedService, selectedDate, availableSlots]);

  const handleBooking = async () => {
    if (!selectedService || !selectedTime || !name || !email) return;

    setIsBooking(true);
    setMessage(null);
    const start = `${selectedDate}T${selectedTime}:00`;
    
    // Calculate end time manually to keep the same local format
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + selectedService.duration * 60000);
    
    // Format as YYYY-MM-DDTHH:mm:ss
    const pad = (n: number) => n.toString().padStart(2, '0');
    const end = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          customer_email: email,
          service_type: selectedService.name,
          start_time: start,
          end_time: end
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.googleCalendarError) {
          alert("⚠️ Réservation réussie sur le site, mais erreur Google Calendar : " + data.googleCalendarError);
        }
        setMessage({ type: 'success', text: 'Votre rendez-vous a été confirmé !' });
        setStep(5);
        fetchAvailableSlots(); // Refresh slots immediately
      } else {
        setMessage({ type: 'error', text: data.error || 'Une erreur est survenue.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur de connexion au serveur.' });
    } finally {
      setIsBooking(false);
    }
  };

  const filteredServices = selectedCategory 
    ? services.filter(s => s.category_id === selectedCategory.id)
    : services;

  return (
    <section id="booking" className="py-24 px-6 bg-paper overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-3xl mx-auto"
      >
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif mb-4">Réserver un créneau</h2>
          <div className="w-12 h-px bg-gold mx-auto"></div>
        </div>

        <div className="glass-card rounded-3xl p-8 md:p-12">
          {/* Progress Bar */}
          <div className="flex justify-between mb-12 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-dark/5 -z-10"></div>
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s} 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                  step >= s ? 'bg-dark text-paper' : 'bg-paper border border-dark/10 text-dark/30'
                }`}
              >
                {step > s ? <Check size={14} /> : s}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className="text-xl font-serif mb-6">Pour qui est le rendez-vous ?</h3>
                <div className="grid gap-4">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex justify-between items-center p-6 rounded-2xl border transition-all ${
                        selectedCategory?.id === cat.id ? 'border-dark bg-dark/5' : 'border-dark/10 hover:border-dark/30'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-medium">{cat.name}</div>
                      </div>
                      <ChevronRight size={20} className="text-gold" />
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="flex justify-between items-center p-6 rounded-2xl border border-dark/10 hover:border-dark/30"
                    >
                      <div className="text-left font-medium">Toutes les prestations</div>
                      <ChevronRight size={20} className="text-gold" />
                    </button>
                  )}
                </div>
                <button 
                  disabled={!selectedCategory && categories.length > 0}
                  onClick={() => setStep(2)}
                  className="w-full btn-primary mt-8 disabled:opacity-50"
                >
                  Continuer
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className="text-xl font-serif mb-6">Choisissez votre prestation</h3>
                <div className="grid gap-3">
                  {filteredServices.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedService(s)}
                      className={`flex justify-between items-center p-5 rounded-xl border transition-all duration-300 ${
                        selectedService?.id === s.id 
                          ? 'border-gold bg-gold/5 shadow-inner' 
                          : 'border-dark/5 bg-white hover:border-gold/30 hover:shadow-md'
                      }`}
                    >
                      <div className="text-left">
                        <div className={`font-medium transition-colors ${selectedService?.id === s.id ? 'text-gold' : 'text-dark'}`}>{s.name}</div>
                      </div>
                      <div className={`text-lg font-serif transition-colors ${selectedService?.id === s.id ? 'text-gold' : 'text-dark/60'}`}>{s.price}€</div>
                    </button>
                  ))}
                  {filteredServices.length === 0 && (
                    <p className="text-center text-dark/40 italic py-8">Aucun service disponible dans cette catégorie.</p>
                  )}
                </div>
                <div className="flex gap-4 mt-8">
                  <button onClick={() => setStep(1)} className="flex-1 btn-outline">Retour</button>
                  <button 
                    disabled={!selectedService}
                    onClick={() => {
                      setStep(3);
                      fetchAvailableSlots();
                    }}
                    className="flex-[2] btn-primary disabled:opacity-50 shadow-xl"
                  >
                    Continuer
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-serif">Choisir une date</h3>
                    <div className="text-xs text-dark/40 uppercase tracking-widest font-medium">
                      {new Date(selectedDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <div 
                      ref={dateScrollRef}
                      className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2 scroll-smooth"
                    >
                      {Array.from({ length: 21 }).map((_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() + i);
                        
                        // Skip Sundays
                        if (date.getDay() === 0) return null;

                        const dateStr = date.toISOString().split('T')[0];
                        const isSelected = selectedDate === dateStr;
                        const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
                        const dayNum = date.getDate();

                        return (
                          <button
                            key={dateStr}
                            onClick={() => setSelectedDate(dateStr)}
                            className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${
                              isSelected 
                                ? 'bg-dark text-paper shadow-lg scale-105' 
                                : 'bg-white border border-dark/5 text-dark hover:border-dark/20'
                            }`}
                          >
                            <span className={`text-[10px] uppercase tracking-widest mb-1 ${isSelected ? 'text-paper/60' : 'text-dark/40'}`}>
                              {dayName}
                            </span>
                            <span className="text-xl font-serif font-bold">
                              {dayNum}
                            </span>
                          </button>
                        );
                      }).filter(Boolean)}
                    </div>
                    
                    {/* Navigation Arrows for Desktop */}
                    <button 
                      onClick={() => scrollDates('left')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-white shadow-xl rounded-full hidden md:flex items-center justify-center border border-dark/5 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-dark hover:text-paper"
                    >
                      <ChevronRight className="rotate-180" size={20} />
                    </button>
                    <button 
                      onClick={() => scrollDates('right')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-white shadow-xl rounded-full hidden md:flex items-center justify-center border border-dark/5 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-dark hover:text-paper"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-serif mb-6">Choisir une heure</h3>
                  
                  {message?.type === 'error' && step === 3 && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                      <Info size={16} />
                      {message.text}
                    </div>
                  )}

                  {isLoadingSlots ? (
                    <p className="slots-loading">⏳ Chargement des créneaux...</p>
                  ) : timeSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {timeSlots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setSelectedTime(time)}
                          className={`slot-btn ${selectedTime === time ? 'selected' : ''}`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="slots-placeholder">
                      {selectedService && selectedDate 
                        ? "❌ Aucun créneau disponible ce jour" 
                        : "Sélectionnez un service et une date pour voir les créneaux disponibles"}
                    </p>
                  )}
                </div>

                <div className="flex gap-4 mt-8">
                  <button onClick={() => setStep(2)} className="flex-1 btn-outline">Retour</button>
                  <button 
                    disabled={!selectedTime}
                    onClick={() => setStep(4)}
                    className="flex-[2] btn-primary disabled:opacity-50"
                  >
                    Continuer
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className="text-xl font-serif mb-6">Vos informations</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-dark/50">Nom complet</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="w-full bg-white border border-dark/10 rounded-xl px-4 py-3 outline-none focus:border-dark transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-dark/50">Email</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jean@example.com"
                      className="w-full bg-white border border-dark/10 rounded-xl px-4 py-3 outline-none focus:border-dark transition-colors"
                    />
                  </div>
                </div>

                <div className="bg-dark/5 p-6 rounded-2xl space-y-2 mt-8">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark/50">Service</span>
                    <span className="font-medium">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark/50">Date</span>
                    <span className="font-medium">{new Date(selectedDate).toLocaleDateString('fr-FR')} à {selectedTime}</span>
                  </div>
                  <div className="flex justify-between text-lg font-serif pt-2 border-t border-dark/5">
                    <span>Total</span>
                    <span>{selectedService?.price}€</span>
                  </div>
                </div>

                {message?.type === 'error' && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                    {message.text}
                  </div>
                )}

                <div className="flex gap-4 mt-8">
                  <button 
                    onClick={() => {
                      setStep(3);
                      fetchAvailableSlots();
                    }} 
                    className="flex-1 btn-outline"
                  >
                    Retour
                  </button>
                  <button 
                    disabled={!name || !email || isBooking}
                    onClick={handleBooking}
                    className="flex-[2] btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isBooking ? 'Confirmation...' : 'Confirmer la réservation'}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div 
                key="step5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-8">
                  <Check size={40} />
                </div>
                <h3 className="text-3xl font-serif mb-4">Merci !</h3>
                <p className="text-dark/60 mb-12">
                  {message?.text} Un email de confirmation vous a été envoyé.
                </p>
                <button 
                  onClick={() => {
                    setStep(1);
                    setSelectedCategory(null);
                    setSelectedService(null);
                    setSelectedTime(null);
                    setName('');
                    setEmail('');
                    fetchAvailableSlots(); // Refresh again just in case
                  }} 
                  className="btn-outline"
                >
                  Nouvelle réservation
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  );
};

const GalleryManager = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const fetchGallery = async () => {
    try {
      const res = await fetch('/api/gallery');
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch (err) {
      console.error("Error fetching gallery:", err);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        const res = await fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: base64String, caption })
        });

        if (res.ok) {
          setCaption('');
          if (fileInputRef.current) fileInputRef.current.value = '';
          fetchGallery();
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error uploading file:", err);
      setIsUploading(false);
    }
  };

  const deleteImage = async (id: number) => {
    try {
      const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchGallery();
        setConfirmDeleteId(null);
      }
    } catch (err) {
      console.error("Error deleting image:", err);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-8">
      <h3 className="text-xl font-serif mb-6 flex items-center gap-2">
        <Instagram size={20} /> Gestion de la Galerie
      </h3>
      
      <div className="mb-8 p-6 bg-white border border-dark/5 rounded-2xl space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-dark/40">Ajouter une photo</p>
        <input 
          type="text" 
          placeholder="Légende (optionnel)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full bg-paper border border-dark/5 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-colors"
        />
        <div className="flex items-center gap-4">
          <input 
            type="file" 
            accept="image/*"
            onChange={handleFileUpload}
            ref={fileInputRef}
            className="hidden"
            id="gallery-upload"
          />
          <label 
            htmlFor="gallery-upload"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-dark/10 cursor-pointer hover:border-gold hover:bg-gold/5 transition-all text-sm font-medium ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus size={18} />
            {isUploading ? "Envoi en cours..." : "Choisir une photo"}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {images.map((img) => (
          <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden group">
            <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
              {confirmDeleteId === img.id ? (
                <div className="space-y-2">
                  <p className="text-white text-[10px] font-bold">Confirmer ?</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => deleteImage(img.id)}
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      title="Confirmer la suppression"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setConfirmDeleteId(null)}
                      className="p-2 bg-white/20 text-white rounded-full hover:bg-white/40 transition-colors"
                      title="Annuler"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-white text-[10px] mb-4 italic">{img.caption}</p>
                  <button 
                    onClick={() => setConfirmDeleteId(img.id)}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {images.length === 0 && (
          <div className="col-span-full py-12 text-center text-dark/20 text-sm italic border-2 border-dashed border-dark/5 rounded-2xl">
            Aucune photo dans la galerie
          </div>
        )}
      </div>
    </div>
  );
};

const CategoryManager = ({ categories, fetchCategories }: { categories: Category[], fetchCategories: () => Promise<void> }) => {
  const [editingCategories, setEditingCategories] = useState<Category[]>(categories);

  useEffect(() => {
    setEditingCategories(categories);
  }, [categories]);

  const handleAddCategory = () => {
    setEditingCategories([...editingCategories, { id: Math.random().toString(36).substr(2, 9), name: '', display_order: editingCategories.length }]);
  };

  const handleRemoveCategory = (index: number) => {
    setEditingCategories(editingCategories.filter((_, i) => i !== index));
  };

  const handleCategoryChange = (index: number, field: keyof Category, value: any) => {
    const newCats = [...editingCategories];
    newCats[index] = { ...newCats[index], [field]: value };
    setEditingCategories(newCats);
  };

  const saveCategories = async () => {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategories)
      });
      if (res.ok) {
        alert("Catégories mises à jour avec succès");
        fetchCategories();
      } else {
        alert("Erreur lors de la mise à jour des catégories");
      }
    } catch (err) {
      alert("Erreur réseau");
    }
  };

  return (
    <div className="glass-card rounded-3xl p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-serif flex items-center gap-2">
          <Settings size={20} /> Catégories de Prestations
        </h3>
        <button 
          onClick={handleAddCategory}
          className="p-2 hover:bg-dark/5 rounded-full transition-colors text-gold"
          title="Ajouter une catégorie"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="space-y-4 mb-6">
        {editingCategories.map((cat, index) => (
          <div key={cat.id || index} className="flex items-center gap-4 p-4 bg-white border border-dark/5 rounded-2xl">
            <div className="text-xs font-bold text-dark/20 w-4">{index + 1}</div>
            <input 
              type="text" 
              placeholder="Nom de la catégorie (ex: Adultes)"
              value={cat.name}
              onChange={(e) => handleCategoryChange(index, 'name', e.target.value)}
              className="flex-1 bg-transparent border-b border-dark/10 py-1 text-sm font-bold outline-none focus:border-gold"
            />
            <button 
              onClick={() => handleRemoveCategory(index)}
              className="text-dark/20 hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {editingCategories.length === 0 && (
          <p className="text-center text-dark/20 text-sm italic py-4">Aucune catégorie définie</p>
        )}
      </div>
      <button 
        onClick={saveCategories}
        className="w-full btn-primary py-3 rounded-xl shadow-lg"
      >
        Enregistrer les catégories
      </button>
    </div>
  );
};

const AdminDashboard = ({ 
  onLogout, 
  settings, 
  updateSetting,
  services,
  fetchServices,
  categories,
  fetchCategories
}: { 
  onLogout: () => void, 
  settings: AppSettings | null, 
  updateSetting: (key: string, value: any) => Promise<void>,
  services: Service[],
  fetchServices: () => Promise<void>,
  categories: Category[],
  fetchCategories: () => Promise<void>
}) => {
  const [loading, setLoading] = useState(true);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingServices, setEditingServices] = useState<Service[]>(services);

  useEffect(() => {
    setEditingServices(services);
  }, [services]);

  const handleAddService = () => {
    setEditingServices([...editingServices, { id: Math.random().toString(36).substr(2, 9), name: '', price: 0, duration: 30 }]);
  };

  const handleRemoveService = (index: number) => {
    setEditingServices(editingServices.filter((_, i) => i !== index));
  };

  const handleServiceChange = (index: number, field: keyof Service, value: any) => {
    const newServices = [...editingServices];
    newServices[index] = { ...newServices[index], [field]: value };
    setEditingServices(newServices);
  };

  const saveServices = async () => {
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingServices)
      });
      if (res.ok) {
        alert("Services mis à jour avec succès");
        fetchServices();
      } else {
        alert("Erreur lors de la mise à jour des services");
      }
    } catch (err) {
      alert("Erreur réseau");
    }
  };

  useEffect(() => {
    if (!showEventModal) {
      setShowDeleteConfirm(false);
    }
  }, [showEventModal]);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [showUnavailabilityModal, setShowUnavailabilityModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newUnavailability, setNewUnavailability] = useState({
    summary: 'Indisponibilité',
    date: getLocalDateString(),
    startTime: '09:00',
    endTime: '10:00'
  });

  useEffect(() => {
    fetchGoogleEvents();
    fetchCalendars();
    fetchNotifications();

    const socket = io();
    socket.on("notification", (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchCalendars();
        fetchGoogleEvents();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      socket.disconnect();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMins < 1) return "À l'instant";
    if (diffInMins < 60) return `Il y a ${diffInMins} min`;
    const diffInHours = Math.floor(diffInMins / 60);
    if (diffInHours < 24) return `Il y a ${diffInHours} h`;
    return date.toLocaleDateString('fr-FR');
  };

  useEffect(() => {
    fetchGoogleEvents();
  }, [settings?.google_calendar_id]);

  const fetchCalendars = async () => {
    try {
      const res = await fetch('/api/google/calendars');
      if (res.ok) {
        const data = await res.json();
        setCalendars(data);
      }
    } catch (err) {
      console.error("Error fetching calendars:", err);
    }
  };

  const fetchGoogleEvents = async () => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
      const res = await fetch(`/api/google/events?start=${start}&end=${end}`);
      if (res.ok) {
        const events = await res.json();
        setGoogleEvents(events.map((e: any) => {
          const fullTitle = (e.summary || '').replace(/^Coiffure:\s*/i, '');
          const nameOnly = fullTitle.split(' (')[0];
          const serviceType = fullTitle.includes('(') ? fullTitle.split('(')[1].replace(')', '') : '';
          
          return {
            id: e.id,
            title: nameOnly,
            start: e.start.dateTime || e.start.date,
            end: e.end.dateTime || e.end.date,
            extendedProps: {
              fullTitle: fullTitle,
              serviceType: serviceType,
              description: e.description,
              isUnavailability: (e.summary || '').includes('Indisponibilité'),
              isLocal: e.isLocal || false,
              isOrphaned: e.isOrphaned || false
            }
          };
        }));
      }
    } catch (err) {
      console.error("Error fetching Google events:", err);
    } finally {
      setLoading(false);
    }
  };

  const connectGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erreur de configuration Google");
        return;
      }
      window.open(data.url, 'google_auth', 'width=600,height=700');
    } catch (err) {
      alert("Impossible de contacter le serveur.");
    }
  };

  const syncAll = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/google/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Synchronisation terminée : ${data.syncedCount} rendez-vous synchronisés.`);
        fetchGoogleEvents();
      } else {
        alert(data.error || "Erreur lors de la synchronisation");
      }
    } catch (err) {
      alert("Erreur réseau lors de la synchronisation");
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!eventId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/google/events/${encodeURIComponent(eventId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setShowEventModal(false);
        setShowDeleteConfirm(false);
        fetchGoogleEvents();
      } else {
        const data = await res.json();
        console.error(data.error || "Erreur lors de la suppression");
      }
    } catch (err) {
      console.error("Error deleting event:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const addUnavailability = async () => {
    try {
      const start = `${newUnavailability.date}T${newUnavailability.startTime}:00`;
      const end = `${newUnavailability.date}T${newUnavailability.endTime}:00`;
      
      const res = await fetch('/api/google/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: newUnavailability.summary,
          start,
          end
        })
      });

      if (res.ok) {
        setShowUnavailabilityModal(false);
        fetchGoogleEvents();
      } else {
        alert("Erreur lors de l'ajout de l'indisponibilité");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateOpeningHours = async (day: string, field: string, value: any) => {
    let currentHours = {};
    try {
      currentHours = settings?.opening_hours ? JSON.parse(settings.opening_hours) : {};
    } catch (e) {
      console.error("Error parsing current hours", e);
    }
    const newHours = { ...currentHours };
    newHours[day] = { ...newHours[day], [field]: value };
    await updateSetting('opening_hours', JSON.stringify(newHours));
  };

  let openingHours = {};
  try {
    openingHours = settings?.opening_hours ? JSON.parse(settings.opening_hours) : {};
  } catch (e) {
    console.error("Error parsing opening hours", e);
  }
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels: Record<string, string> = {
    monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
    thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche'
  };

  if (loading) return <div className="pt-32 text-center font-serif text-2xl">Chargement...</div>;

  return (
    <div className="pt-32 pb-24 px-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
        <div>
          <h1 className="text-5xl font-serif mb-2">Espace Gérant</h1>
          <p className="text-dark/40 uppercase tracking-widest text-xs">Gestion du salon & calendrier</p>
        </div>
        <div className="flex gap-4">
          {/* Notifications Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-3 rounded-full transition-all ${showNotifications ? 'bg-dark text-paper' : 'bg-white border border-dark/5 hover:bg-dark/5'}`}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-paper">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <>
                  {/* Backdrop for closing on outside click */}
                  <div 
                    className="fixed inset-0 z-[45]" 
                    onClick={() => setShowNotifications(false)}
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="fixed inset-x-6 top-24 md:absolute md:inset-auto md:right-0 md:top-full md:mt-4 md:w-80 bg-white shadow-2xl rounded-3xl border border-dark/5 z-50 overflow-hidden"
                  >
                  <div className="p-4 border-b border-dark/5 flex justify-between items-center bg-paper/50">
                    <h4 className="font-serif font-bold">Notifications</h4>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-[10px] uppercase tracking-widest font-bold text-gold hover:text-dark transition-colors"
                      >
                        Tout marquer comme lu
                      </button>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          onClick={() => !notif.is_read && markAsRead(notif.id)}
                          className={`p-4 border-b border-dark/5 last:border-0 transition-all relative cursor-pointer ${!notif.is_read ? 'bg-gold/10 border-l-4 border-l-gold' : 'hover:bg-dark/5'}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`font-bold text-sm ${!notif.is_read ? 'text-dark' : 'text-dark/60'}`}>{notif.customer}</span>
                            <span className="text-[9px] text-dark/40 uppercase tracking-tighter">{getTimeAgo(notif.created_at)}</span>
                          </div>
                          <div className={`text-xs mb-2 ${!notif.is_read ? 'text-dark/80 font-medium' : 'text-dark/60'}`}>{notif.service}</div>
                          <div className="flex items-center gap-2 text-[10px] text-dark/40 italic">
                            <Calendar size={10} /> {notif.date} {notif.time && `à ${notif.time}`}
                          </div>
                          <div className="mt-1 text-[8px] text-dark/20 font-mono">{notif.reservation_id}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-dark/30 text-sm italic">
                        Aucune notification
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => setShowUnavailabilityModal(true)}
            className="btn-primary py-2 px-4 flex items-center gap-2"
          >
            <Plus size={18} /> Ajouter une indisponibilité
          </button>
          <button onClick={onLogout} className="btn-outline py-2 px-4">Déconnexion</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Sidebar Settings */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass-card rounded-3xl p-8">
            <h3 className="text-xl font-serif mb-6 flex items-center gap-2">
              <Settings size={20} /> Configuration
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm">Afficher "Galerie"</span>
                <button 
                  onClick={() => updateSetting('show_gallery', settings?.show_gallery === 'true' ? 'false' : 'true')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings?.show_gallery === 'true' ? 'bg-emerald-500' : 'bg-dark/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.show_gallery === 'true' ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Afficher "À propos"</span>
                <button 
                  onClick={() => updateSetting('show_about', settings?.show_about === 'true' ? 'false' : 'true')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings?.show_about === 'true' ? 'bg-emerald-500' : 'bg-dark/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.show_about === 'true' ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="pt-6 border-t border-dark/5 space-y-3">
                {calendars.length === 0 ? (
                  <button 
                    onClick={connectGoogle}
                    className="w-full flex items-center justify-center gap-2 border py-3 rounded-xl bg-white border-dark/10 hover:bg-dark/5 transition-colors text-sm font-medium"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                    Lier Google Calendar
                  </button>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-1">
                      <Check size={14} /> Google Calendar Connecté
                    </div>
                    <p className="text-[10px] text-emerald-600/70 leading-tight">
                      La synchronisation est automatique via votre pont n8n.
                    </p>
                    <button 
                      onClick={connectGoogle}
                      className="mt-3 text-[10px] uppercase tracking-widest font-bold text-emerald-700/50 hover:text-emerald-700 transition-colors"
                    >
                      Changer de compte
                    </button>
                  </div>
                )}
              </div>

              {calendars.length > 0 && (
                <div className="pt-6 border-t border-dark/5 space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-dark/40">Agenda utilisé par défaut</label>
                  <select 
                    value={settings?.google_calendar_id || 'primary'}
                    onChange={(e) => updateSetting('google_calendar_id', e.target.value)}
                    className="w-full bg-white border border-dark/10 py-2 px-3 rounded-xl text-sm outline-none focus:border-gold"
                  >
                    <option value="primary">Agenda Principal</option>
                    {calendars.map(cal => (
                      <option key={cal.id} value={cal.id}>{cal.summary}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-dark/40 italic">
                    Cet agenda est enregistré comme source de vérité.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-8">
            <h3 className="text-xl font-serif mb-6 flex items-center gap-2">
              <Clock size={20} /> Horaires d'ouverture
            </h3>
            <div className="space-y-4">
              {days.map(day => (
                <div key={day} className="space-y-2 pb-4 border-b border-dark/5 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest">{dayLabels[day]}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] uppercase tracking-widest font-bold ${openingHours[day]?.closed ? 'text-red-500' : 'text-emerald-500'}`}>
                        {openingHours[day]?.closed ? 'Fermé' : 'Ouvert'}
                      </span>
                      <button 
                        onClick={() => updateOpeningHours(day, 'closed', !openingHours[day]?.closed)}
                        className={`w-10 h-5 rounded-full transition-all relative hover:shadow-sm ${!openingHours[day]?.closed ? 'bg-emerald-500' : 'bg-dark/10'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${!openingHours[day]?.closed ? 'left-6' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>
                  {!openingHours[day]?.closed && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <TimeInput 
                          value={openingHours[day]?.open || '09:00'} 
                          onChange={(val) => updateOpeningHours(day, 'open', val)}
                          className="flex-1"
                        />
                        <span className="text-dark/20 font-bold">à</span>
                        <TimeInput 
                          value={openingHours[day]?.close || '19:00'} 
                          onChange={(val) => updateOpeningHours(day, 'close', val)}
                          className="flex-1"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-dark/40 uppercase tracking-widest font-bold">Pause déjeuner</span>
                        <button 
                          onClick={() => updateOpeningHours(day, 'has_break', !openingHours[day]?.has_break)}
                          className={`w-8 h-4 rounded-full transition-all relative ${openingHours[day]?.has_break ? 'bg-gold' : 'bg-dark/10'}`}
                        >
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${openingHours[day]?.has_break ? 'left-4.5' : 'left-0.5'}`}></div>
                        </button>
                      </div>

                      {openingHours[day]?.has_break && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                          <TimeInput 
                            value={openingHours[day]?.break_start || '12:00'} 
                            onChange={(val) => updateOpeningHours(day, 'break_start', val)}
                            className="flex-1"
                          />
                          <span className="text-dark/20 text-[10px] font-bold">à</span>
                          <TimeInput 
                            value={openingHours[day]?.break_end || '14:00'} 
                            onChange={(val) => updateOpeningHours(day, 'break_end', val)}
                            className="flex-1"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <CategoryManager categories={categories} fetchCategories={fetchCategories} />

          <div className="glass-card rounded-3xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif flex items-center gap-2">
                <Scissors size={20} /> Gestion des Services
              </h3>
              <button 
                onClick={handleAddService}
                className="p-2 hover:bg-dark/5 rounded-full transition-colors text-gold"
                title="Ajouter un service"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {editingServices.map((service, index) => (
                <div key={service.id || index} className="p-4 bg-white border border-dark/5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <input 
                      type="text" 
                      placeholder="Nom du service"
                      value={service.name}
                      onChange={(e) => handleServiceChange(index, 'name', e.target.value)}
                      className="bg-transparent border-b border-dark/10 py-1 text-sm font-bold outline-none focus:border-gold w-full"
                    />
                    <button 
                      onClick={() => handleRemoveService(index)}
                      className="text-dark/20 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Prix (€)</label>
                      <input 
                        type="number" 
                        value={isNaN(service.price) ? '' : service.price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleServiceChange(index, 'price', isNaN(val) ? 0 : val);
                        }}
                        className="w-full bg-dark/5 rounded-lg px-3 py-2 text-xs outline-none focus:bg-gold/10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Durée (min)</label>
                      <input 
                        type="number" 
                        step="15"
                        value={isNaN(service.duration) ? '' : service.duration}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          handleServiceChange(index, 'duration', isNaN(val) ? 0 : val);
                        }}
                        className="w-full bg-dark/5 rounded-lg px-3 py-2 text-xs outline-none focus:bg-gold/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Catégorie</label>
                    <select 
                      value={service.category_id || ''}
                      onChange={(e) => handleServiceChange(index, 'category_id', e.target.value)}
                      className="w-full bg-dark/5 rounded-lg px-3 py-2 text-xs outline-none focus:bg-gold/10"
                    >
                      <option value="">Sans catégorie</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <button 
                onClick={saveServices}
                className="w-full btn-primary py-3 rounded-xl text-sm font-bold shadow-sm"
              >
                Enregistrer les services
              </button>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif flex items-center gap-2">
                <Calendar size={20} /> Aujourd'hui
              </h3>
              <button 
                onClick={fetchGoogleEvents}
                className="p-2 hover:bg-dark/5 rounded-full transition-colors text-dark/40 hover:text-gold"
                title="Rafraîchir"
              >
                <Clock size={16} />
              </button>
            </div>
            <div className="space-y-4">
              {googleEvents.filter(e => {
                const eventDate = new Date(e.start);
                const today = new Date();
                return eventDate.getDate() === today.getDate() && 
                       eventDate.getMonth() === today.getMonth() && 
                       eventDate.getFullYear() === today.getFullYear() &&
                       !e.extendedProps?.isUnavailability;
              }).length === 0 ? (
                <div className="text-center py-4 text-dark/30 italic text-sm">Aucun rendez-vous aujourd'hui</div>
              ) : (
                googleEvents
                  .filter(e => {
                    const eventDate = new Date(e.start);
                    const today = new Date();
                    return eventDate.getDate() === today.getDate() && 
                           eventDate.getMonth() === today.getMonth() && 
                           eventDate.getFullYear() === today.getFullYear() &&
                           !e.extendedProps?.isUnavailability;
                  })
                  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                  .map((e) => (
                    <div 
                      key={e.id} 
                      className="p-4 rounded-xl bg-white border border-dark/5 text-sm hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => {
                        // Find the event in the calendar and trigger click or just show modal
                        const calendarApi = (document.querySelector('.admin-calendar .fc') as any)?._fullCalendarApi;
                        if (calendarApi) {
                          const event = calendarApi.getEventById(e.id);
                          if (event) {
                            setSelectedEvent(event);
                            setShowEventModal(true);
                          }
                        } else {
                          // Fallback if API not easily accessible
                          setSelectedEvent({
                            id: e.id,
                            title: e.title,
                            start: e.start,
                            end: e.end,
                            extendedProps: e.extendedProps
                          });
                          setShowEventModal(true);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-dark group-hover:text-gold transition-colors">{e.title}</div>
                          <div className="text-[10px] text-dark/40 uppercase tracking-widest mt-0.5">{e.extendedProps?.serviceType}</div>
                        </div>
                        <div className="text-gold font-black text-base">
                          {new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Main Calendar View */}
        <div className="lg:col-span-8 space-y-8">
          <GalleryManager />
          
          <div className="glass-card rounded-3xl p-4 md:p-8 admin-calendar">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={window.innerWidth < 768 ? "timeGridDay" : "timeGridWeek"}
              headerToolbar={window.innerWidth < 768 ? {
                left: 'prev,next',
                center: 'title',
                right: 'timeGridDay,timeGridWeek'
              } : {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              locale={frLocale}
              events={googleEvents}
              eventClassNames={(arg) => {
                const classes = [];
                if (arg.event.extendedProps.isUnavailability) classes.push('event-unavailability');
                else {
                  const service = (arg.event.extendedProps.serviceType || '').toLowerCase();
                  if (service.includes('barbe')) classes.push('event-coupe-barbe');
                  else if (service.includes('coupe')) classes.push('event-coupe');
                  else classes.push('event-booking');
                }
                
                if (arg.event.extendedProps.isLocal) classes.push('event-local-only');
                if (arg.event.extendedProps.isOrphaned) classes.push('event-orphaned');
                return classes;
              }}
              height={window.innerWidth < 768 ? "500px" : "650px"}
              slotMinTime="08:00:00"
              slotMaxTime="20:00:00"
              allDaySlot={false}
              expandRows={true}
              slotDuration="00:30:00"
              slotLabelInterval="01:00"
              nowIndicator={true}
              eventMouseEnter={(info) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'fc-event-tooltip animate-in fade-in zoom-in duration-200';
                tooltip.innerHTML = `
                  <div class="font-bold mb-1">${info.event.title}</div>
                  <div class="opacity-70">${info.event.extendedProps.serviceType || ''}</div>
                  <div class="mt-2 text-[10px] opacity-50">
                    ${new Date(info.event.start!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - 
                    ${new Date(info.event.end!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                `;
                tooltip.id = `tooltip-${info.event.id}`;
                document.body.appendChild(tooltip);
                
                const updatePos = (e: MouseEvent) => {
                  tooltip.style.left = `${e.clientX + 15}px`;
                  tooltip.style.top = `${e.clientY + 15}px`;
                };
                
                info.el.addEventListener('mousemove', updatePos);
                (info.el as any)._tooltipUpdatePos = updatePos;
              }}
              eventMouseLeave={(info) => {
                const tooltip = document.getElementById(`tooltip-${info.event.id}`);
                if (tooltip) tooltip.remove();
                info.el.removeEventListener('mousemove', (info.el as any)._tooltipUpdatePos);
              }}
              eventContent={(eventInfo) => {
                return (
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-start">
                      <span className="fc-event-time">
                        {eventInfo.timeText}
                      </span>
                    </div>
                    <div className="fc-event-title">
                      {eventInfo.event.title}
                    </div>
                    {eventInfo.event.extendedProps.serviceType && (
                      <div className="text-[9px] opacity-40 uppercase tracking-tighter truncate mt-auto">
                        {eventInfo.event.extendedProps.serviceType}
                      </div>
                    )}
                  </div>
                );
              }}
              eventClick={(info) => {
                setSelectedEvent(info.event);
                setShowEventModal(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      <AnimatePresence>
        {showEventModal && selectedEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEventModal(false)}
              className="absolute inset-0 bg-dark/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-paper rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-serif">Détails du rendez-vous</h3>
                <button onClick={() => setShowEventModal(false)} className="p-2 hover:bg-dark/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Client</label>
                    <p className="text-lg font-medium">{selectedEvent.title}</p>
                  </div>
                </div>

                {!selectedEvent.extendedProps.isUnavailability && selectedEvent.extendedProps.serviceType && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                      <Scissors className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Prestation</label>
                      <p className="text-lg font-medium">{selectedEvent.extendedProps.serviceType}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Horaire</label>
                    <p className="text-lg font-medium">
                      {new Date(selectedEvent.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedEvent.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-sm text-dark/60">
                      {new Date(selectedEvent.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>

                {selectedEvent.extendedProps.description && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                      <Info className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Notes</label>
                      <p className="text-sm text-dark/70 leading-relaxed">{selectedEvent.extendedProps.description}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-dark/5">
                {!showDeleteConfirm ? (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-xl transition-colors"
                  >
                    Supprimer le rendez-vous
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-center text-sm font-medium text-dark/70">Confirmer la suppression ?</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-3 bg-dark/5 text-dark font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-dark/10 transition-colors"
                        disabled={isDeleting}
                      >
                        Annuler
                      </button>
                      <button 
                        onClick={() => deleteEvent(selectedEvent.id)}
                        className="flex-1 py-3 bg-red-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Suppression...' : 'Confirmer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unavailability Modal */}
      <AnimatePresence>
        {showUnavailabilityModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnavailabilityModal(false)}
              className="absolute inset-0 bg-dark/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-paper rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-serif mb-6">Bloquer un créneau</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Motif</label>
                  <input 
                    type="text" 
                    value={newUnavailability.summary}
                    onChange={(e) => setNewUnavailability({...newUnavailability, summary: e.target.value})}
                    className="w-full bg-white border border-dark/10 rounded-xl px-4 py-2 outline-none focus:border-dark"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Date</label>
                  <input 
                    type="date" 
                    value={newUnavailability.date}
                    onChange={(e) => setNewUnavailability({...newUnavailability, date: e.target.value})}
                    className="w-full bg-white border border-dark/10 rounded-xl px-4 py-2 outline-none focus:border-dark"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Début</label>
                    <input 
                      type="time" 
                      value={newUnavailability.startTime}
                      onChange={(e) => setNewUnavailability({...newUnavailability, startTime: e.target.value})}
                      className="w-full bg-white border border-dark/10 rounded-xl px-4 py-2 outline-none focus:border-dark"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Fin</label>
                    <input 
                      type="time" 
                      value={newUnavailability.endTime}
                      onChange={(e) => setNewUnavailability({...newUnavailability, endTime: e.target.value})}
                      className="w-full bg-white border border-dark/10 rounded-xl px-4 py-2 outline-none focus:border-dark"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button onClick={() => setShowUnavailabilityModal(false)} className="flex-1 btn-outline">Annuler</button>
                <button onClick={addUnavailability} className="flex-1 btn-primary">Enregistrer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Footer = ({ openingHours, onAdminClick, isAdmin }: { openingHours: Record<string, DayHours>, onAdminClick: () => void, isAdmin: boolean }) => {
  const formatDay = (day: string) => {
    const names: Record<string, string> = {
      monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
      thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche'
    };
    return names[day];
  };

  return (
    <footer id="contact" className="bg-dark text-paper py-24 px-6">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-16">
        <div>
          <h2 className="text-3xl font-serif mb-8">Chez Tom</h2>
          <p className="text-paper/40 leading-relaxed mb-8">
            Votre barbier de confiance au cœur de la ville. Tradition et modernité se rencontrent pour sublimer votre style.
          </p>
          <div className="flex space-x-4 mt-auto pt-2">
            <a href="#" className="w-10 h-10 rounded-full border border-paper/10 flex items-center justify-center hover:border-gold hover:text-gold transition-all">
              <Instagram size={18} />
            </a>
            <a href="#" className="w-10 h-10 rounded-full border border-paper/10 flex items-center justify-center hover:border-gold hover:text-gold transition-all">
              <Facebook size={18} />
            </a>
          </div>
        </div>
        
        <div>
          <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-gold mb-8">Horaires</h3>
          <ul className="space-y-4 text-sm">
            {Object.entries(openingHours).map(([day, hours]) => (
              <li key={day} className="flex justify-between border-b border-paper/5 pb-2">
                <span className="text-paper/40">{formatDay(day)}</span>
                {hours.closed ? (
                  <span className="text-gold">Fermé</span>
                ) : (
                  <span>{hours.open} - {hours.close}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-gold mb-8">Contact</h3>
          <ul className="space-y-6">
            <li className="flex items-start gap-4">
              <MapPin size={20} className="text-gold shrink-0" />
              <span className="text-sm">123 Rue de l'Élégance,<br />75001 Paris</span>
            </li>
            <li className="flex items-center gap-4">
              <Phone size={20} className="text-gold shrink-0" />
              <span className="text-sm">01 23 45 67 89</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-paper/5 text-center text-[10px] uppercase tracking-widest text-paper/20">
        <button 
          onClick={onAdminClick}
          className="hover:text-gold transition-colors cursor-default"
        >
          &copy; {new Date().getFullYear()} Chez Tom. Tous droits réservés.
        </button>
      </div>
    </footer>
  );
};

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      return (
        <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-4xl font-serif mb-4">Oups ! Quelque chose s'est mal passé.</h1>
          <p className="text-dark/60 mb-8 max-w-md">
            Une erreur inattendue est survenue. Veuillez rafraîchir la page ou réessayer plus tard.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Rafraîchir la page
          </button>
          {process.env.NODE_ENV !== 'production' && (
            <pre className="mt-8 p-4 bg-red-50 text-red-800 rounded-lg text-left text-xs overflow-auto max-w-full">
              {(this as any).state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    show_gallery: 'true',
    show_about: 'true',
    opening_hours: JSON.stringify({
      monday: { open: '09:00', close: '19:00', closed: false },
      tuesday: { open: '09:00', close: '19:00', closed: false },
      wednesday: { open: '09:00', close: '19:00', closed: false },
      thursday: { open: '09:00', close: '19:00', closed: false },
      friday: { open: '09:00', close: '19:00', closed: false },
      saturday: { open: '09:00', close: '18:00', closed: false },
      sunday: { open: '09:00', close: '12:00', closed: true }
    })
  });

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/services');
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error("Error fetching services:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchServices();
    fetchCategories();
  }, []);

  const updateSetting = async (key: string, value: any) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    fetchSettings();
  };

  const handleAdminLogin = () => {
    if (password === 'admin123') { // Simple check for demo
      setIsAdmin(true);
      setShowAdminLogin(false);
      setPassword('');
    } else {
      alert('Mot de passe incorrect');
    }
  };

  let mainOpeningHours = {};
  try {
    mainOpeningHours = settings?.opening_hours ? JSON.parse(settings.opening_hours) : {};
  } catch (e) {
    console.error("Error parsing main opening hours", e);
  }

  return (
    <div className="min-h-screen selection:bg-gold selection:text-dark">
      <Navbar isAdmin={isAdmin} />

      {isAdmin ? (
        <AdminDashboard 
          onLogout={() => setIsAdmin(false)} 
          settings={settings} 
          updateSetting={updateSetting} 
          services={services}
          fetchServices={fetchServices}
          categories={categories}
          fetchCategories={fetchCategories}
        />
      ) : (
        <>
          <Hero />
          <Services services={services} categories={categories} />
          
          {settings?.show_gallery === 'true' && <Gallery />}

          <BookingSection services={services} categories={categories} openingHours={mainOpeningHours} />
          
          {settings?.show_about === 'true' && (
            <section className="py-32 px-6 bg-white overflow-hidden">
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="max-w-4xl mx-auto text-center"
              >
                <h2 className="text-4xl font-serif mb-2">L'histoire de Chez Tom</h2>
                <div className="w-12 h-[1px] bg-gold mx-auto mb-12"></div>
                <p className="text-lg text-dark/60 leading-relaxed italic px-8">
                  "Passionné par l'art du barbier depuis plus de 10 ans, j'ai créé ce salon pour offrir aux hommes un espace où le temps s'arrête. Ici, on ne vient pas seulement pour une coupe, mais pour un moment de détente et de soin."
                </p>
                <div className="mt-12 font-serif text-xl tracking-widest">— Tom, Fondateur</div>
              </motion.div>
            </section>
          )}
          
          <Footer 
            openingHours={mainOpeningHours} 
            isAdmin={isAdmin}
            onAdminClick={() => isAdmin ? setIsAdmin(false) : setShowAdminLogin(true)}
          />
        </>
      )}

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-dark/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-paper p-8 rounded-3xl max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-2xl font-serif mb-6 text-center">Accès Gérant</h3>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="w-full bg-white border border-dark/10 rounded-xl px-4 py-3 mb-6 outline-none focus:border-gold transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              />
              <div className="flex gap-4">
                <button onClick={() => setShowAdminLogin(false)} className="flex-1 btn-outline py-2">Annuler</button>
                <button onClick={handleAdminLogin} className="flex-1 btn-primary py-2">Entrer</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

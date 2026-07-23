import React, { useState, useEffect, Suspense, lazy, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors, Clock, MapPin, Phone, Instagram, Facebook, Menu, X, ChevronRight, Settings } from 'lucide-react';

// --- Types ---
import type { Service, Category, DayHours, AppSettings, GalleryImage } from './types';
import { BookingSection } from './booking/Booking';
import { adminFetch, adminLogin, adminLogout, checkAdminSession } from './admin/api';

// L'espace gérant (FullCalendar, socket.io…) n'est chargé
// que si l'admin se connecte — les visiteurs ne le téléchargent jamais.
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));

// --- Components ---

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
        <a
          href="#"
          aria-label="Tom Barber — accueil"
          className="brand-logo font-bold text-lg md:text-2xl transition-colors duration-500"
          style={{ color: scrolled ? 'var(--color-dark)' : 'var(--color-paper)' }}
        >
          <span className="lead">T</span><span className="ltr">o</span><span className="ltr">m</span><span className="ltr sp"> </span><span className="lead">B</span><span className="ltr">a</span><span className="ltr">r</span><span className="ltr">b</span><span className="ltr">e</span><span className="ltr">r</span>
        </a>
        
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
        alt="Salon de coiffure Tom Barber - Ambiance authentique et élégante"
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        fetchPriority="high"
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
        Barbier · Coiffeur — Martigné-sur-Mayenne
      </motion.span>
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-5xl md:text-8xl font-serif mb-8 leading-tight luxury-text-shadow text-paper"
      >
        Tom <br /> <span className="italic text-gold">Barber</span>
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
                className={`px-7 md:px-10 py-3 md:py-4 rounded-[3px] text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold transition-all duration-300 whitespace-nowrap border flex-shrink-0 relative ${
                  activeCategory === cat.id
                    ? 'bg-dark text-paper border-dark z-10'
                    : 'bg-white text-dark/40 border-hairline hover:border-dark hover:text-dark z-0'
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
                whileTap={{ scale: 0.98 }}
                href="#booking"
                className="inline-flex items-center justify-center gap-6 bg-dark text-paper px-10 md:px-12 py-5 md:py-6 rounded-none text-[11px] md:text-xs uppercase tracking-[0.5em] font-black transition-all duration-500 group relative overflow-hidden"
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
                  alt="Ambiance du salon Tom Barber"
                  className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/20 to-transparent opacity-70"></div>
                
                <div className="absolute bottom-10 left-10 right-10">
                  <motion.div 
                    initial={{ y: 30, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="p-8 md:p-10 backdrop-blur-xl bg-white/5 border border-white/20 rounded-[4px]"
                  >
                    <p className="text-paper text-sm md:text-base font-serif italic leading-relaxed mb-6">
                      "L'élégance n'est pas une question de luxe, mais de soin apporté aux détails."
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-px bg-gold"></div>
                      <span className="text-[10px] uppercase tracking-[0.4em] text-paper/50 font-bold">L'esprit Tom Barber</span>
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
              className="relative aspect-square overflow-hidden rounded-[4px] group cursor-pointer"
            >
              <img
                src={img.url}
                alt={img.caption || 'Réalisation du salon Tom Barber'}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
                loading="lazy"
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


const Footer = ({ openingHours }: { openingHours: Record<string, DayHours> }) => {
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
          <h2 className="text-3xl font-serif mb-8">Tom Barber</h2>
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
              <span className="text-sm">Martigné-sur-Mayenne<br />53470</span>
            </li>
            <li className="flex items-center gap-4">
              <Phone size={20} className="text-gold shrink-0" />
              <span className="text-sm">01 23 45 67 89</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-paper/5 text-center text-[10px] uppercase tracking-widest text-paper/20">
        <span>&copy; {new Date().getFullYear()} Tom Barber. Tous droits réservés.</span>
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

// L'espace gérant vit sur /admin (ex. https://chez-tom.fr/admin) —
// aucun point d'entrée visible sur le site public.
const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin';

function AppContent() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(!isAdminRoute);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
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
    // Sur /admin : restaure la session si un token valide est encore présent.
    if (isAdminRoute) {
      checkAdminSession().then((ok) => {
        if (ok) setIsAdmin(true);
        setSessionChecked(true);
      });
    }
  }, []);

  const updateSetting = async (key: string, value: any) => {
    await adminFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    fetchSettings();
  };

  const handleAdminLogin = async () => {
    if (!password || loggingIn) return;
    setLoggingIn(true);
    setLoginError(null);
    const result = await adminLogin(password);
    setLoggingIn(false);
    if (result.ok) {
      setIsAdmin(true);
      setPassword('');
    } else {
      setLoginError(result.error ?? 'Mot de passe incorrect');
    }
  };

  const handleLogout = () => {
    adminLogout();
    // Retour au site public après déconnexion.
    window.location.href = '/';
  };

  let mainOpeningHours = {};
  try {
    mainOpeningHours = settings?.opening_hours ? JSON.parse(settings.opening_hours) : {};
  } catch (e) {
    console.error("Error parsing main opening hours", e);
  }

  // --- Espace gérant, sur /admin uniquement ---
  if (isAdminRoute) {
    if (!sessionChecked) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <span className="mono-label text-muted-deep animate-pulse">Tom Barber…</span>
        </div>
      );
    }

    if (isAdmin) {
      return (
        <div className="min-h-screen selection:bg-gold selection:text-dark">
          <Navbar isAdmin={isAdmin} />
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center">
                <span className="mono-label text-muted-deep animate-pulse">Chargement de l'espace gérant…</span>
              </div>
            }
          >
            <AdminDashboard
              onLogout={handleLogout}
              settings={settings}
              updateSetting={updateSetting}
              services={services}
              fetchServices={fetchServices}
              categories={categories}
              fetchCategories={fetchCategories}
            />
          </Suspense>
        </div>
      );
    }

    // Écran de connexion dédié
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6 selection:bg-gold selection:text-dark">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="text-2xl font-serif font-bold tracking-[0.3em] text-dark">TOM BARBER</div>
            <div className="mono-label text-gold-deep mt-3">Espace gérant</div>
          </div>
          <div className="bg-white border border-hairline rounded-[4px] p-8 shadow-sm">
            <label htmlFor="admin-password" className="mono-label text-muted-deep block mb-2">Mot de passe</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
              autoFocus
              autoComplete="current-password"
              className="w-full bg-white border border-hairline rounded-[3px] px-4 py-3 mb-3 outline-none focus:border-dark transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
            />
            {loginError && (
              <p role="alert" className="text-sm mb-3" style={{ color: '#B23A2B' }}>{loginError}</p>
            )}
            <button onClick={handleAdminLogin} disabled={loggingIn || !password} className="w-full btn-primary py-3 mt-2">
              {loggingIn ? 'Vérification…' : 'Entrer'}
            </button>
          </div>
          <a href="/" className="btn-ghost mx-auto mt-8 w-fit flex">
            <span className="w-4 h-px bg-muted-deep" />
            Retour au site
          </a>
        </motion.div>
      </div>
    );
  }

  // --- Site public ---
  return (
    <div className="min-h-screen selection:bg-gold selection:text-dark">
      <Navbar isAdmin={false} />
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
            <h2 className="text-4xl font-serif mb-2">L'histoire de Tom Barber</h2>
            <div className="w-12 h-[1px] bg-gold mx-auto mb-12"></div>
            <p className="text-lg text-dark/60 leading-relaxed italic px-8">
              "Passionné par l'art du barbier depuis plus de 10 ans, j'ai créé ce salon pour offrir aux hommes un espace où le temps s'arrête. Ici, on ne vient pas seulement pour une coupe, mais pour un moment de détente et de soin."
            </p>
            <div className="mt-12 font-serif text-xl tracking-widest">— Tom, Fondateur</div>
          </motion.div>
        </section>
      )}

      <Footer openingHours={mainOpeningHours} />
    </div>
  );
}

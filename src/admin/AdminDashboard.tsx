import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors, Calendar, Clock, MapPin, Phone, Instagram, Facebook, X, Check, ChevronRight, Settings, LogOut, Plus, Trash2, User, Info, Bell, RefreshCw } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { io } from 'socket.io-client';
import type { Service, Category, Notification, Booking, GalleryImage, DayHours, AppSettings } from '../types';
import { adminFetch, getAdminToken } from './api';

const TimeInput = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
  const [h, m] = (value || "00:00").split(':');
  
  const handleHourChange = (newH: string) => {
    onChange(`${newH.padStart(2, '0')}:${m}`);
  };
  
  const handleMinChange = (newM: string) => {
    onChange(`${h}:${newM.padStart(2, '0')}`);
  };

  return (
    <div className={`flex items-center gap-1 bg-white border border-dark/10 rounded-[3px] px-2 py-2 ${className} hover:border-gold transition-colors shadow-sm`}>
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
const pad2 = (n: number) => n.toString().padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
/** Pas de la grille de créneaux du formulaire gérant (le site, lui, propose du 30 min). */
const ADMIN_SLOT_STEP = 15;

/** Prochaine demi-heure ronde : au comptoir, le client est là maintenant. */
const nextHalfHour = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + ((30 - (now.getMinutes() % 30)) % 30), 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

/**
 * Redimensionne une photo dans le navigateur avant envoi (côté long ≤ maxSide px,
 * JPEG qualité 0.85). Une photo de téléphone de 4 Mo devient ~300 Ko : le serveur
 * refuse au-delà de 3 Mo et la page publique reste légère.
 */
const resizeImageFile = (file: File, maxSide = 1600, quality = 0.85): Promise<string> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      // Fond blanc : un PNG transparent converti en JPEG ne devient pas noir.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Ce fichier n'est pas une image lisible par le navigateur."));
    };
    img.src = objectUrl;
  });

const GalleryManager = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const fetchGallery = async () => {
    try {
      const res = await adminFetch('/api/gallery');
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
    setUploadError(null);
    try {
      const dataUrl = await resizeImageFile(file);
      const res = await adminFetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: dataUrl, caption })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCaption('');
        fetchGallery();
      } else {
        setUploadError(data.error || "Impossible d'ajouter la photo.");
      }
    } catch (err: any) {
      setUploadError(err?.message || "Impossible de lire ce fichier.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsUploading(false);
    }
  };

  const deleteImage = async (id: number) => {
    try {
      const res = await adminFetch(`/api/gallery/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchGallery();
        setConfirmDeleteId(null);
      }
    } catch (err) {
      console.error("Error deleting image:", err);
    }
  };

  return (
    <div className="glass-card rounded-[4px] p-5 md:p-8">
      <h3 className="text-xl font-serif mb-6 flex items-center gap-2">
        <Instagram size={20} /> Gestion de la Galerie
      </h3>
      
      <div className="mb-8 p-6 bg-white border border-dark/5 rounded-[4px] space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-dark/40">Ajouter une photo</p>
        <input 
          type="text" 
          placeholder="Légende (optionnel)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full bg-paper border border-dark/5 rounded-[3px] px-4 py-3 text-sm outline-none focus:border-gold transition-colors"
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
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[3px] border-2 border-dashed border-dark/10 cursor-pointer hover:border-gold hover:bg-gold/5 transition-all text-sm font-medium ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus size={18} />
            {isUploading ? "Envoi en cours..." : "Choisir une photo"}
          </label>
        </div>
        <p className="text-[10px] text-muted-deep leading-tight">
          JPEG, PNG ou WebP. La photo est réduite automatiquement à 1600 px avant l'envoi.
        </p>
        {uploadError && (
          <p role="alert" className="text-xs" style={{ color: '#B23A2B' }}>{uploadError}</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {images.map((img) => (
          <div key={img.id} className="relative aspect-square rounded-[3px] overflow-hidden group">
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
          <div className="col-span-full py-12 text-center text-dark/20 text-sm italic border-2 border-dashed border-dark/5 rounded-[4px]">
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
      const res = await adminFetch('/api/categories', {
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
    <div className="glass-card rounded-[4px] p-5 md:p-8">
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
          <div key={cat.id || index} className="flex items-center gap-4 p-4 bg-white border border-dark/5 rounded-[4px]">
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
        className="w-full btn-primary py-3 rounded-[3px] shadow-lg"
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
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const changePassword = async () => {
    try {
      const res = await adminFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'admin_password', value: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewPassword('');
        setPasswordMsg({ ok: true, text: 'Mot de passe mis à jour. Il sera demandé à la prochaine connexion.' });
      } else {
        setPasswordMsg({ ok: false, text: data.error || 'Erreur lors de la mise à jour.' });
      }
    } catch {
      setPasswordMsg({ ok: false, text: 'Erreur réseau.' });
    }
  };

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
      const res = await adminFetch('/api/services', {
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

  // Rendez-vous pris au salon, sans passer par le site.
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [newBooking, setNewBooking] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    service_id: '',
    date: getLocalDateString(),
    startTime: nextHalfHour(),
  });
  // Semaine affichée par le sélecteur de jour — indépendante du jour choisi, pour
  // pouvoir feuilleter sans perdre sa sélection.
  const [bookingWeek, setBookingWeek] = useState(getLocalDateString());
  const slotsRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollSlots = useRef(false);

  // Le planning se règle différemment sur téléphone (vues, densité, défilement
  // latéral). Suivi en état plutôt que lu une fois : la rotation de l'écran compte.
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sur téléphone, l'espace gérant sert à consulter le planning et à poser un
  // rendez-vous : les réglages du salon sont repliés derrière un bouton.
  const [showSettings, setShowSettings] = useState(false);
  const [calendarView, setCalendarView] = useState(() => (window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek'));


  useEffect(() => {
    fetchGoogleEvents();
    fetchCalendars();
    fetchNotifications();

    const socket = io({ auth: { token: getAdminToken() } });
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
      const res = await adminFetch('/api/notifications');
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
      await adminFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await adminFetch(`/api/notifications/${id}/read`, { method: 'POST' });
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
      const res = await adminFetch('/api/google/calendars');
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
      // Quatre mois : le planning n'en affiche qu'une semaine, mais la vue du jour du
      // formulaire de rendez-vous doit connaître l'occupation bien au-delà.
      const end = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString();
      const res = await adminFetch(`/api/google/events?start=${start}&end=${end}`);
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
              // Le serveur marque explicitement les indisponibilités locales. Se fier au
              // seul titre faisait passer « Livraison produits » pour un rendez-vous client.
              // Le repli sur le titre reste utile pour les miroirs venus de Google.
              isUnavailability: e.isUnavailability === true || (e.summary || '').includes('Indisponibilité'),
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
      const res = await adminFetch('/api/auth/google/url');
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
      const res = await adminFetch('/api/google/sync', { method: 'POST' });
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
      const res = await adminFetch(`/api/google/events/${encodeURIComponent(eventId)}`, {
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

      // Indisponibilité locale (bloque immédiatement les créneaux du site) ;
      // le serveur la miroite sur Google Calendar si un compte est lié.
      const res = await adminFetch('/api/blocks', {
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

  const openBookingModal = (prefill?: { date?: string; startTime?: string }) => {
    const date = prefill?.date || getLocalDateString();
    setBookingError(null);
    setNewBooking({
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      // La durée n'est pas saisie : le serveur la relit dans la prestation choisie.
      service_id: services[0]?.id || '',
      date,
      startTime: prefill?.startTime || nextHalfHour(),
    });
    setBookingWeek(date);
    shouldScrollSlots.current = true;
    setShowBookingModal(true);
  };

  const addBooking = async () => {
    setIsSavingBooking(true);
    setBookingError(null);
    try {
      const res = await adminFetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: newBooking.customer_name,
          customer_phone: newBooking.customer_phone,
          customer_email: newBooking.customer_email,
          service_id: newBooking.service_id,
          start_time: `${newBooking.date}T${newBooking.startTime}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowBookingModal(false);
        fetchGoogleEvents();
      } else {
        setBookingError(data.error || "Impossible d'enregistrer le rendez-vous.");
      }
    } catch {
      setBookingError('Erreur réseau.');
    } finally {
      setIsSavingBooking(false);
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

  let openingHours: Record<string, DayHours> = {};
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

  // --- Fenêtre du planning --------------------------------------------------
  // On n'affiche que les jours travaillés et la plage d'ouverture réelle : sinon
  // la grille 8 h–20 h sur 7 jours oblige à faire défiler pour voir l'après-midi.
  // La fenêtre s'élargit si un rendez-vous déborde, pour ne jamais le masquer.
  const dayIndexes: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };

  const minutesOf = (time?: string) => {
    const [h, m] = (time || '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };

  const eventDays = new Set(googleEvents.map(e => new Date(e.start).getDay()));
  const closedDays = days
    .filter(day => openingHours[day]?.closed && !eventDays.has(dayIndexes[day]))
    .map(day => dayIndexes[day]);
  // Salon marqué fermé toute la semaine : on montre quand même la grille complète,
  // FullCalendar refuse de s'afficher si les sept jours sont masqués.
  const hiddenDays = closedDays.length >= 7 ? [] : closedDays;

  const openDays = days.filter(day => !openingHours[day]?.closed);
  const starts: number[] = openDays.map(day => minutesOf(openingHours[day]?.open) ?? 9 * 60);
  const ends: number[] = openDays.map(day => minutesOf(openingHours[day]?.close) ?? 19 * 60);
  if (starts.length === 0) { starts.push(9 * 60); ends.push(19 * 60); }

  googleEvents.forEach(e => {
    const start = new Date(e.start);
    if (isNaN(start.getTime())) return;
    const end = new Date(e.end || e.start);
    const startMin = start.getHours() * 60 + start.getMinutes();
    // Un événement qui court jusqu'au lendemain occupe la fin de journée.
    const sameDay = !isNaN(end.getTime()) && end.toDateString() === start.toDateString();
    starts.push(startMin);
    ends.push(sameDay ? Math.max(startMin, end.getHours() * 60 + end.getMinutes()) : 24 * 60);
  });

  const firstHour = Math.max(0, Math.floor(Math.min(...starts) / 60));
  const lastHour = Math.min(24, Math.max(firstHour + 1, Math.ceil(Math.max(...ends) / 60)));
  const slotMinTime = `${String(firstHour).padStart(2, '0')}:00:00`;
  const slotMaxTime = `${String(lastHour).padStart(2, '0')}:00:00`;

  // --- Formulaire de rendez-vous : semaine, journée choisie, créneaux -------
  // Tout est calculé à partir des rendez-vous déjà chargés : la fenêtre montre
  // l'occupation réelle du jour, pas une simple liste d'heures.
  const bookingService = services.find(service => service.id === newBooking.service_id);
  const bookingDuration = bookingService?.duration ?? 30;

  const parseDay = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    const parsed = new Date(y, (m || 1) - 1, d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };
  const hoursOf = (value: string) => openingHours[days[(parseDay(value).getDay() + 6) % 7]];

  // Les sept jours de la semaine affichée, à partir du lundi.
  const weekAnchor = parseDay(bookingWeek);
  const weekMonday = new Date(weekAnchor);
  weekMonday.setDate(weekMonday.getDate() - ((weekAnchor.getDay() + 6) % 7));
  const bookingWeekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekMonday);
    day.setDate(day.getDate() + i);
    return day;
  });

  const shiftBookingWeek = (weeks: number) => {
    const next = new Date(weekMonday);
    next.setDate(next.getDate() + weeks * 7);
    setBookingWeek(dateKey(next));
  };

  // Occupation du jour choisi : rendez-vous et indisponibilités déjà posés.
  const dayBusy = googleEvents
    .filter(e => dateKey(new Date(e.start)) === newBooking.date)
    .map(e => {
      const from = new Date(e.start);
      const to = new Date(e.end || e.start);
      return {
        from: from.getHours() * 60 + from.getMinutes(),
        to: dateKey(to) === newBooking.date ? to.getHours() * 60 + to.getMinutes() : 24 * 60,
        title: e.title as string,
        service: e.extendedProps?.serviceType as string | undefined,
        isUnavailability: Boolean(e.extendedProps?.isUnavailability),
      };
    })
    .filter(b => b.to > b.from)
    .sort((a, b) => a.from - b.from);

  const dayHours = hoursOf(newBooking.date);
  const dayClosed = Boolean(!dayHours || dayHours.closed);
  const dayOpen = toMinutes(dayHours?.open || '09:00');
  const dayClose = toMinutes(dayHours?.close || '19:00');
  const breakFrom = dayHours?.has_break ? toMinutes(dayHours.break_start || '12:00') : null;
  const breakTo = dayHours?.has_break ? toMinutes(dayHours.break_end || '14:00') : null;

  // La grille déborde d'une heure de chaque côté : le gérant doit pouvoir caser
  // quelqu'un juste avant l'ouverture ou juste après la fermeture.
  const gridFrom = Math.max(0, Math.min(dayOpen - 60, ...dayBusy.map(b => b.from)));
  const gridTo = Math.min(24 * 60, Math.max(dayClose + 60, ...dayBusy.map(b => b.to)));

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = newBooking.date === dateKey(new Date());

  const bookingSlots = [] as Array<{
    at: number;
    label: string;
    busy: typeof dayBusy[number] | undefined;
    startsBusy: boolean;
    blocked: boolean;
    outside: boolean;
    inBreak: boolean;
    past: boolean;
  }>;
  for (let at = gridFrom; at < gridTo; at += ADMIN_SLOT_STEP) {
    const busy = dayBusy.find(b => at < b.to && at + ADMIN_SLOT_STEP > b.from);
    const inBreak = breakFrom !== null && breakTo !== null && at < breakTo && at + bookingDuration > breakFrom;
    bookingSlots.push({
      at,
      label: toHHMM(at),
      busy,
      // Le nom n'est écrit que sur la première ligne du rendez-vous.
      startsBusy: Boolean(busy && (busy.from >= at || at === gridFrom)) && !bookingSlots.some(s => s.busy === busy),
      // Un début libre dont la prestation mordrait sur le voisin reste inutilisable :
      // le serveur le refuserait de toute façon.
      blocked: dayBusy.some(b => at < b.to && at + bookingDuration > b.from),
      outside: dayClosed || at < dayOpen || at + bookingDuration > dayClose || inBreak,
      inBreak,
      past: isToday && at + bookingDuration <= nowMinutes,
    });
  }

  // On prévient, on ne bloque pas : caser quelqu'un pendant la pause reste son droit.
  const selectedSlot = bookingSlots.find(slot => slot.label === newBooking.startTime);
  const bookingWarning = (() => {
    if (dayClosed) return 'Le salon est fermé ce jour-là.';
    if (!selectedSlot?.outside) return null;
    const from = toMinutes(newBooking.startTime);
    if (from < dayOpen || from + bookingDuration > dayClose) {
      return `En dehors des horaires d'ouverture (${dayHours?.open || '09:00'} – ${dayHours?.close || '19:00'}).`;
    }
    return `Pendant la pause déjeuner (${dayHours?.break_start || '12:00'} – ${dayHours?.break_end || '14:00'}).`;
  })();

  // Ouverture du formulaire ou changement de jour : si l'heure retenue n'est pas
  // sélectionnable (journée déjà écoulée, créneau pris), on se cale sur la première
  // heure libre, puis la liste défile jusqu'à elle. Un choix délibéré n'est jamais écrasé.
  useEffect(() => {
    if (!showBookingModal || bookingSlots.length === 0) return;
    const current = bookingSlots.find(slot => slot.label === newBooking.startTime);
    // Sur un changement de jour on repart aussi d'une heure ouvrée : garder « 08:00 hors
    // horaires » hérité du jour précédent n'a aucun sens. Un clic délibéré, lui, tient.
    const stale = shouldScrollSlots.current && (current?.outside || current?.past);
    if (!current || current.busy || current.blocked || stale) {
      const fallback = bookingSlots.find(slot => !slot.busy && !slot.blocked && !slot.outside && !slot.past)
        ?? bookingSlots.find(slot => !slot.busy && !slot.blocked);
      if (fallback) {
        setNewBooking(b => ({ ...b, startTime: fallback.label }));
        return;
      }
    }
    if (!shouldScrollSlots.current) return;
    shouldScrollSlots.current = false;
    const target = slotsRef.current?.querySelector('[data-selected="true"]');
    (target as HTMLElement | null)?.scrollIntoView({ block: 'center' });
  }, [showBookingModal, newBooking.date, newBooking.startTime]);

  if (loading) return <div className="pt-32 text-center font-serif text-2xl">Chargement...</div>;

  return (
    <div className="pt-24 pb-24 px-6 max-w-[1500px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-serif md:mb-1">Espace Gérant</h1>
          {/* Sous-titre décoratif : sur téléphone, cette place vaut mieux au planning. */}
          <p className="hidden md:block text-dark/40 uppercase tracking-widest text-xs">Gestion du salon & calendrier</p>
        </div>
        {/* Sur téléphone, les actions passent à la ligne au lieu de forcer la largeur de la page. */}
        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
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
                    className="fixed inset-x-6 top-24 md:absolute md:inset-auto md:right-0 md:top-full md:mt-4 md:w-80 bg-white shadow-2xl rounded-[4px] border border-dark/5 z-50 overflow-hidden"
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

          {/* Le cas fréquent, c'est le client au comptoir : il passe en action principale. */}
          <button
            onClick={() => openBookingModal()}
            className="btn-primary py-2 px-4 max-md:px-4! flex items-center justify-center gap-2 flex-1 md:flex-none"
          >
            <Plus size={18} className="shrink-0" />
            <span className="md:hidden whitespace-nowrap">Rendez-vous</span>
            <span className="hidden md:inline">Ajouter un rendez-vous</span>
          </button>
          {/* Sur téléphone ces deux actions passent en icônes : trois boutons pleine
              largeur empilés mangeaient 300 px avant même d'avoir vu le planning. */}
          <button
            onClick={() => setShowUnavailabilityModal(true)}
            title="Bloquer un créneau"
            aria-label="Bloquer un créneau"
            className="btn-outline py-2 px-4 max-md:px-3! flex items-center gap-2 shrink-0"
          >
            <Clock size={18} />
            <span className="hidden md:inline">Bloquer un créneau</span>
          </button>
          <button
            onClick={onLogout}
            title="Déconnexion"
            aria-label="Déconnexion"
            className="btn-outline py-2 px-4 max-md:px-3! flex items-center gap-2 shrink-0"
          >
            <LogOut size={18} className="md:hidden" />
            <span className="hidden md:inline">Déconnexion</span>
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Le planning en tête : c'est ce qu'on vient consulter en premier. */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-9 min-w-0">
            <div className="glass-card rounded-[4px] p-4 md:p-5 admin-calendar">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
                headerToolbar={isMobile ? {
                  left: 'prev,next today',
                  center: 'title',
                  right: 'timeGridDay,timeGridThreeDay,timeGridWeek'
                } : {
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                // Trois jours : le compromis lisible du téléphone. Une semaine sur 375 px
                // donne six colonnes de 50 px où plus aucun nom ne tient ; trois colonnes
                // en font 105. La semaine reste disponible pour la vue d'ensemble.
                views={{
                  timeGridThreeDay: { type: 'timeGrid', duration: { days: 3 }, buttonText: '3 jours' },
                }}
                // Titre court sur téléphone, sinon il pousse les flèches hors de la ligne.
                titleFormat={isMobile ? { day: 'numeric', month: 'short' } : undefined}
                // En vue semaine sur téléphone, « LUN. 21/09 » ne tient pas dans 43 px et
                // les colonnes se chevauchent : on tombe à l'initiale et au quantième.
                dayHeaderFormat={isMobile && calendarView === 'timeGridWeek'
                  ? { weekday: 'narrow', day: 'numeric' }
                  : undefined}
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
                height="auto"
                slotMinTime={slotMinTime}
                slotMaxTime={slotMaxTime}
                allDaySlot={false}
                hiddenDays={hiddenDays}
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
                  // La case fait la hauteur du rendez-vous : on n'affiche que ce qui y tient.
                  // Sous 30 min, le nom passe avant l'heure (déjà lisible dans la grille).
                  const start = eventInfo.event.start;
                  const end = eventInfo.event.end;
                  const minutes = start && end ? (end.getTime() - start.getTime()) / 60000 : 60;
                  const serviceType = eventInfo.event.extendedProps.serviceType;
                  return (
                    <div className="flex flex-col h-full overflow-hidden justify-center">
                      {minutes >= 30 && (
                        <span className="fc-event-time">{eventInfo.timeText}</span>
                      )}
                      <div className="fc-event-title">
                        {eventInfo.event.title}
                      </div>
                      {minutes >= 45 && serviceType && (
                        <div className="text-[9px] opacity-40 uppercase tracking-tighter truncate mt-auto">
                          {serviceType}
                        </div>
                      )}
                    </div>
                  );
                }}
                datesSet={(arg) => setCalendarView(arg.view.type)}
                eventClick={(info) => {
                  setSelectedEvent(info.event);
                  setShowEventModal(true);
                }}
                dateClick={(info) => {
                  // Cliquer dans le planning ouvre la saisie déjà posée sur le créneau.
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  const d = info.date;
                  openBookingModal({
                    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
                    startTime: info.allDay ? undefined : `${pad(d.getHours())}:${pad(d.getMinutes())}`,
                  });
                }}
              />
            </div>
          </div>

          {/* Le récap du jour reste à côté du planning, pas en bas de page. */}
          <div className="lg:col-span-3 min-w-0 lg:sticky lg:top-28">
            <div className="glass-card rounded-[4px] p-5 md:p-8">
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
                        className="p-4 rounded-[3px] bg-white border border-dark/5 text-sm hover:shadow-md transition-all cursor-pointer group"
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
        </div>

        {/* Sur téléphone, tout ce qui suit le planning est replié : ces cinq blocs
            représentaient 5,5 écrans sur 7. Sur grand écran, rien ne change. */}
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          aria-expanded={showSettings}
          className="lg:hidden w-full glass-card rounded-[4px] px-5 py-4 flex items-center justify-between"
        >
          <span className="flex items-center gap-2 font-serif text-lg">
            <Settings size={18} /> Réglages du salon
          </span>
          <ChevronRight size={18} className={`transition-transform ${showSettings ? 'rotate-90' : ''}`} />
        </button>

        <div className={`${showSettings ? 'block' : 'hidden'} lg:block space-y-8`}>
          {/* Réglages du salon : trois colonnes au lieu d'une pile à faire défiler. */}
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 min-w-0">
              <div className="glass-card rounded-[4px] p-5 md:p-8">
                <h3 className="text-xl font-serif mb-6 flex items-center gap-2">
                  <Settings size={20} /> Configuration
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Afficher "Galerie"</span>
                    <button 
                      onClick={() => updateSetting('show_gallery', settings?.show_gallery === 'true' ? 'false' : 'true')}
                      className={`w-12 h-6 rounded-full transition-colors relative ${settings?.show_gallery === 'true' ? 'bg-dark' : 'bg-dark/10'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.show_gallery === 'true' ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Afficher "À propos"</span>
                    <button 
                      onClick={() => updateSetting('show_about', settings?.show_about === 'true' ? 'false' : 'true')}
                      className={`w-12 h-6 rounded-full transition-colors relative ${settings?.show_about === 'true' ? 'bg-dark' : 'bg-dark/10'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.show_about === 'true' ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>

                  {/* Horizon de réservation */}
                  <div className="pt-6 border-t border-dark/5 space-y-2">
                    <label htmlFor="horizon-weeks" className="text-[10px] uppercase tracking-widest text-dark/40 font-bold block">
                      Réservation possible jusqu'à
                    </label>
                    <div className="flex items-center gap-3">
                      <select
                        id="horizon-weeks"
                        value={settings?.booking_horizon_weeks || '4'}
                        onChange={(e) => updateSetting('booking_horizon_weeks', e.target.value)}
                        className="bg-white border border-dark/10 py-2 px-3 rounded-[3px] text-sm outline-none focus:border-gold"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={String(n)}>{n} {n > 1 ? 'semaines' : 'semaine'}</option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-deep">à l'avance</span>
                    </div>
                  </div>

                  {/* Changement du mot de passe admin */}
                  <div className="pt-6 border-t border-dark/5 space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">
                      Changer le mot de passe gérant
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setPasswordMsg(null); }}
                        placeholder="Nouveau mot de passe (8 caractères min.)"
                        // min-w-0 : sans ça, la largeur minimale intrinsèque du champ
                        // fait déborder la carte sur téléphone.
                        className="flex-1 min-w-0 bg-dark/5 rounded-[3px] px-3 py-2 text-xs outline-none focus:bg-gold/10"
                      />
                      <button
                        onClick={changePassword}
                        disabled={newPassword.length < 8}
                        className="btn-primary py-2 px-4 text-[10px] disabled:opacity-30 shrink-0"
                      >
                        Modifier
                      </button>
                    </div>
                    {passwordMsg && (
                      <p className={`text-xs ${passwordMsg.ok ? 'text-gold-deep' : 'text-red-500'}`}>{passwordMsg.text}</p>
                    )}
                  </div>

                  <div className="pt-6 border-t border-dark/5 space-y-3">
                    {calendars.length === 0 ? (
                      <>
                        <button
                          onClick={connectGoogle}
                          className="w-full flex items-center justify-center gap-2 border py-3 rounded-[3px] bg-white border-dark/10 hover:bg-dark/5 transition-colors text-sm font-medium"
                        >
                          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                          Lier Google Calendar
                        </button>
                        <p className="text-[10px] text-muted-deep leading-tight">
                          Facultatif — le planning et les réservations fonctionnent sans compte Google.
                          Une fois lié : vos rendez-vous sont recopiés dans l'agenda choisi, et <strong>tout événement
                          de cet agenda bloque les créneaux en ligne</strong> (pratique pour bloquer un créneau depuis
                          votre téléphone). Un événement marqué « Disponible » ne bloque rien.
                        </p>
                      </>
                    ) : (
                      <div className="bg-paper border border-hairline rounded-[3px] p-4">
                        <div className="flex items-center gap-2 text-gold-deep font-bold text-xs mb-1">
                          <Check size={14} /> Google Calendar Connecté
                        </div>
                        <p className="text-[10px] text-muted-deep leading-tight">
                          Vos réservations sont recopiées dans l'agenda ci-dessous, et <strong>tout événement de cet
                          agenda bloque les créneaux du site</strong>. Pour qu'un événement ne bloque pas, marquez-le
                          « Disponible » dans Google Agenda.
                        </p>
                        <button 
                          onClick={connectGoogle}
                          className="mt-3 text-[10px] uppercase tracking-widest font-bold text-muted-deep hover:text-dark transition-colors"
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
                        className="w-full min-w-0 bg-white border border-dark/10 py-2 px-3 rounded-[3px] text-sm outline-none focus:border-gold"
                      >
                        <option value="primary">Agenda Principal</option>
                        {calendars.map(cal => (
                          <option key={cal.id} value={cal.id}>{cal.summary}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-dark/40 italic">
                        Les événements de cet agenda bloquent les créneaux en ligne.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 min-w-0">
              <div className="glass-card rounded-[4px] p-5 md:p-8">
                <h3 className="text-xl font-serif mb-6 flex items-center gap-2">
                  <Clock size={20} /> Horaires d'ouverture
                </h3>
                {/* Une ligne par jour : le planning ne montre que les jours ouverts. */}
                <div className="divide-y divide-dark/5">
                  {days.map(day => {
                    const hours = openingHours[day] || ({} as DayHours);
                    return (
                      <div key={day} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <button
                            onClick={() => updateOpeningHours(day, 'closed', !hours.closed)}
                            aria-label={`${hours.closed ? 'Ouvrir' : 'Fermer'} le ${dayLabels[day].toLowerCase()}`}
                            className={`w-9 h-5 rounded-full transition-all relative shrink-0 hover:shadow-sm ${!hours.closed ? 'bg-dark' : 'bg-dark/10'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${!hours.closed ? 'left-5' : 'left-1'}`}></div>
                          </button>
                          <span className={`text-xs font-bold uppercase tracking-widest ${hours.closed ? 'text-dark/30' : ''}`}>
                            {dayLabels[day]}
                          </span>
                          {hours.closed ? (
                            <span className="ml-auto text-[10px] uppercase tracking-widest font-bold text-dark/30">Fermé</span>
                          ) : (
                            <div className="ml-auto flex items-center gap-1.5">
                              <TimeInput value={hours.open || '09:00'} onChange={(val) => updateOpeningHours(day, 'open', val)} />
                              <span className="text-dark/20 text-xs">–</span>
                              <TimeInput value={hours.close || '19:00'} onChange={(val) => updateOpeningHours(day, 'close', val)} />
                            </div>
                          )}
                        </div>

                        {!hours.closed && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2 pl-6 sm:pl-12">
                            <button
                              onClick={() => updateOpeningHours(day, 'has_break', !hours.has_break)}
                              aria-label={`${hours.has_break ? 'Retirer' : 'Ajouter'} la pause déjeuner du ${dayLabels[day].toLowerCase()}`}
                              className={`w-7 h-3.5 rounded-full transition-all relative shrink-0 ${hours.has_break ? 'bg-gold' : 'bg-dark/10'}`}
                            >
                              <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${hours.has_break ? 'left-4' : 'left-0.5'}`}></div>
                            </button>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-dark/40">Pause déjeuner</span>
                            {hours.has_break && (
                              <div className="ml-auto flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                                <TimeInput value={hours.break_start || '12:00'} onChange={(val) => updateOpeningHours(day, 'break_start', val)} />
                                <span className="text-dark/20 text-xs">–</span>
                                <TimeInput value={hours.break_end || '14:00'} onChange={(val) => updateOpeningHours(day, 'break_end', val)} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 min-w-0">
              <CategoryManager categories={categories} fetchCategories={fetchCategories} />
            </div>
          </div>

            <div className="glass-card rounded-[4px] p-5 md:p-8">
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
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {editingServices.map((service, index) => (
                  <div key={service.id || index} className="p-4 bg-white border border-dark/5 rounded-[4px] space-y-3">
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
                          className="w-full min-w-0 bg-dark/5 rounded-lg px-3 py-2 text-xs outline-none focus:bg-gold/10"
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
                          className="w-full min-w-0 bg-dark/5 rounded-lg px-3 py-2 text-xs outline-none focus:bg-gold/10"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Catégorie</label>
                      <select 
                        value={service.category_id || ''}
                        onChange={(e) => handleServiceChange(index, 'category_id', e.target.value)}
                        className="w-full min-w-0 bg-dark/5 rounded-lg px-3 py-2 text-xs outline-none focus:bg-gold/10"
                      >
                        <option value="">Sans catégorie</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Description (affichée dans la réservation)</label>
                      <textarea
                        value={service.description || ''}
                        onChange={(e) => handleServiceChange(index, 'description', e.target.value)}
                        placeholder="Ex. Rasoir traditionnel, serviette chaude"
                        rows={2}
                        className="w-full min-w-0 bg-dark/5 rounded-lg px-3 py-2 text-xs outline-none focus:bg-gold/10 resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={saveServices}
                className="w-full btn-primary py-3 rounded-[3px] text-sm font-bold shadow-sm mt-6"
              >
                Enregistrer les services
              </button>
            </div>

          <GalleryManager />
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
              className="relative w-full max-w-md bg-paper rounded-[4px] p-8 shadow-2xl"
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
                    className="w-full py-3 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-[3px] transition-colors"
                  >
                    Supprimer le rendez-vous
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-center text-sm font-medium text-dark/70">Confirmer la suppression ?</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-3 bg-dark/5 text-dark font-bold text-xs uppercase tracking-widest rounded-[3px] hover:bg-dark/10 transition-colors"
                        disabled={isDeleting}
                      >
                        Annuler
                      </button>
                      <button 
                        onClick={() => deleteEvent(selectedEvent.id)}
                        className="flex-1 py-3 bg-red-500 text-white font-bold text-xs uppercase tracking-widest rounded-[3px] hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
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

      {/* Rendez-vous pris au comptoir */}
      <AnimatePresence>
        {showBookingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBookingModal(false)}
              className="absolute inset-0 bg-dark/60 backdrop-blur-sm"
            />
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onSubmit={(e) => { e.preventDefault(); addBooking(); }}
              className="relative w-full max-w-3xl bg-paper rounded-[4px] p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-serif">Nouveau rendez-vous</h3>
                  <p className="text-[10px] uppercase tracking-widest text-dark/40 font-bold mt-1">Client au salon</p>
                </div>
                <button type="button" onClick={() => setShowBookingModal(false)} className="p-2 hover:bg-dark/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                {/* Le client */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="booking-name" className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Nom du client</label>
                    <input
                      id="booking-name"
                      type="text"
                      autoFocus
                      value={newBooking.customer_name}
                      onChange={(e) => setNewBooking({ ...newBooking, customer_name: e.target.value })}
                      placeholder="Ex. Julien Moreau"
                      className="w-full min-w-0 bg-white border border-dark/10 rounded-[3px] px-4 py-2 outline-none focus:border-dark"
                    />
                  </div>

                  <div>
                    <label htmlFor="booking-service" className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Prestation</label>
                    <select
                      id="booking-service"
                      value={newBooking.service_id}
                      onChange={(e) => setNewBooking({ ...newBooking, service_id: e.target.value })}
                      className="w-full min-w-0 bg-white border border-dark/10 rounded-[3px] px-4 py-2 outline-none focus:border-dark"
                    >
                      {services.length === 0 && <option value="">Aucune prestation configurée</option>}
                      {services.map(service => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                      ))}
                    </select>
                    {/* La durée vient de la prestation : elle n'est pas saisie ici. */}
                    {bookingService && (
                      <p className="text-[10px] uppercase tracking-widest text-dark/40 font-bold mt-1.5">
                        {bookingService.duration} min · {bookingService.price} €
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-dark/5 space-y-4">
                    <div>
                      <label htmlFor="booking-phone" className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">
                        Téléphone <span className="text-dark/30 normal-case tracking-normal">(facultatif)</span>
                      </label>
                      <input
                        id="booking-phone"
                        type="tel"
                        value={newBooking.customer_phone}
                        onChange={(e) => setNewBooking({ ...newBooking, customer_phone: e.target.value })}
                        className="w-full min-w-0 bg-white border border-dark/10 rounded-[3px] px-4 py-2 outline-none focus:border-dark"
                      />
                    </div>
                    <div>
                      <label htmlFor="booking-email" className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">
                        E-mail <span className="text-dark/30 normal-case tracking-normal">(facultatif)</span>
                      </label>
                      <input
                        id="booking-email"
                        type="email"
                        value={newBooking.customer_email}
                        onChange={(e) => setNewBooking({ ...newBooking, customer_email: e.target.value })}
                        className="w-full min-w-0 bg-white border border-dark/10 rounded-[3px] px-4 py-2 outline-none focus:border-dark"
                      />
                    </div>
                  </div>
                </div>

                {/* La journée : ce qui est déjà pris, et ce qu'il reste */}
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <button type="button" onClick={() => shiftBookingWeek(-1)} aria-label="Semaine précédente" className="p-1.5 hover:bg-dark/5 rounded-full transition-colors">
                      <ChevronRight size={16} className="rotate-180" />
                    </button>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-dark/40">
                      {weekMonday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – {bookingWeekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    <button type="button" onClick={() => shiftBookingWeek(1)} aria-label="Semaine suivante" className="p-1.5 hover:bg-dark/5 rounded-full transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {bookingWeekDays.map(day => {
                      const key = dateKey(day);
                      const selected = key === newBooking.date;
                      const closed = Boolean(openingHours[days[(day.getDay() + 6) % 7]]?.closed);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { shouldScrollSlots.current = true; setNewBooking({ ...newBooking, date: key }); }}
                          title={closed ? 'Salon fermé' : undefined}
                          className={`py-1.5 rounded-[3px] transition-colors ${selected ? 'bg-dark text-paper' : closed ? 'text-dark/25 hover:bg-dark/5' : 'text-dark/70 hover:bg-dark/5'}`}
                        >
                          <span className="block text-[9px] uppercase tracking-widest">{day.toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span>
                          <span className="block text-sm font-bold">{day.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-dark/50 mt-3 mb-1 capitalize">
                    {parseDay(newBooking.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {dayClosed
                      ? ' — fermé'
                      : ` — ${dayHours?.open || '09:00'} à ${dayHours?.close || '19:00'}`}
                  </p>

                  <div ref={slotsRef} className="h-[280px] overflow-y-auto border border-dark/10 rounded-[3px] bg-white">
                    {bookingSlots.map(slot => {
                      const onTheHour = slot.at % 60 === 0;
                      if (slot.busy) {
                        return (
                          <div
                            key={slot.at}
                            className={`flex items-center gap-2 px-2 h-7 text-[11px] border-l-2 ${onTheHour ? 'border-t border-t-dark/5' : ''} ${slot.busy.isUnavailability ? 'border-l-[#B23A2B] bg-[#F7EAE7]' : 'border-l-gold bg-gold/10'}`}
                          >
                            <span className="w-9 shrink-0 tabular-nums text-dark/40">{slot.startsBusy ? slot.label : ''}</span>
                            {slot.startsBusy && (
                              <span className="truncate font-bold text-dark/80">
                                {slot.busy.title}
                                {slot.busy.service && <span className="font-normal text-dark/40"> · {slot.busy.service}</span>}
                              </span>
                            )}
                          </div>
                        );
                      }
                      const selected = slot.label === newBooking.startTime;
                      const free = !slot.blocked && !slot.outside && !slot.past;
                      return (
                        <button
                          key={slot.at}
                          type="button"
                          disabled={slot.blocked}
                          data-selected={selected || undefined}
                          data-free={free || undefined}
                          onClick={() => setNewBooking({ ...newBooking, startTime: slot.label })}
                          className={`flex w-full items-center gap-2 px-2 h-7 text-[11px] border-l-2 border-l-transparent transition-colors ${onTheHour ? 'border-t border-t-dark/5' : ''} ${
                            selected
                              ? 'bg-dark text-paper font-bold'
                              : slot.blocked
                                ? 'text-dark/20 cursor-not-allowed'
                                : free
                                  ? 'text-dark/70 hover:bg-gold/20'
                                  : 'text-dark/30 hover:bg-dark/5'
                          }`}
                        >
                          <span className="w-9 shrink-0 tabular-nums">{slot.label}</span>
                          <span className="truncate">
                            {slot.blocked
                              ? `pas la place (${bookingDuration} min)`
                              : slot.past ? 'passé'
                              : dayClosed ? 'fermé'
                              : slot.inBreak ? 'pause déjeuner'
                              : slot.outside ? 'hors horaires'
                              : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {bookingWarning && (
                    <p className="text-xs text-gold-deep bg-gold/10 border-l-2 border-gold px-3 py-2 mt-3">
                      {bookingWarning} Le rendez-vous sera quand même enregistré.
                    </p>
                  )}
                  {bookingError && (
                    <p className="text-xs text-red-600 bg-red-50 border-l-2 border-red-500 px-3 py-2 mt-3">{bookingError}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowBookingModal(false)} className="flex-1 btn-outline">Annuler</button>
                <button
                  type="submit"
                  disabled={isSavingBooking || !newBooking.customer_name.trim() || !newBooking.service_id}
                  className="flex-1 btn-primary disabled:opacity-30"
                >
                  {isSavingBooking ? 'Enregistrement...' : `Enregistrer · ${newBooking.startTime}`}
                </button>
              </div>
            </motion.form>
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
              className="relative w-full max-w-md bg-paper rounded-[4px] p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-serif mb-6">Bloquer un créneau</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Motif</label>
                  <input 
                    type="text" 
                    value={newUnavailability.summary}
                    onChange={(e) => setNewUnavailability({...newUnavailability, summary: e.target.value})}
                    className="w-full bg-white border border-dark/10 rounded-[3px] px-4 py-2 outline-none focus:border-dark"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Date</label>
                  <input 
                    type="date" 
                    value={newUnavailability.date}
                    onChange={(e) => setNewUnavailability({...newUnavailability, date: e.target.value})}
                    className="w-full bg-white border border-dark/10 rounded-[3px] px-4 py-2 outline-none focus:border-dark"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Début</label>
                    <input 
                      type="time" 
                      value={newUnavailability.startTime}
                      onChange={(e) => setNewUnavailability({...newUnavailability, startTime: e.target.value})}
                      className="w-full bg-white border border-dark/10 rounded-[3px] px-4 py-2 outline-none focus:border-dark"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-dark/50 mb-1 block">Fin</label>
                    <input 
                      type="time" 
                      value={newUnavailability.endTime}
                      onChange={(e) => setNewUnavailability({...newUnavailability, endTime: e.target.value})}
                      className="w-full bg-white border border-dark/10 rounded-[3px] px-4 py-2 outline-none focus:border-dark"
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

export default AdminDashboard;

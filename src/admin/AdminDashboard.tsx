import React, { useState, useEffect } from 'react';
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
const GalleryManager = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
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
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        const res = await adminFetch('/api/gallery', {
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
    <div className="glass-card rounded-[4px] p-8">
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
    <div className="glass-card rounded-[4px] p-8">
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
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
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
      
      const res = await adminFetch('/api/google/events', {
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
          <div className="glass-card rounded-[4px] p-8">
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
                    className="flex-1 bg-dark/5 rounded-[3px] px-3 py-2 text-xs outline-none focus:bg-gold/10"
                  />
                  <button
                    onClick={changePassword}
                    disabled={newPassword.length < 8}
                    className="btn-primary py-2 px-4 text-[10px] disabled:opacity-30"
                  >
                    Modifier
                  </button>
                </div>
                {passwordMsg && (
                  <p className={`text-xs ${passwordMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{passwordMsg.text}</p>
                )}
              </div>

              <div className="pt-6 border-t border-dark/5 space-y-3">
                {calendars.length === 0 ? (
                  <button 
                    onClick={connectGoogle}
                    className="w-full flex items-center justify-center gap-2 border py-3 rounded-[3px] bg-white border-dark/10 hover:bg-dark/5 transition-colors text-sm font-medium"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                    Lier Google Calendar
                  </button>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-[3px] p-4">
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
                    className="w-full bg-white border border-dark/10 py-2 px-3 rounded-[3px] text-sm outline-none focus:border-gold"
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

          <div className="glass-card rounded-[4px] p-8">
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

          <div className="glass-card rounded-[4px] p-8">
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
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-dark/40 font-bold">Description (affichée dans la réservation)</label>
                    <textarea
                      value={service.description || ''}
                      onChange={(e) => handleServiceChange(index, 'description', e.target.value)}
                      placeholder="Ex. Rasoir traditionnel, serviette chaude"
                      rows={2}
                      className="w-full bg-dark/5 rounded-lg px-3 py-2 text-xs outline-none focus:bg-gold/10 resize-none"
                    />
                  </div>
                </div>
              ))}
              <button 
                onClick={saveServices}
                className="w-full btn-primary py-3 rounded-[3px] text-sm font-bold shadow-sm"
              >
                Enregistrer les services
              </button>
            </div>
          </div>

          <div className="glass-card rounded-[4px] p-8">
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

        {/* Main Calendar View */}
        <div className="lg:col-span-8 space-y-8">
          <GalleryManager />
          
          <div className="glass-card rounded-[4px] p-4 md:p-8 admin-calendar">
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

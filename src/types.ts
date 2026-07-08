// Types partagés de l'application Chez Tom

export interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  category_id?: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  display_order: number;
}

export interface Notification {
  id: number;
  reservation_id: string;
  customer: string;
  service: string;
  date: string;
  time: string;
  created_at: string;
  is_read: number;
}

export interface Booking {
  id: number;
  customer_name: string;
  customer_email: string;
  service_type: string;
  start_time: string;
  end_time: string;
}

export interface GalleryImage {
  id: number;
  url: string;
  caption: string;
  created_at: string;
}

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
  has_break?: boolean;
  break_start?: string;
  break_end?: string;
}

export interface AppSettings {
  show_gallery: string;
  show_about: string;
  admin_password?: string;
  opening_hours?: string; // JSON string
  google_calendar_id?: string;
  notification_email?: string;
}

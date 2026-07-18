import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { Resend } from "resend";
import axios from "axios";
import { Server } from "socket.io";
import http from "http";
import crypto from "crypto";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("chez-tom.db");
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    service_type TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed',
    google_event_id TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS google_tokens (
    id INTEGER PRIMARY KEY DEFAULT 1,
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id TEXT,
    customer TEXT,
    service TEXT,
    date TEXT,
    time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('show_gallery', 'true');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('show_about', 'true');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password', 'admin123');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('opening_hours', '{"monday":{"open":"09:00","close":"19:00","closed":false},"tuesday":{"open":"09:00","close":"19:00","closed":false},"wednesday":{"open":"09:00","close":"19:00","closed":false},"thursday":{"open":"09:00","close":"19:00","closed":false},"friday":{"open":"09:00","close":"19:00","closed":false},"saturday":{"open":"09:00","close":"18:00","closed":false},"sunday":{"open":"09:00","close":"12:00","closed":true}}');

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    duration INTEGER NOT NULL,
    category_id TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    summary TEXT NOT NULL DEFAULT 'Indisponibilité',
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    google_event_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default categories and services if empty
const categoriesCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
if (categoriesCount.count === 0) {
  const insertCat = db.prepare("INSERT INTO categories (id, name, display_order) VALUES (?, ?, ?)");
  insertCat.run("adultes", "Adultes", 0);
  insertCat.run("ados", "Ados", 1);
  insertCat.run("enfants", "Enfants", 2);
}

const servicesCount = db.prepare("SELECT COUNT(*) as count FROM services").get() as { count: number };
if (servicesCount.count === 0) {
  const insert = db.prepare("INSERT INTO services (id, name, price, duration, category_id, description) VALUES (?, ?, ?, ?, ?, ?)");
  insert.run("coupe-homme", "Coupe Homme", 20, 30, "adultes", "Shampoing, coupe aux ciseaux ou à la tondeuse, coiffage");
  insert.run("coupe-barbe", "Coupe + Barbe", 30, 45, "adultes", "Coupe complète et taille de barbe au rasoir");
  insert.run("barbe", "Taille de barbe", 15, 20, "adultes", "Rasoir traditionnel et serviette chaude");
  insert.run("rituel", "Rituel signature", 55, 75, "adultes", "Coupe, barbe, soin du visage et massage crânien");
  insert.run("coupe-enfant", "Coupe Enfant (-12 ans)", 15, 20, "enfants", "Coupe adaptée, en douceur");
}

// Migration: Add category_id column if it doesn't exist
try {
  db.prepare("ALTER TABLE services ADD COLUMN category_id TEXT").run();
} catch (e) {
  // Column already exists or other error
}

// Migration: Add google_event_id column if it doesn't exist
try {
  db.prepare("ALTER TABLE bookings ADD COLUMN google_event_id TEXT").run();
} catch (e) {
  // Column already exists or other error
}

// Migration: Add customer_phone column if it doesn't exist
try {
  db.prepare("ALTER TABLE bookings ADD COLUMN customer_phone TEXT").run();
} catch (e) {
  // Column already exists or other error
}

// Migration: Add description column to services if it doesn't exist
try {
  db.prepare("ALTER TABLE services ADD COLUMN description TEXT").run();
} catch (e) {
  // Column already exists or other error
}

// ---------------------------------------------------------------------------
// Sécurité admin : hash du mot de passe + tokens de session + rate limiting
// ---------------------------------------------------------------------------

const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
};

const verifyPassword = (password: string, stored: string | undefined) => {
  if (!password || !stored || !stored.startsWith("scrypt:")) return false;
  const [, salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
};

// Migration : si le mot de passe admin est encore en clair, on le hashe.
{
  const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string } | undefined;
  if (row && !row.value.startsWith("scrypt:")) {
    db.prepare("UPDATE settings SET value = ? WHERE key = 'admin_password'").run(hashPassword(row.value));
    console.log("[sécurité] Mot de passe admin hashé (scrypt).");
  }
}

// Tokens de session admin, en mémoire (invalidés au redémarrage).
const ADMIN_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 h
const adminTokens = new Map<string, number>();

const createAdminToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL);
  return token;
};

const isValidAdminToken = (token: string | undefined) => {
  if (!token) return false;
  const expiry = adminTokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    adminTokens.delete(token);
    return false;
  }
  return true;
};

const bearerToken = (header: string | undefined) =>
  header?.startsWith("Bearer ") ? header.slice(7) : undefined;

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!isValidAdminToken(bearerToken(req.headers.authorization))) {
    return res.status(401).json({ error: "Non autorisé" });
  }
  next();
};

// Rate limiting simple en mémoire (par IP).
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const rateLimit = (bucket: string, maxAttempts: number, windowMs: number) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const entry = rateBuckets.get(key);
    if (!entry || now > entry.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > maxAttempts) {
      return res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
    }
    next();
  };

async function getGoogleAccessToken() {
  const token = db.prepare("SELECT * FROM google_tokens WHERE id = 1").get() as any;
  if (!token || !token.refresh_token) return null;

  // If token is expired or about to expire (within 5 mins)
  if (Date.now() > (token.expiry_date - 300000)) {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
      });

      const { access_token, expires_in } = response.data;
      const expiry_date = Date.now() + expires_in * 1000;

      db.prepare("UPDATE google_tokens SET access_token = ?, expiry_date = ? WHERE id = 1")
        .run(access_token, expiry_date);

      return access_token;
    } catch (error) {
      console.error("Error refreshing Google token:", error);
      return null;
    }
  }

  return token.access_token;
}

// Cache court des plages occupées Google (évite un appel par clic sur une date).
const googleBusyCache = new Map<string, { ranges: Array<{ s: number; e: number }>; expiry: number }>();
const GOOGLE_BUSY_TTL = 30 * 1000;

/**
 * Renvoie les plages occupées (en minutes depuis minuit, heure de Paris) issues de
 * l'agenda Google configuré, pour une date donnée. Tous les événements comptent comme
 * occupés, sauf ceux marqués « Disponible » (transparency) ou annulés. Peut lever une
 * exception (réseau/Google) : l'appelant retombe alors sur le calcul local.
 */
async function getGoogleBusyRanges(date: string): Promise<Array<{ s: number; e: number }>> {
  const token = await getGoogleAccessToken();
  if (!token) return [];

  const calSetting = db.prepare("SELECT value FROM settings WHERE key = 'google_calendar_id'").get() as { value: string } | undefined;
  const calendarId = (calSetting?.value || 'primary').trim();
  const cacheKey = `${calendarId}:${date}`;
  const cached = googleBusyCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return cached.ranges;

  // Heure murale (Paris) → minutes depuis minuit, lue directement dans la chaîne RFC3339.
  const toMin = (dt: string) => parseInt(dt.slice(11, 13), 10) * 60 + parseInt(dt.slice(14, 16), 10);

  const resp = await axios.get(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      params: {
        timeMin: new Date(`${date}T00:00:00`).toISOString(),
        timeMax: new Date(`${date}T23:59:59`).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: 'Europe/Paris',
      },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 4000,
    }
  );

  const ranges: Array<{ s: number; e: number }> = [];
  for (const ev of resp.data.items || []) {
    if (ev.status === 'cancelled' || ev.transparency === 'transparent') continue;
    if (ev.start?.date) {
      // Événement « journée entière » couvrant ce jour → toute la journée occupée.
      if (ev.start.date <= date && (!ev.end?.date || ev.end.date > date)) {
        ranges.push({ s: 0, e: 24 * 60 });
      }
    } else if (ev.start?.dateTime && ev.end?.dateTime) {
      const s = ev.start.dateTime.startsWith(date) ? toMin(ev.start.dateTime) : 0;
      const e = ev.end.dateTime.startsWith(date) ? toMin(ev.end.dateTime) : 24 * 60;
      if (e > s) ranges.push({ s, e });
    }
  }

  googleBusyCache.set(cacheKey, { ranges, expiry: Date.now() + GOOGLE_BUSY_TTL });
  return ranges;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ limit: '5mb', extended: true }));

  // Les notifications temps réel contiennent des données clients :
  // seul un admin authentifié peut se connecter au socket.
  io.use((socket, next) => {
    if (isValidAdminToken(socket.handshake.auth?.token)) return next();
    next(new Error("Non autorisé"));
  });

  io.on("connection", () => {
    console.log("Admin connecté au socket");
  });

  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // --- Authentification admin ---
  app.post("/api/admin/login", rateLimit("login", 5, 15 * 60 * 1000), (req, res) => {
    const { password } = req.body ?? {};
    const stored = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string } | undefined;
    if (typeof password !== "string" || !verifyPassword(password, stored?.value)) {
      return res.status(401).json({ error: "Mot de passe incorrect" });
    }
    res.json({ token: createAdminToken() });
  });

  app.post("/api/admin/logout", (req, res) => {
    const token = bearerToken(req.headers.authorization);
    if (token) adminTokens.delete(token);
    res.json({ success: true });
  });

  // Permet au front de vérifier qu'un token stocké est encore valide.
  app.get("/api/admin/me", requireAdmin, (req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/services", (req, res) => {
    const services = db.prepare("SELECT * FROM services").all();
    res.json(services);
  });

  app.post("/api/services", requireAdmin, (req, res) => {
    const services = req.body as any[];
    if (!Array.isArray(services)) return res.status(400).json({ error: "Invalid data" });

    try {
      const deleteStmt = db.prepare("DELETE FROM services");
      const insertStmt = db.prepare("INSERT INTO services (id, name, price, duration, category_id, description) VALUES (?, ?, ?, ?, ?, ?)");

      const transaction = db.transaction((data) => {
        deleteStmt.run();
        for (const s of data) {
          insertStmt.run(s.id || Math.random().toString(36).substr(2, 9), s.name, s.price, s.duration, s.category_id, s.description || null);
        }
      });

      transaction(services);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating services:", error);
      res.status(500).json({ error: "Failed to update services" });
    }
  });

  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories ORDER BY display_order ASC").all();
    res.json(categories);
  });

  app.post("/api/categories", requireAdmin, (req, res) => {
    const categories = req.body as any[];
    if (!Array.isArray(categories)) return res.status(400).json({ error: "Invalid data" });

    try {
      const deleteStmt = db.prepare("DELETE FROM categories");
      const insertStmt = db.prepare("INSERT INTO categories (id, name, display_order) VALUES (?, ?, ?)");
      
      const transaction = db.transaction((data) => {
        deleteStmt.run();
        for (let i = 0; i < data.length; i++) {
          const c = data[i];
          insertStmt.run(c.id || Math.random().toString(36).substr(2, 9), c.name, i);
        }
      });

      transaction(categories);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating categories:", error);
      res.status(500).json({ error: "Failed to update categories" });
    }
  });

  // Données clients : réservé à l'admin.
  app.get("/api/bookings", requireAdmin, (req, res) => {
    const date = req.query.date as string;
    if (!date) return res.status(400).json({ error: "Date is required" });
    
    const bookings = db.prepare("SELECT * FROM bookings WHERE start_time LIKE ?").all(`${date}%`);
    res.json(bookings);
  });

  app.post("/api/bookings", rateLimit("booking", 5, 10 * 60 * 1000), async (req, res) => {
    try {
    const { customer_name, customer_email, customer_phone, service_type, start_time, end_time } = req.body;

    // Validation serveur (le front valide déjà, mais l'API est publique).
    const isStr = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
    if (!isStr(customer_name, 100) || !isStr(service_type, 100)) {
      return res.status(400).json({ error: "Nom ou prestation invalide." });
    }
    if (!isStr(customer_email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
      return res.status(400).json({ error: "Adresse e-mail invalide." });
    }
    if (customer_phone !== undefined && customer_phone !== null && (typeof customer_phone !== "string" || customer_phone.length > 30)) {
      return res.status(400).json({ error: "Numéro de téléphone invalide." });
    }
    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      return res.status(400).json({ error: "Créneau invalide." });
    }
    if (endDate.getTime() - startDate.getTime() > 8 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "Durée de créneau invalide." });
    }
    if (startDate.getTime() < Date.now() - 60 * 60 * 1000) {
      return res.status(400).json({ error: "Ce créneau est déjà passé." });
    }

    const googleAccessToken = await getGoogleAccessToken();
    
    // 1. Local availability check (Safety net)
    const localOverlap = db.prepare(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE (start_time < ? AND end_time > ?)
      AND status = 'confirmed'
      ${googleAccessToken ? "AND google_event_id IS NULL" : ""}
    `).get(end_time, start_time) as { count: number };

    if (localOverlap.count > 0) {
      return res.status(400).json({ error: "Ce créneau est déjà réservé sur le site." });
    }

    // 2. Google Calendar Integration is now handled by n8n to avoid duplicates and disconnections
    let googleEventId = null;
    let googleCalendarError = null;

    // 3. Save locally (Always, as a backup)
    const stmt = db.prepare(`
      INSERT INTO bookings (customer_name, customer_email, customer_phone, service_type, start_time, end_time, google_event_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(customer_name, customer_email, customer_phone || null, service_type, start_time, end_time, googleEventId);
    const localId = result.lastInsertRowid;

    // 4. Send Confirmation Email & Webhook (Non-blocking)
    (async () => {
      try {
        const dateStr = new Date(start_time).toLocaleDateString('fr-FR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        const timeStr = new Date(start_time).toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        // 1. Email to Customer (if Resend is configured)
        if (resend) {
          try {
            const svc = db.prepare("SELECT description FROM services WHERE name = ?").get(service_type) as { description?: string } | undefined;
            const descLine = svc?.description
              ? `<p style="margin: 5px 0; color:#6E6A63;">${svc.description}</p>`
              : '';
            await resend.emails.send({
              from: 'Chez Tom <onboarding@resend.dev>',
              to: customer_email,
              subject: 'Confirmation de votre rendez-vous - Chez Tom',
              html: `
                <div style="font-family: Georgia, serif; color: #1A1A1A; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2DACB;">
                  <h1 style="text-align: center; color: #A8884A; letter-spacing: 0.2em; font-weight: 400;">CHEZ TOM</h1>
                  <p>Bonjour <strong>${customer_name}</strong>,</p>
                  <p>Votre rendez-vous est confirmé. Nous avons hâte de vous accueillir.</p>
                  <div style="background-color: #F5F1EA; padding: 18px; margin: 20px 0; border-left: 3px solid #C8A968;">
                    <p style="margin: 5px 0;"><strong>Prestation :</strong> ${service_type}</p>
                    ${descLine}
                    <p style="margin: 5px 0;"><strong>Date :</strong> ${dateStr}</p>
                    <p style="margin: 5px 0;"><strong>Heure :</strong> ${timeStr}</p>
                  </div>
                  <p style="font-size: 14px; color: #6E6A63;">Adresse : 123 Rue de l'Élégance, 75001 Paris</p>
                  <p style="font-size: 14px; color: #6E6A63;">Téléphone : 01 23 45 67 89</p>
                  <hr style="border: 0; border-top: 1px solid #E2DACB; margin: 20px 0;" />
                  <p style="text-align: center; font-size: 12px; color: #8A857C;">&copy; ${new Date().getFullYear()} Chez Tom. Tous droits réservés.</p>
                </div>
              `
            });
          } catch (emailErr) {
            console.error("Email error:", emailErr);
          }
        }

        // 2. Webhooks n8n (non bloquants)
        const webhookUrl = "https://n8n.srv1043923.hstgr.cloud/webhook/reservation-chez-tom";
        const telegramNotifyUrl = "https://n8n.srv1043923.hstgr.cloud/webhook/notification-telegram";
        let reservationId = `TOM-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 10000)}`;

        // Fetch service details
        const service = db.prepare("SELECT duration, price FROM services WHERE name = ?").get(service_type) as { duration: number, price: number } | undefined;
        const duration = service?.duration || 30;
        const price = service?.price || 0;

        const webhookPayload = {
          event: 'booking.created',
          data: {
            customer_name,
            customer_email,
            customer_phone,
            service_type,
            duration,
            price,
            start_time,
            end_time,
            formatted_date: dateStr,
            formatted_time: timeStr
          }
        };

        // Notification Telegram du gérant — fire-and-forget :
        // tant que le workflow n8n est inactif, l'appel échoue silencieusement.
        axios.post(telegramNotifyUrl, webhookPayload, { timeout: 5000 }).catch((err) => {
          console.log(`Notification Telegram non délivrée (workflow inactif ?): ${err.response?.status || err.message}`);
        });

        try {
          const webhookResponse = await axios.post(webhookUrl, webhookPayload);

          if (webhookResponse.data && webhookResponse.data.success) {
            if (webhookResponse.data.reservation_id) reservationId = webhookResponse.data.reservation_id;
            
            // If n8n returns a google_event_id, update the local booking
            if (webhookResponse.data.google_event_id) {
              db.prepare("UPDATE bookings SET google_event_id = ? WHERE id = ?").run(webhookResponse.data.google_event_id, localId);
            }
          }
        } catch (webhookErr) {
          console.error("Webhook error:", webhookErr);
        }

        // Always create notification
        try {
          const notifStmt = db.prepare(`
            INSERT INTO notifications (reservation_id, customer, service, date, time)
            VALUES (?, ?, ?, ?, ?)
          `);
          const result = notifStmt.run(reservationId, customer_name, service_type, dateStr, timeStr);
          
          const newNotif = {
            id: result.lastInsertRowid,
            reservation_id: reservationId,
            customer: customer_name,
            service: service_type,
            date: dateStr,
            time: timeStr,
            created_at: new Date().toISOString(),
            is_read: 0
          };

          io.emit("notification", newNotif);
        } catch (notifErr) {
          console.error("Error creating notification:", notifErr);
        }
      } catch (err) {
        console.error("Secondary tasks error:", err);
      }
    })();

    res.status(201).json({ 
      success: true, 
      googleCalendarError: googleCalendarError 
    });
    } catch (err: any) {
      console.error("Erreur lors de la réservation:", err.response?.data || err.message);
      res.status(500).json({ error: "Une erreur est survenue lors de la réservation." });
    }
  });

  // --- Disponibilité (source de vérité : SQLite, pas de dépendance Google/n8n) ---
  app.get("/api/availability", async (req, res) => {
    const date = String(req.query.date || "");
    const duration = Number(req.query.duration);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(duration) || duration <= 0 || duration > 480) {
      return res.status(400).json({ error: "Paramètres invalides" });
    }

    const hoursRow = db.prepare("SELECT value FROM settings WHERE key = 'opening_hours'").get() as { value: string } | undefined;
    let openingHours: Record<string, any> = {};
    try { openingHours = hoursRow ? JSON.parse(hoursRow.value) : {}; } catch { /* horaires illisibles → jour fermé */ }

    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const [y, m, d] = date.split("-").map(Number);
    const hours = openingHours[dayNames[new Date(y, m - 1, d).getDay()]];
    if (!hours || hours.closed) return res.json({ slots: [] });

    const toMin = (t: string) => { const [h, mn] = t.split(":").map(Number); return h * 60 + mn; };
    const open = toMin(hours.open || "09:00");
    const close = toMin(hours.close || "19:00");
    const breakStart = hours.has_break ? toMin(hours.break_start || "12:00") : null;
    const breakEnd = hours.has_break ? toMin(hours.break_end || "14:00") : null;

    // Plages occupées du jour : réservations confirmées + indisponibilités locales.
    const busy: Array<{ s: number; e: number }> = [];
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    const rows = [
      ...db.prepare("SELECT start_time, end_time FROM bookings WHERE status = 'confirmed' AND start_time < ? AND end_time > ?").all(dayEnd, dayStart) as any[],
      ...db.prepare("SELECT start_time, end_time FROM blocks WHERE start_time < ? AND end_time > ?").all(dayEnd, dayStart) as any[],
    ];
    for (const r of rows) {
      const s = new Date(r.start_time); const e = new Date(r.end_time);
      const sMin = r.start_time.startsWith(date) ? s.getHours() * 60 + s.getMinutes() : 0;
      const eMin = r.end_time.startsWith(date) ? e.getHours() * 60 + e.getMinutes() : 24 * 60;
      busy.push({ s: sMin, e: eMin });
    }

    // + événements de l'agenda Google du gérant (synchro dans le sens Google → site).
    // Si Google est injoignable, on continue avec le calcul local (jamais bloquant).
    try {
      const googleBusy = await getGoogleBusyRanges(date);
      busy.push(...googleBusy);
    } catch (err: any) {
      console.log(`Disponibilité : agenda Google injoignable, calcul local seul (${err.response?.status || err.message})`);
    }

    const slots: string[] = [];
    for (let t = open; t + duration <= close; t += 30) {
      const tEnd = t + duration;
      if (breakStart !== null && breakEnd !== null && t < breakEnd && tEnd > breakStart) continue;
      if (busy.some((b) => t < b.e && tEnd > b.s)) continue;
      slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    }
    res.json({ slots });
  });

  // --- Indisponibilités (locales ; miroir Google optionnel, non bloquant) ---
  app.post("/api/blocks", requireAdmin, async (req, res) => {
    const { summary, start, end } = req.body ?? {};
    const s = new Date(start); const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
      return res.status(400).json({ error: "Plage horaire invalide" });
    }
    const label = typeof summary === "string" && summary.trim() ? summary.trim().slice(0, 100) : "Indisponibilité";
    const info = db.prepare("INSERT INTO blocks (summary, start_time, end_time) VALUES (?, ?, ?)").run(label, start, end);
    const blockId = info.lastInsertRowid;

    // Miroir Google, si connecté — l'échec n'empêche pas l'indisponibilité locale.
    try {
      const token = await getGoogleAccessToken();
      if (token) {
        const calSetting = db.prepare("SELECT value FROM settings WHERE key = 'google_calendar_id'").get() as { value: string } | undefined;
        const calendarId = (calSetting?.value || "primary").trim();
        const response = await axios.post(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            summary: label,
            start: { dateTime: start.split(".")[0].replace("Z", ""), timeZone: "Europe/Paris" },
            end: { dateTime: end.split(".")[0].replace("Z", ""), timeZone: "Europe/Paris" },
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        db.prepare("UPDATE blocks SET google_event_id = ? WHERE id = ?").run(response.data.id, blockId);
      }
    } catch (err: any) {
      console.error("Miroir Google de l'indisponibilité impossible:", err.response?.data || err.message);
    }

    res.status(201).json({ id: blockId, summary: label, start_time: start, end_time: end });
  });

  app.delete("/api/blocks/:id", requireAdmin, async (req, res) => {
    const block = db.prepare("SELECT * FROM blocks WHERE id = ?").get(req.params.id) as any;
    if (!block) return res.status(404).json({ error: "Indisponibilité introuvable" });
    db.prepare("DELETE FROM blocks WHERE id = ?").run(block.id);

    if (block.google_event_id) {
      try {
        const token = await getGoogleAccessToken();
        if (token) {
          const calSetting = db.prepare("SELECT value FROM settings WHERE key = 'google_calendar_id'").get() as { value: string } | undefined;
          const calendarId = (calSetting?.value || "primary").trim();
          await axios.delete(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(block.google_event_id)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch (err: any) {
        console.error("Suppression du miroir Google impossible:", err.response?.data || err.message);
      }
    }
    res.json({ success: true });
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsMap = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    // Jamais de secret côté public.
    delete settingsMap.admin_password;
    res.json(settingsMap);
  });

  app.post("/api/settings", requireAdmin, (req, res) => {
    const { key, value } = req.body;
    if (typeof key !== "string" || value === undefined || value === null) {
      return res.status(400).json({ error: "Paramètres invalides" });
    }
    let stored = value.toString();
    if (key === "admin_password") {
      if (stored.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères." });
      }
      stored = hashPassword(stored);
    }
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, stored);
    res.json({ success: true });
  });

  // Notifications API
  app.get("/api/notifications", requireAdmin, (req, res) => {
    const notifications = db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50").all();
    res.json(notifications);
  });

  app.post("/api/notifications/read-all", requireAdmin, (req, res) => {
    db.prepare("UPDATE notifications SET is_read = 1").run();
    res.json({ success: true });
  });

  app.post("/api/notifications/:id/read", requireAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Fetch Google Calendar List
  app.get("/api/google/calendars", requireAdmin, async (req, res) => {
    const googleAccessToken = await getGoogleAccessToken();
    if (!googleAccessToken) {
      return res.status(401).json({ error: "Google Calendar non connecté" });
    }

    try {
      const response = await axios.get(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        }
      );
      res.json(response.data.items);
    } catch (error: any) {
      console.error("Error fetching calendar list:", error.response?.data || error.message);
      res.status(500).json({ error: "Erreur lors de la récupération de la liste des agendas" });
    }
  });

  // Fetch Google Calendar Events
  app.get("/api/google/events", requireAdmin, async (req, res) => {
    const { start, end } = req.query as { start: string, end: string };
    const googleAccessToken = await getGoogleAccessToken();
    
    const localStart = start?.replace('Z', '');
    const localEnd = end?.replace('Z', '');

    let events: any[] = [];

    // 1. Fetch from Google if possible
    if (googleAccessToken) {
      const calendarIdSetting = db.prepare("SELECT value FROM settings WHERE key = 'google_calendar_id'").get() as { value: string } | undefined;
      const calendarId = calendarIdSetting?.value || 'primary';

      try {
        const googleEventsResponse = await axios.get(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            params: {
              timeMin: start,
              timeMax: end,
              singleEvents: true,
              orderBy: 'startTime',
            },
            headers: { Authorization: `Bearer ${googleAccessToken}` }
          }
        );
        events = googleEventsResponse.data.items || [];
      } catch (error: any) {
        console.error("Error fetching Google events:", error.message);
      }
    }

    // 2. Fetch local bookings
    const localBookings = db.prepare(`
      SELECT id, customer_name as summary, service_type as description, start_time as start, end_time as end, google_event_id
      FROM bookings 
      WHERE start_time >= ? AND start_time <= ?
      AND status = 'confirmed'
    `).all(localStart, localEnd) as any[];

    const googleEventIds = new Set(events.map(e => e.id));
    
    const formattedLocal = localBookings
      .filter(b => !b.google_event_id || !googleEventIds.has(b.google_event_id))
      .map(b => ({
        id: `local-${b.id}`,
        summary: `${b.summary} (${b.description})`,
        description: `Réservation site: ${b.description}`,
        start: { dateTime: b.start },
        end: { dateTime: b.end },
        isLocal: true,
        isOrphaned: !!b.google_event_id // Mark as orphaned if it had a Google ID but wasn't found
      }));

    // 3. Indisponibilités locales (celles déjà miroitées sur Google sont dédupliquées)
    const localBlocks = db.prepare(`
      SELECT id, summary, start_time, end_time, google_event_id
      FROM blocks
      WHERE start_time >= ? AND start_time <= ?
    `).all(localStart, localEnd) as any[];

    const formattedBlocks = localBlocks
      .filter(b => !b.google_event_id || !googleEventIds.has(b.google_event_id))
      .map(b => ({
        id: `block-${b.id}`,
        summary: b.summary,
        description: "Indisponibilité",
        start: { dateTime: b.start_time },
        end: { dateTime: b.end_time },
        isLocal: true,
        isUnavailability: true
      }));

    res.json([...events, ...formattedLocal, ...formattedBlocks]);
  });

  app.post("/api/google/events", requireAdmin, async (req, res) => {
    const { summary, start, end } = req.body;
    const googleAccessToken = await getGoogleAccessToken();
    
    if (!googleAccessToken) {
      return res.status(401).json({ error: "Google Calendar non connecté" });
    }

    const calendarIdSetting = db.prepare("SELECT value FROM settings WHERE key = 'google_calendar_id'").get() as { value: string } | undefined;
    const calendarId = (calendarIdSetting?.value || 'primary').trim();

    const cleanStart = start.split('.')[0].replace('Z', '').split('+')[0];
    const cleanEnd = end.split('.')[0].replace('Z', '').split('+')[0];

    try {
      const response = await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          summary: summary || "Indisponibilité",
          start: { 
            dateTime: cleanStart,
            timeZone: 'Europe/Paris' 
          },
          end: { 
            dateTime: cleanEnd,
            timeZone: 'Europe/Paris' 
          },
        },
        {
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error("Error creating Google event:", error.response?.data || error.message);
      res.status(500).json({ error: "Erreur lors de la création de l'événement" });
    }
  });

  app.delete("/api/google/events/:id", requireAdmin, async (req, res) => {
    const { id } = req.params;
    console.log(`Tentative de suppression de l'événement: ${id}`);
    
    // Réservation locale → annulation (libère le créneau)
    if (id.startsWith('local-')) {
      const localId = id.replace('local-', '');
      db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(localId);
      return res.json({ success: true });
    }

    // Indisponibilité locale → suppression (+ miroir Google via /api/blocks)
    if (id.startsWith('block-')) {
      const blockId = id.replace('block-', '');
      const block = db.prepare("SELECT * FROM blocks WHERE id = ?").get(blockId) as any;
      if (block) {
        db.prepare("DELETE FROM blocks WHERE id = ?").run(blockId);
        if (block.google_event_id) {
          try {
            const token = await getGoogleAccessToken();
            if (token) {
              const calSetting = db.prepare("SELECT value FROM settings WHERE key = 'google_calendar_id'").get() as { value: string } | undefined;
              await axios.delete(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent((calSetting?.value || 'primary').trim())}/events/${encodeURIComponent(block.google_event_id)}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
            }
          } catch (err: any) {
            console.error("Suppression du miroir Google impossible:", err.response?.data || err.message);
          }
        }
      }
      return res.json({ success: true });
    }

    const googleAccessToken = await getGoogleAccessToken();
    if (!googleAccessToken) {
      return res.status(401).json({ error: "Google Calendar non connecté" });
    }

    const calendarIdSetting = db.prepare("SELECT value FROM settings WHERE key = 'google_calendar_id'").get() as { value: string } | undefined;
    const calendarId = calendarIdSetting?.value || 'primary';

    try {
      await axios.delete(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        }
      );
      
      // Update local DB only if it exists (for backward compatibility)
      db.prepare("UPDATE bookings SET status = 'cancelled' WHERE google_event_id = ?").run(id);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting event:", error.response?.data || error.message);
      // If event not found on Google, still return success to clear UI
      if (error.response?.status === 404 || error.response?.status === 410) {
        db.prepare("UPDATE bookings SET status = 'cancelled' WHERE google_event_id = ?").run(id);
        return res.json({ success: true });
      }
      res.status(500).json({ error: "Erreur lors de la suppression de l'événement" });
    }
  });

  // Bulk Sync Local Bookings to Google
  app.post("/api/google/sync", requireAdmin, async (req, res) => {
    const googleAccessToken = await getGoogleAccessToken();
    if (!googleAccessToken) {
      return res.status(401).json({ error: "Google Calendar non connecté" });
    }

    const calendarIdSetting = db.prepare("SELECT value FROM settings WHERE key = 'google_calendar_id'").get() as { value: string } | undefined;
    const calendarId = (calendarIdSetting?.value || 'primary').trim();

    const unsyncedBookings = db.prepare(`
      SELECT * FROM bookings 
      WHERE google_event_id IS NULL 
      AND status = 'confirmed'
    `).all() as any[];

    let syncedCount = 0;
    let errorCount = 0;

    for (const booking of unsyncedBookings) {
      const cleanStart = booking.start_time.split('.')[0].replace('Z', '').split('+')[0];
      const cleanEnd = booking.end_time.split('.')[0].replace('Z', '').split('+')[0];
      try {
        const googleResponse = await axios.post(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            summary: `${booking.customer_name} (${booking.service_type})`,
            description: `Réservation via le site Chez Tom. Client: ${booking.customer_name} (${booking.customer_email})`,
            start: { 
              dateTime: cleanStart,
              timeZone: 'Europe/Paris' 
            },
            end: { 
              dateTime: cleanEnd,
              timeZone: 'Europe/Paris' 
            },
          },
          {
            headers: { Authorization: `Bearer ${googleAccessToken}` }
          }
        );

        db.prepare("UPDATE bookings SET google_event_id = ? WHERE id = ?")
          .run(googleResponse.data.id, booking.id);
        
        syncedCount++;
      } catch (err: any) {
        console.error(`Error syncing booking ${booking.id}:`, err.message);
        errorCount++;
      }
    }

    res.json({ 
      success: true, 
      syncedCount, 
      errorCount,
      total: unsyncedBookings.length 
    });
  });

  // Google OAuth URL Generation
  app.get("/api/auth/google/url", requireAdmin, (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.APP_URL?.replace(/\/$/, ""); // Remove trailing slash

    if (!clientId || !appUrl) {
      return res.status(500).json({ 
        error: "Configuration manquante. Renseignez GOOGLE_CLIENT_ID et APP_URL dans le fichier .env."
      });
    }

    const redirectUri = `${appUrl}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
      access_type: "offline",
      prompt: "consent"
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  // Google OAuth Callback
  app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.APP_URL?.replace(/\/$/, ""); // Remove trailing slash

    if (code && clientId && clientSecret && appUrl) {
      try {
        console.log(`Tentative d'échange de code avec ClientID: ${clientId.substring(0, 5)}...${clientId.substring(clientId.length - 5)}`);
        
        const params = new URLSearchParams();
        params.append('code', code as string);
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
        params.append('redirect_uri', `${appUrl}/auth/google/callback`);
        params.append('grant_type', 'authorization_code');

        const response = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, refresh_token, expires_in } = response.data;
        const expiry_date = Date.now() + expires_in * 1000;

        // Only update refresh_token if it's provided (Google only sends it on first consent)
        if (refresh_token) {
          db.prepare(`
            INSERT OR REPLACE INTO google_tokens (id, access_token, refresh_token, expiry_date)
            VALUES (1, ?, ?, ?)
          `).run(access_token, refresh_token, expiry_date);
        } else {
          db.prepare(`
            UPDATE google_tokens SET access_token = ?, expiry_date = ? WHERE id = 1
          `).run(access_token, expiry_date);
        }

      } catch (error: any) {
        console.error("Error exchanging Google code for tokens:", error.response?.data || error.message);
      }
    }

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/admin';
            }
          </script>
          <p>Connexion Google réussie. Cette fenêtre va se fermer.</p>
        </body>
      </html>
    `);
  });

  // --- Gallery Routes ---
  app.get("/api/gallery", (req, res) => {
    try {
      const images = db.prepare("SELECT * FROM gallery ORDER BY created_at DESC").all();
      res.json(images);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch gallery images" });
    }
  });

  app.post("/api/gallery", requireAdmin, (req, res) => {
    const { url, caption } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const stmt = db.prepare("INSERT INTO gallery (url, caption) VALUES (?, ?)");
      const info = stmt.run(url, caption || "");
      res.json({ id: info.lastInsertRowid, url, caption });
    } catch (error) {
      res.status(500).json({ error: "Failed to add image to gallery" });
    }
  });

  app.delete("/api/gallery/:id", requireAdmin, (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM gallery WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete image from gallery" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicitly serve index.html in dev mode if vite.middlewares doesn't catch it
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        console.error("Vite transform error:", e);
        next(e);
      }
    });
    console.log("Vite middleware integrated successfully.");
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  console.log(`Attempting to start server on port ${PORT}...`);
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is successfully listening on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

console.log("Starting server initialization...");
startServer().catch(err => {
  console.error("Failed to start server:", err);
});

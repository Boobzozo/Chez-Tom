/**
 * Tests de fumée de l'API (`npm test`).
 *
 * Le serveur est lancé tel quel dans un processus enfant, en mode test :
 * base SQLite temporaire, aucun webhook n8n, aucun email, aucun accès Google,
 * pas de rate limiting. On vérifie ce que le tunnel de réservation ne peut pas
 * garantir tout seul : un créneau hors horaires, bloqué, déjà pris ou dans le
 * passé est refusé quoi qu'envoie le client.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3900 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const DEFAULT_PASSWORD = "admin123";

let server: ChildProcess;
let tmpDir: string;
let adminToken = "";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Un lundi (jour ouvert par défaut) au moins 7 jours dans le futur, et le dimanche qui le précède.
const nextMonday = new Date();
nextMonday.setDate(nextMonday.getDate() + 7);
while (nextMonday.getDay() !== 1) nextMonday.setDate(nextMonday.getDate() + 1);
const MONDAY = localDate(nextMonday);
const SUNDAY = localDate(new Date(nextMonday.getTime() - 24 * 60 * 60 * 1000));

const api = async (method: string, url: string, body?: unknown, token?: string) => {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const book = (overrides: Record<string, unknown> = {}) =>
  api("POST", "/api/bookings", {
    customer_name: "Client Test",
    customer_email: "client@example.com",
    customer_phone: "+33600000000",
    service_id: "coupe-homme", // 30 min par défaut
    start_time: `${MONDAY}T10:00:00`,
    sms_opt_in: true,
    ...overrides,
  });

before(async () => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "tom-barber-test-"));
  server = spawn(process.execPath, [path.join(ROOT, "node_modules", ".bin", "tsx"), "server.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(PORT),
      DB_PATH: path.join(tmpDir, "test.db"),
      TZ: "Europe/Paris",
      RESEND_API_KEY: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_CALENDAR_ID: "",
      N8N_BOOKING_WEBHOOK_URL: "",
      N8N_TELEGRAM_WEBHOOK_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  server.stdout?.on("data", (c) => { logs += c; });
  server.stderr?.on("data", (c) => { logs += c; });

  // Attente du démarrage (jusqu'à 60 s : les machines chargées sont lentes).
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Le serveur n'a pas démarré.\n${logs}`);
});

after(() => {
  server?.kill();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

test("santé : le serveur répond", async () => {
  const { status, data } = await api("GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(data.status, "ok");
});

test("disponibilité : un lundi propose des créneaux, un dimanche aucun", async () => {
  const monday = await api("GET", `/api/availability?date=${MONDAY}&duration=30`);
  assert.equal(monday.status, 200);
  assert.ok(monday.data.slots.includes("09:00"), "09:00 attendu");
  assert.ok(monday.data.slots.includes("18:30"), "18:30 attendu (fermeture 19:00)");
  assert.ok(!monday.data.slots.includes("19:00"), "19:00 ne doit pas être proposé");

  const sunday = await api("GET", `/api/availability?date=${SUNDAY}&duration=30`);
  assert.deepEqual(sunday.data.slots, []);
});

test("disponibilité : paramètres invalides refusés", async () => {
  assert.equal((await api("GET", `/api/availability?date=${MONDAY}&duration=0`)).status, 400);
  assert.equal((await api("GET", `/api/availability?date=${MONDAY}&duration=45.5`)).status, 400);
  assert.equal((await api("GET", `/api/availability?date=lundi&duration=30`)).status, 400);
});

test("réservation : refusée si la prestation est inconnue", async () => {
  const { status, data } = await book({ service_id: "inexistant", service_type: "Prestation inventée" });
  assert.equal(status, 400);
  assert.match(data.error, /Prestation inconnue/);
});

test("réservation : refusée si le créneau est dans le passé", async () => {
  const { status } = await book({ start_time: "2020-01-06T10:00:00" });
  assert.equal(status, 400);
});

test("réservation : refusée au-delà de l'horizon (4 semaines par défaut)", async () => {
  const far = new Date(nextMonday);
  far.setDate(far.getDate() + 7 * 8); // un lundi dans 9 semaines et des poussières
  const { status, data } = await book({ start_time: `${localDate(far)}T10:00:00` });
  assert.equal(status, 400);
  assert.match(data.error, /4 semaines/);

  const settings = await api("GET", "/api/settings");
  assert.equal(settings.data.booking_horizon_weeks, "4");
  assert.equal(settings.data.email_confirmation, "false", "ni Resend ni n8n en test");
});

test("réservation : refusée hors horaires d'ouverture et sur un jour fermé", async () => {
  assert.equal((await book({ start_time: `${MONDAY}T03:00:00` })).status, 409);
  assert.equal((await book({ start_time: `${MONDAY}T18:45:00` })).status, 409, "18:45 + 30 min dépasse 19:00");
  assert.equal((await book({ start_time: `${SUNDAY}T10:00:00` })).status, 409);
});

test("réservation : refusée si le créneau n'est pas sur la grille", async () => {
  assert.equal((await book({ start_time: `${MONDAY}T10:15:00` })).status, 409);
  assert.equal((await book({ start_time: "pas-une-date" })).status, 400);
  assert.equal((await book({ start_time: `${MONDAY}T10:00:00+02:00` })).status, 400);
});

test("réservation : acceptée, la fin et le prix viennent de la prestation, le consentement est stocké", async () => {
  const { status, data } = await book({ service_id: "coupe-barbe" }); // 45 min
  assert.equal(status, 201, JSON.stringify(data));
  assert.equal(data.service, "Coupe + Barbe");
  assert.equal(data.start_time, `${MONDAY}T10:00:00`);
  assert.equal(data.end_time, `${MONDAY}T10:45:00`);

  // Vérification côté admin.
  const login = await api("POST", "/api/admin/login", { password: DEFAULT_PASSWORD });
  assert.equal(login.status, 200);
  adminToken = login.data.token;
  assert.equal(login.data.mustChangePassword, true, "le mot de passe par défaut doit être signalé");

  const list = await api("GET", `/api/bookings?date=${MONDAY}`, undefined, adminToken);
  assert.equal(list.status, 200);
  const row = list.data.find((b: any) => b.id === data.id);
  assert.ok(row, "réservation absente de la base");
  assert.equal(row.end_time, `${MONDAY}T10:45:00`);
  assert.equal(row.sms_opt_in, 1);
});

test("réservation : le créneau pris disparaît des disponibilités et ne peut plus être réservé", async () => {
  const avail = await api("GET", `/api/availability?date=${MONDAY}&duration=30`);
  assert.ok(!avail.data.slots.includes("10:00"), "10:00 encore proposé");
  assert.ok(!avail.data.slots.includes("10:30"), "10:30 chevauche la réservation 10:00–10:45");
  assert.ok(avail.data.slots.includes("11:00"), "11:00 doit rester libre");

  const again = await book();
  assert.equal(again.status, 409);
  assert.match(again.data.error, /pas disponible/);

  const overlap = await book({ start_time: `${MONDAY}T09:30:00`, service_id: "rituel" }); // 75 min → 10:45
  assert.equal(overlap.status, 409);
});

test("réservation : par nom de prestation (compatibilité) et sans consentement", async () => {
  const { status, data } = await book({ service_id: undefined, service_type: "Taille de barbe", start_time: `${MONDAY}T11:00:00`, sms_opt_in: false });
  assert.equal(status, 201, JSON.stringify(data));
  assert.equal(data.end_time, `${MONDAY}T11:20:00`);
  const list = await api("GET", `/api/bookings?date=${MONDAY}`, undefined, adminToken);
  const row = list.data.find((b: any) => b.id === data.id);
  assert.equal(row.sms_opt_in, 0);
});

test("indisponibilité : bloque les créneaux côté client et côté réservation", async () => {
  const block = await api("POST", "/api/blocks", { summary: "Pause", start: `${MONDAY}T14:00:00`, end: `${MONDAY}T15:00:00` }, adminToken);
  assert.equal(block.status, 201);

  const avail = await api("GET", `/api/availability?date=${MONDAY}&duration=30`);
  assert.ok(!avail.data.slots.includes("14:00"));
  assert.ok(!avail.data.slots.includes("14:30"));
  assert.ok(avail.data.slots.includes("13:30"), "13:30 + 30 min se termine pile à 14:00 : libre");
  assert.ok(avail.data.slots.includes("15:00"));
  const long = await api("GET", `/api/availability?date=${MONDAY}&duration=45`);
  assert.ok(!long.data.slots.includes("13:30"), "13:30 + 45 min mord sur le blocage");

  assert.equal((await book({ start_time: `${MONDAY}T14:00:00` })).status, 409);
  assert.equal((await book({ start_time: `${MONDAY}T15:00:00` })).status, 201);

  // Suppression du bloc → 14:00 redevient libre.
  assert.equal((await api("DELETE", `/api/blocks/${block.data.id}`, undefined, adminToken)).status, 200);
  const after = await api("GET", `/api/availability?date=${MONDAY}&duration=30`);
  assert.ok(after.data.slots.includes("14:00"));
});

test("réservation : refusée sans token pour les données clients", async () => {
  assert.equal((await api("GET", `/api/bookings?date=${MONDAY}`)).status, 401);
  assert.equal((await api("POST", "/api/blocks", { start: `${MONDAY}T09:00:00`, end: `${MONDAY}T10:00:00` })).status, 401);
});

test("réglages publics : aucune donnée sensible", async () => {
  const { data } = await api("GET", "/api/settings");
  assert.deepEqual(Object.keys(data).sort(), ["booking_horizon_weeks", "email_confirmation", "opening_hours", "show_about", "show_gallery"]);
});

test("réglage : l'horizon de réservation est borné (1 à 12 semaines)", async () => {
  assert.equal((await api("POST", "/api/settings", { key: "booking_horizon_weeks", value: "0" }, adminToken)).status, 400);
  assert.equal((await api("POST", "/api/settings", { key: "booking_horizon_weeks", value: "13" }, adminToken)).status, 400);
  assert.equal((await api("POST", "/api/settings", { key: "booking_horizon_weeks", value: "6" }, adminToken)).status, 200);
  assert.equal((await api("GET", "/api/settings")).data.booking_horizon_weeks, "6");
  assert.equal((await api("POST", "/api/settings", { key: "booking_horizon_weeks", value: "4" }, adminToken)).status, 200);
});

test("mot de passe : le défaut doit être remplacé, jamais réutilisé", async () => {
  const same = await api("POST", "/api/settings", { key: "admin_password", value: DEFAULT_PASSWORD }, adminToken);
  assert.equal(same.status, 400);
  const short = await api("POST", "/api/settings", { key: "admin_password", value: "court" }, adminToken);
  assert.equal(short.status, 400);
  const internal = await api("POST", "/api/settings", { key: "admin_password_is_default", value: "false" }, adminToken);
  assert.equal(internal.status, 400);

  const ok = await api("POST", "/api/settings", { key: "admin_password", value: "nouveau-mdp-2026" }, adminToken);
  assert.equal(ok.status, 200);
  const me = await api("GET", "/api/admin/me", undefined, adminToken);
  assert.equal(me.data.mustChangePassword, false);

  assert.equal((await api("POST", "/api/admin/login", { password: DEFAULT_PASSWORD })).status, 401);
  const relogin = await api("POST", "/api/admin/login", { password: "nouveau-mdp-2026" });
  assert.equal(relogin.status, 200);
  assert.equal(relogin.data.mustChangePassword, false);
});

test("OAuth Google : le callback refuse un appel sans state valide", async () => {
  const res = await fetch(`${BASE}/auth/google/callback?code=abc`);
  assert.equal(res.status, 400);
  const res2 = await fetch(`${BASE}/auth/google/callback?code=abc&state=inconnu`);
  assert.equal(res2.status, 400);
});

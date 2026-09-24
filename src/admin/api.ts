// Authentification admin côté client : gestion du token de session
// (sessionStorage) et fetch avec en-tête Authorization.

const TOKEN_KEY = 'ct_admin_token';

export const getAdminToken = () => sessionStorage.getItem(TOKEN_KEY);

export const setAdminToken = (token: string) => sessionStorage.setItem(TOKEN_KEY, token);

export const clearAdminToken = () => sessionStorage.removeItem(TOKEN_KEY);

/** fetch() qui joint automatiquement le token admin. */
export const adminFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = getAdminToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

/** Tente la connexion ; stocke le token si OK, sinon renvoie le message d'erreur. */
export const adminLogin = async (
  password: string,
): Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean; retryAfter?: number }> => {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      setAdminToken(data.token);
      return { ok: true, mustChangePassword: data.mustChangePassword === true };
    }
    // 429 : le serveur indique combien de secondes attendre avant de réessayer.
    if (res.status === 429) {
      const header = Number(res.headers.get('Retry-After'));
      const retryAfter = Number(data.retryAfter) || (header > 0 ? header : 0);
      return { ok: false, error: data.error || 'Trop de tentatives.', retryAfter };
    }
    return { ok: false, error: data.error || 'Mot de passe incorrect' };
  } catch {
    return { ok: false, error: 'Erreur de connexion au serveur.' };
  }
};

export const adminLogout = async () => {
  try {
    await adminFetch('/api/admin/logout', { method: 'POST' });
  } finally {
    clearAdminToken();
  }
};

/** Vérifie qu'un token stocké est encore accepté par le serveur. */
export const checkAdminSession = async (): Promise<{ ok: boolean; mustChangePassword: boolean }> => {
  if (!getAdminToken()) return { ok: false, mustChangePassword: false };
  try {
    const res = await adminFetch('/api/admin/me');
    if (!res.ok) {
      clearAdminToken();
      return { ok: false, mustChangePassword: false };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, mustChangePassword: data.mustChangePassword === true };
  } catch {
    return { ok: false, mustChangePassword: false };
  }
};

/** Change le mot de passe gérant (8 caractères minimum, différent de celui par défaut). */
export const changeAdminPassword = async (newPassword: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await adminFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'admin_password', value: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error || 'Erreur lors de la mise à jour.' };
  } catch {
    return { ok: false, error: 'Erreur réseau.' };
  }
};

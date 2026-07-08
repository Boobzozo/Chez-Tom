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
export const adminLogin = async (password: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      setAdminToken(data.token);
      return { ok: true };
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
export const checkAdminSession = async (): Promise<boolean> => {
  if (!getAdminToken()) return false;
  try {
    const res = await adminFetch('/api/admin/me');
    if (!res.ok) clearAdminToken();
    return res.ok;
  } catch {
    return false;
  }
};

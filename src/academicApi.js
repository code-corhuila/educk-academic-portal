const GATEWAY_URL = String(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_GATEWAY_URL) || 'http://localhost:8080',
).replace(/\/+$/, '');

// El Gateway expone /api/v1/grades y /api/v1/courses (NO existe /api/v1/academic).
export const DEFAULT_ACADEMIC_API_URL = `${GATEWAY_URL}/api/v1`;

// Roles del JWT (ADMIN, TEACHER, PARENT, STUDENT) y roles de interfaz.
const ROLE_ALIASES = {
  ADMIN: 'DIRECTIVO',
  SUPER_ADMIN: 'DIRECTIVO',
  DIRECTIVO: 'DIRECTIVO',
  TEACHER: 'DOCENTE',
  DOCENTE: 'DOCENTE',
  PARENT: 'ACUDIENTE',
  ACUDIENTE: 'ACUDIENTE',
  STUDENT: 'ESTUDIANTE',
  ESTUDIANTE: 'ESTUDIANTE',
};

export const SHELL_ORIGIN = new URL((typeof import.meta !== 'undefined' && import.meta.env?.VITE_SHELL_ORIGIN) || 'http://localhost:3000').origin;

let portalAccessToken = '';

export function setPortalAccessToken(token) {
  portalAccessToken = typeof token === 'string' ? token : '';
}

export function getPortalAccessToken() {
  return portalAccessToken;
}

export function isTrustedShellOrigin(candidate, trustedUrl = SHELL_ORIGIN) {
  try {
    if ('Origin' in globalThis && typeof globalThis.Origin?.from === 'function') {
      let candidateOrigin;
      try { candidateOrigin = globalThis.Origin.from(candidate); } catch {
        const raw = typeof MessageEvent !== 'undefined' && candidate instanceof MessageEvent ? candidate.origin : String(candidate ?? '');
        candidateOrigin = globalThis.Origin.from(raw);
      }
      return candidateOrigin.isSameOrigin(globalThis.Origin.from(trustedUrl));
    }
    const rawUrl = typeof candidate === 'string' ? candidate : (typeof candidate?.origin === 'string' ? candidate.origin : '');
    const candidateParsed = new URL(rawUrl), trustedParsed = new URL(trustedUrl);
    return candidateParsed.origin !== 'null' && candidateParsed.origin === trustedParsed.origin;
  } catch {
    return false;
  }
}

export function extractShellContext(event, trustedUrl = SHELL_ORIGIN) {
  if (!isTrustedShellOrigin(event, trustedUrl)) return null;
  const data = event?.data;
  if (!data || data.type !== 'edutrack:context' || typeof data.token !== 'string' || !data.token) return null;
  const rawRole = typeof data.role === 'string' ? data.role.trim().toUpperCase() : '';
  const role = ROLE_ALIASES[rawRole];
  if (!role) return null;
  setPortalAccessToken(data.token);
  return { token: data.token, role, user: data.user || null, view: data.view || '' };
}

function randomHex(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export function createTraceHeaders() {
  return {
    traceparent: `00-${randomHex(32)}-${randomHex(16)}-01`,
    correlationId: globalThis.crypto?.randomUUID?.() ?? `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`,
  };
}

/**
 * Normaliza la URL base para que SIEMPRE apunte al Gateway:
 *  - vacío                       -> http://localhost:8080/api/v1
 *  - relativa ('/api/v1/...')    -> se antepone el Gateway (si no, caería en el propio portal :3002)
 *  - termina en '/academic'      -> se quita (ese prefijo no existe en el Gateway)
 */
export function resolveBaseUrl(rawBaseUrl) {
  let base = typeof rawBaseUrl === 'string' ? rawBaseUrl.trim() : '';
  if (!base) return DEFAULT_ACADEMIC_API_URL;
  base = base.replace(/\/+$/, '').replace(/\/academic$/, '');
  if (base.startsWith('/')) base = `${GATEWAY_URL}${base}`;
  return base;
}

export function buildStudentGradesUrl(baseUrl, studentId) {
  return `${resolveBaseUrl(baseUrl)}/grades/student/${encodeURIComponent(studentId)}`;
}

/**
 * Author / Autora: Celeste Dussán.
 * Keeps transport details outside React so the backend contract can evolve independently.
 */
export function createAcademicApiClient({ baseUrl, fetchImplementation = globalThis.fetch } = {}) {
  if (typeof fetchImplementation !== 'function') throw new Error('A fetch implementation is required');

  return {
    async getStudentGrades(studentId, accessToken, { signal, traceparent, correlationId } = {}) {
      if (!studentId) throw new Error('A studentId is required');

      const headers = { Accept: 'application/json' };
      const effectiveToken = accessToken || portalAccessToken;
      if (effectiveToken) headers.Authorization = `Bearer ${effectiveToken}`;
      if (traceparent) headers.traceparent = traceparent;
      if (correlationId) headers['X-Correlation-Id'] = correlationId;

      const response = await fetchImplementation(buildStudentGradesUrl(baseUrl, studentId), { headers, signal });
      if (!response.ok) {
        const error = new Error(`Academic API request failed with status ${response.status}`);
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('Academic API returned an invalid grade list');
      return payload;
    },
  };
}

export const academicApi = createAcademicApiClient({
  baseUrl: import.meta.env?.VITE_ACADEMIC_API_URL,
});


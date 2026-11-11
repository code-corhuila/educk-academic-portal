const DEFAULT_ACADEMIC_API_URL = '/api/v1/academic';

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

export function buildStudentGradesUrl(baseUrl, studentId) {
  const normalizedBaseUrl = (baseUrl || DEFAULT_ACADEMIC_API_URL).replace(/\/$/, '');
  return `${normalizedBaseUrl}/grades/student/${encodeURIComponent(studentId)}`;
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
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      if (traceparent) headers.traceparent = traceparent;
      if (correlationId) headers['X-Correlation-Id'] = correlationId;

      const response = await fetchImplementation(buildStudentGradesUrl(baseUrl, studentId), { headers, signal });
      if (!response.ok) throw new Error(`Academic API request failed with status ${response.status}`);

      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('Academic API returned an invalid grade list');
      return payload;
    },
  };
}

export const academicApi = createAcademicApiClient({
  baseUrl: import.meta.env?.VITE_ACADEMIC_API_URL,
});

const DEFAULT_ACADEMIC_API_URL = '/api/v1/academic';

export function buildStudentGradesUrl(baseUrl, studentId) {
  const normalizedBaseUrl = (baseUrl || DEFAULT_ACADEMIC_API_URL).replace(/\/$/, '');
  return `${normalizedBaseUrl}/grades/student/${encodeURIComponent(studentId)}`;
}

/**
 * Author / Autora: Celeste Dussán.
 * Keeps transport details outside React so the backend contract can evolve independently.
 * Mantiene el transporte fuera de React para que el contrato del backend evolucione sin acoplar la interfaz.
 */
export function createAcademicApiClient({ baseUrl, fetchImplementation = globalThis.fetch } = {}) {
  if (typeof fetchImplementation !== 'function') throw new Error('A fetch implementation is required');

  return {
    async getStudentGrades(studentId, accessToken, { signal } = {}) {
      if (!studentId) throw new Error('A studentId is required');

      const headers = { Accept: 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

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

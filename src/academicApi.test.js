import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStudentGradesUrl,
  createAcademicApiClient,
  createTraceHeaders,
  extractShellContext,
  getPortalAccessToken,
  setPortalAccessToken,
} from './academicApi.js';

test('builds the gateway grade endpoint without a duplicated slash', () => {
  assert.equal(
    buildStudentGradesUrl('http://localhost:8080/api/v1/academic/', 'student 1'),
    'http://localhost:8080/api/v1/grades/student/student%201',
  );
  assert.equal(
    buildStudentGradesUrl('', 'student-1'),
    'http://localhost:8080/api/v1/grades/student/student-1',
  );
});

test('requests grades with the bearer token and abort signal', async () => {
  const calls = [];
  const signal = AbortSignal.timeout(1000);
  const client = createAcademicApiClient({
    baseUrl: 'http://localhost:8080/api/v1',
    fetchImplementation: async (...args) => {
      calls.push(args);
      return { ok: true, json: async () => [{ id: 'grade-1' }] };
    },
  });

  const grades = await client.getStudentGrades('student-1', 'token-1', { signal });

  assert.deepEqual(grades, [{ id: 'grade-1' }]);
  assert.equal(calls[0][0], 'http://localhost:8080/api/v1/grades/student/student-1');
  assert.deepEqual(calls[0][1].headers, { Accept: 'application/json', Authorization: 'Bearer token-1' });
  assert.equal(calls[0][1].signal, signal);
});

test('propagates W3C traceparent and X-Correlation-Id headers when provided', async () => {
  const calls = [];
  const trace = createTraceHeaders();
  const client = createAcademicApiClient({
    baseUrl: 'http://localhost:8080/api/v1',
    fetchImplementation: async (...args) => {
      calls.push(args);
      return { ok: true, json: async () => [{ id: 'grade-1' }] };
    },
  });

  await client.getStudentGrades('student-1', 'token-1', trace);

  assert.match(calls[0][1].headers.traceparent, /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  assert.equal(calls[0][1].headers['X-Correlation-Id'], trace.correlationId);
});

test('reports a non-successful backend response', async () => {
  const client = createAcademicApiClient({
    fetchImplementation: async () => ({ ok: false, status: 503 }),
  });

  await assert.rejects(() => client.getStudentGrades('student-1'), /status 503/);
});

test('rejects a response that is not a grade list', async () => {
  const client = createAcademicApiClient({
    fetchImplementation: async () => ({ ok: true, json: async () => ({ grades: [] }) }),
  });

  await assert.rejects(() => client.getStudentGrades('student-1'), /invalid grade list/);
});

test('extractShellContext accepts verified shell origin, keeps token in memory, and rejects untrusted origins', () => {
  setPortalAccessToken('');
  assert.equal(extractShellContext({ origin: 'http://evil.example', data: { type: 'edutrack:context', token: 'tok', role: 'DIRECTIVO' } }, 'http://localhost:3000'), null);
  assert.equal(extractShellContext({ origin: 'null', data: { type: 'edutrack:context', token: 'tok', role: 'DIRECTIVO' } }, 'http://localhost:3000'), null);
  assert.equal(getPortalAccessToken(), '');

  const accepted = extractShellContext({ origin: 'http://localhost:3000', data: { type: 'edutrack:context', token: 'rs256-jwt', role: 'DOCENTE', user: { name: 'Prof' } } }, 'http://localhost:3000');
  assert.equal(accepted?.role, 'DOCENTE');
  assert.equal(getPortalAccessToken(), 'rs256-jwt');
});


test('builds student grades URL using gateway base url without /grades', () => {
  assert.equal(
    buildStudentGradesUrl('http://localhost:8080', 'student-1'),
    'http://localhost:8080/api/v1/grades/student/student-1',
  );
  assert.equal(
    buildStudentGradesUrl('http://localhost:8080/api/v1', 'student-1'),
    'http://localhost:8080/api/v1/grades/student/student-1',
  );
  assert.equal(
    buildStudentGradesUrl('http://localhost:8080/api/v1/grades', 'student-1'),
    'http://localhost:8080/api/v1/grades/student/student-1',
  );
});

test('uses Bearer token stored in sessionStorage edutrack_session if no token argument provided', async () => {
  setPortalAccessToken('');
  const calls = [];
  const fakeSessionStorage = {
    getItem: (key) => key === 'edutrack_session' ? JSON.stringify({ token: 'session-jwt-token' }) : null,
  };
  globalThis.sessionStorage = fakeSessionStorage;

  const client = createAcademicApiClient({
    baseUrl: 'http://localhost:8080/api/v1/grades',
    fetchImplementation: async (...args) => {
      calls.push(args);
      return { ok: true, json: async () => [{ id: 'grade-from-session' }] };
    },
  });

  const res = await client.getStudentGrades('st-100');
  assert.equal(res[0].id, 'grade-from-session');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer session-jwt-token');

  delete globalThis.sessionStorage;
});

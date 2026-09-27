import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStudentGradesUrl, createAcademicApiClient } from './academicApi.js';

test('builds the gateway grade endpoint without a duplicated slash', () => {
  assert.equal(
    buildStudentGradesUrl('http://localhost:8080/api/v1/academic/', 'student 1'),
    'http://localhost:8080/api/v1/academic/grades/student/student%201',
  );
});

test('requests grades with the bearer token and abort signal', async () => {
  const calls = [];
  const signal = AbortSignal.timeout(1000);
  const client = createAcademicApiClient({
    baseUrl: '/academic',
    fetchImplementation: async (...args) => {
      calls.push(args);
      return { ok: true, json: async () => [{ id: 'grade-1' }] };
    },
  });

  const grades = await client.getStudentGrades('student-1', 'token-1', { signal });

  assert.deepEqual(grades, [{ id: 'grade-1' }]);
  assert.equal(calls[0][0], '/academic/grades/student/student-1');
  assert.deepEqual(calls[0][1].headers, { Accept: 'application/json', Authorization: 'Bearer token-1' });
  assert.equal(calls[0][1].signal, signal);
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

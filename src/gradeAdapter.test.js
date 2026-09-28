import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptGradesFromApi } from './gradeAdapter.js';

test('preserves enrichment fields supplied by the backend', () => {
  const rawGrade = {
    id: 'grade-1',
    assignmentId: 'assignment-1',
    studentId: 'student-1',
    score: 4.2,
    createdAt: '2026-09-27T15:00:00Z',
    subjectName: 'Biología',
    activityTitle: 'Células',
    weight: 100,
  };

  const [grade] = adaptGradesFromApi([rawGrade]);

  assert.equal(grade.subjectName, 'Biología');
  assert.equal(grade.activityTitle, 'Células');
  assert.equal(grade.weight, 100);
  assert.equal(grade.date, rawGrade.createdAt);
  assert.notEqual(grade, rawGrade);
});

test('uses temporary assignment metadata while the API lacks enrichment fields', () => {
  const [grade] = adaptGradesFromApi([{ assignmentId: 'asn-math-quiz', score: 4 }]);
  assert.deepEqual(
    { subjectName: grade.subjectName, activityTitle: grade.activityTitle, weight: grade.weight },
    { subjectName: 'Matemáticas', activityTitle: 'Quiz: Fracciones', weight: 40 },
  );
});

test('returns an empty list for a malformed response', () => {
  assert.deepEqual(adaptGradesFromApi({ grades: [] }), []);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptGradesFromApi, DEMO_EXAM_ASSIGNMENT_ID, formatGradeDate, weightToPercent } from './gradeAdapter.js';

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

test('converts the API weight fraction (0.4000) to a percentage and keeps percentages', () => {
  assert.equal(weightToPercent(0.4), 40);
  assert.equal(weightToPercent('0.6000'), 60);
  assert.equal(weightToPercent(1), 100);
  assert.equal(weightToPercent(40), 40);
  assert.equal(weightToPercent(null), 0);
  assert.equal(weightToPercent(-1), 0);
});

test('shows API grades from the seeded assignment UUIDs with a percentage weight', () => {
  const [grade] = adaptGradesFromApi([
    { id: 'g', assignmentId: '00000000-0000-4000-8000-000000000301', score: 4.5, weight: 0.4, createdAt: '2026-11-11T22:38:12.451' },
  ]);
  assert.equal(grade.subjectName, 'Matemáticas');
  assert.equal(grade.activityTitle, 'Quiz: Fracciones');
  assert.equal(grade.weight, 40);
});

test('knows the demo exam assignment the teacher grades live', () => {
  const [grade] = adaptGradesFromApi([{ assignmentId: DEMO_EXAM_ASSIGNMENT_ID, score: 4.1, weight: 0.4 }]);
  assert.equal(grade.activityTitle, 'Examen final');
});

test('formats ISO timestamps for display and respects already formatted dates', () => {
  assert.equal(formatGradeDate('2026-11-11T22:38:12.451'), '11 nov 2026');
  assert.equal(formatGradeDate('2026-09-27T15:00:00Z'), '27 sep 2026');
  assert.equal(formatGradeDate('31 ago 2026'), '31 ago 2026');
  assert.equal(formatGradeDate(undefined), '');
});

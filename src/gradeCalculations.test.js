import assert from 'node:assert/strict';
import test from 'node:test';
import { averageBySubject, filterBySubject, weightedAverage } from './gradeCalculations.js';

const grades = [
  { subjectName: 'Matemáticas', score: 4, weight: 40 },
  { subjectName: 'Matemáticas', score: 5, weight: 60 },
  { subjectName: 'Lenguaje', score: 2.8, weight: 100 },
];

test('ALL preserves every grade', () => assert.equal(filterBySubject(grades, 'ALL').length, 3));
test('filters grades by subject', () => assert.equal(filterBySubject(grades, 'Lenguaje').length, 1));
test('calculates a normalized weighted average', () => assert.equal(weightedAverage(grades.slice(0, 2)), 4.6));
test('returns zero when there is no valid weight', () => assert.equal(weightedAverage([]), 0));
test('orders subject summaries from best to lowest', () => {
  assert.deepEqual(averageBySubject(grades).map(({ subject }) => subject), ['Matemáticas', 'Lenguaje']);
});

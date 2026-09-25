import assert from 'node:assert/strict';
import test from 'node:test';
import { averageBySubject, classifyAverage, filterBySubject, weightedAverage } from './gradeCalculations.js';

const grades = [
  { subjectName: 'Matemáticas', score: 4, weight: 40 },
  { subjectName: 'Matemáticas', score: 5, weight: 60 },
  { subjectName: 'Lenguaje', score: 2.8, weight: 100 },
];

test('ALL preserves every grade', () => assert.equal(filterBySubject(grades, 'ALL').length, 3));
test('filters grades by subject', () => assert.equal(filterBySubject(grades, 'Lenguaje').length, 1));
test('calculates a normalized weighted average', () => assert.equal(weightedAverage(grades.slice(0, 2)), 4.6));
test('returns zero when there is no valid weight', () => assert.equal(weightedAverage([]), 0));
test('classifies an average at or above 3.0 as approved', () => {
  assert.equal(classifyAverage(weightedAverage([{ score: 3, weight: 100 }])), 'approved');
});
test('classifies an average below 3.0 as failed', () => {
  assert.equal(classifyAverage(weightedAverage([{ score: 2.9, weight: 100 }])), 'failed');
});
test('orders subject summaries from best to lowest', () => {
  assert.deepEqual(averageBySubject(grades).map(({ subject }) => subject), ['Matemáticas', 'Lenguaje']);
});

export function filterBySubject(grades, selectedSubject) {
  return selectedSubject === 'ALL' ? grades : grades.filter((grade) => grade.subjectName === selectedSubject);
}

export function weightedAverage(grades) {
  const validGrades = grades.filter((grade) => Number.isFinite(grade.score) && grade.weight > 0);
  const totalWeight = validGrades.reduce((total, grade) => total + grade.weight, 0);
  if (!totalWeight) return 0;
  return validGrades.reduce((total, grade) => total + grade.score * grade.weight, 0) / totalWeight;
}

export function averageBySubject(grades) {
  const subjects = [...new Set(grades.map((grade) => grade.subjectName))];
  return subjects
    .map((subject) => ({ subject, average: weightedAverage(filterBySubject(grades, subject)) }))
    .sort((first, second) => second.average - first.average);
}

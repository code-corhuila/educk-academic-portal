// The raw mock uses the agreed API-facing fields: id, assignmentId, studentId,
// score, feedback and date. OpenAPI currently calls the timestamp `createdAt`, so
// the adapter accepts both names. The API is still missing subjectName,
// activityTitle and weight; this map enriches them until the backend provides them.
const assignmentMetadata = {
  'asn-math-quiz': { subjectName: 'Matemáticas', activityTitle: 'Quiz: Fracciones', weight: 40 },
  'asn-math-project': { subjectName: 'Matemáticas', activityTitle: 'Proyecto de datos', weight: 60 },
  'asn-science-lab': { subjectName: 'Ciencias', activityTitle: 'Laboratorio 3', weight: 100 },
  'asn-language-essay': { subjectName: 'Lenguaje', activityTitle: 'Ensayo corto', weight: 100 },
  'asn-english-listening': { subjectName: 'Inglés', activityTitle: 'Listening test', weight: 100 },
};

export const mockApiResponse = [
  { id: 'g-1', assignmentId: 'asn-math-quiz', studentId: 'stu-juan', score: 4.5, feedback: 'Muy buen trabajo', date: '31 ago 2026' },
  { id: 'g-2', assignmentId: 'asn-math-project', studentId: 'stu-juan', score: 4.3, feedback: 'Entrega completa', date: '29 ago 2026' },
  { id: 'g-3', assignmentId: 'asn-science-lab', studentId: 'stu-juan', score: 4.2, feedback: 'Buen análisis', date: '28 ago 2026' },
  { id: 'g-4', assignmentId: 'asn-language-essay', studentId: 'stu-juan', score: 2.8, feedback: 'Reforzar la tesis', date: '26 ago 2026' },
  { id: 'g-5', assignmentId: 'asn-english-listening', studentId: 'stu-juan', score: 4.4, feedback: 'Excelente comprensión', date: '22 ago 2026' },
];

export function adaptGradesFromApi(rawResponse) {
  if (!Array.isArray(rawResponse)) return [];
  return rawResponse.map((grade) => ({
    ...grade,
    date: grade.date ?? grade.createdAt,
    ...(assignmentMetadata[grade.assignmentId] ?? {
      subjectName: 'Materia sin identificar', activityTitle: 'Actividad sin identificar', weight: 0,
    }),
  }));
}

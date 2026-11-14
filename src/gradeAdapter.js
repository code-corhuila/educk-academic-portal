// The raw mock uses the agreed API-facing fields: id, assignmentId, studentId,
// score, feedback and date. OpenAPI currently calls the timestamp `createdAt`.
// El mock usa los campos acordados y acepta `createdAt` como fecha del contrato OpenAPI.
// The API still needs to provide subjectName, activityTitle and weight directly.
// El backend todavía debe entregar subjectName, activityTitle y weight directamente.
// Asignación de Matemáticas (docente titular) que la migración de demostración debe dejar creada y SIN calificar.
export const DEMO_EXAM_ASSIGNMENT_ID = '00000000-0000-4000-8000-000000000307';

const assignmentMetadata = {
  'asn-math-quiz': { subjectName: 'Matemáticas', activityTitle: 'Quiz: Fracciones', weight: 40 },
  'asn-math-project': { subjectName: 'Matemáticas', activityTitle: 'Proyecto de datos', weight: 60 },
  'asn-science-lab': { subjectName: 'Ciencias', activityTitle: 'Laboratorio 3', weight: 100 },
  'asn-language-essay': { subjectName: 'Lenguaje', activityTitle: 'Ensayo corto', weight: 100 },
  'asn-english-listening': { subjectName: 'Inglés', activityTitle: 'Listening test', weight: 100 },
  '00000000-0000-4000-8000-000000000301': { subjectName: 'Matemáticas', activityTitle: 'Quiz: Fracciones', weight: 40 },
  '00000000-0000-4000-8000-000000000302': { subjectName: 'Matemáticas', activityTitle: 'Proyecto de datos', weight: 60 },
  '00000000-0000-4000-8000-000000000303': { subjectName: 'Ciencias', activityTitle: 'Laboratorio 3', weight: 50 },
  '00000000-0000-4000-8000-000000000304': { subjectName: 'Ciencias', activityTitle: 'Taller Ecosistemas', weight: 50 },
  '00000000-0000-4000-8000-000000000305': { subjectName: 'Lenguaje', activityTitle: 'Ensayo corto', weight: 50 },
  '00000000-0000-4000-8000-000000000306': { subjectName: 'Lenguaje', activityTitle: 'Control de lectura', weight: 50 },
  // Asignación SIN nota para Juan: es la que el docente califica en vivo durante la demostración.
  [DEMO_EXAM_ASSIGNMENT_ID]: { subjectName: 'Matemáticas', activityTitle: 'Examen final', weight: 40 },
};

export const mockApiResponse = [
  { id: 'g-1', assignmentId: 'asn-math-quiz', studentId: 'stu-juan', score: 4.5, feedback: 'Muy buen trabajo', date: '31 ago 2026' },
  { id: 'g-2', assignmentId: 'asn-math-project', studentId: 'stu-juan', score: 4.3, feedback: 'Entrega completa', date: '29 ago 2026' },
  { id: 'g-3', assignmentId: 'asn-science-lab', studentId: 'stu-juan', score: 4.2, feedback: 'Buen análisis', date: '28 ago 2026' },
  { id: 'g-4', assignmentId: 'asn-language-essay', studentId: 'stu-juan', score: 2.8, feedback: 'Reforzar la tesis', date: '26 ago 2026' },
  { id: 'g-5', assignmentId: 'asn-english-listening', studentId: 'stu-juan', score: 4.4, feedback: 'Excelente comprensión', date: '22 ago 2026' },
];

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// La API devuelve el peso como fracción (0.4000); el portal lo muestra como porcentaje (40%).
// Un valor > 1 ya viene en porcentaje (datos de demostración) y se deja igual.
export function weightToPercent(weight) {
  const value = Number(weight);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value <= 1 ? Math.round(value * 10000) / 100 : value;
}

// La API devuelve createdAt ISO ("2026-11-11T22:38:12.451"); se muestra "11 nov 2026". Un texto ya formateado se respeta.
export function formatGradeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value ?? '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS_ES[month - 1]} ${year}`;
}

export function adaptGradesFromApi(rawResponse) {
  if (!Array.isArray(rawResponse)) return [];
  return rawResponse.map((grade) => {
    const fallback = assignmentMetadata[grade.assignmentId] ?? {};
    return {
      ...grade,
      date: grade.date ?? grade.createdAt,
      subjectName: grade.subjectName ?? fallback.subjectName ?? 'Materia sin identificar',
      activityTitle: grade.activityTitle ?? fallback.activityTitle ?? 'Actividad sin identificar',
      weight: weightToPercent(grade.weight ?? fallback.weight),
    };
  });
}

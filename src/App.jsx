import { useMemo, useState } from 'react';
import { adaptGradesFromApi, mockApiResponse } from './gradeAdapter.js';
import { averageBySubject, filterBySubject, weightedAverage } from './gradeCalculations.js';
import './styles.css';

const student = { name: 'Juan López', school: 'Colegio EduTrack · 8°A', guardian: 'María López' };

export default function App() {
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const grades = useMemo(() => adaptGradesFromApi(mockApiResponse), []);
  const subjects = useMemo(() => [...new Set(grades.map((grade) => grade.subjectName))], [grades]);
  const visibleGrades = useMemo(() => filterBySubject(grades, selectedSubject), [grades, selectedSubject]);
  const visibleAverage = weightedAverage(visibleGrades);
  const subjectSummaries = averageBySubject(grades);
  const bestSubject = subjectSummaries.at(0);
  const supportSubject = subjectSummaries.at(-1);
  const isPassing = visibleAverage >= 3;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Edu<span>Track</span></div>
        <div className="student-card"><b>JL</b><span>{student.name}<small>{student.school}</small></span></div>
        <nav aria-label="Navegación principal">
          <span>Resumen</span><strong aria-current="page">Calificaciones</strong><span>Asistencia</span>
          <span>Mensajes</span><span>Notificaciones</span>
        </nav>
        <div className="guardian">ML <span>{student.guardian}<small>Madre / Tutora</small></span></div>
      </aside>

      <main>
        <header><div><p>ACADÉMICO</p><h1>Calificaciones</h1><span>Consulta el rendimiento de Juan por materia.</span></div><span className="period">Periodo 2</span></header>
        <div className="demo-notice" role="status"><b>Datos de demostración</b><span>La integración con Academic API se realizará en un segundo PR.</span></div>

        <section className="summary-grid" aria-label="Resumen académico">
          <article><small>{selectedSubject === 'ALL' ? 'Promedio general' : 'Promedio filtrado'}</small><strong>{visibleAverage.toFixed(1)}</strong><em className={isPassing ? 'success' : 'danger'}>{isPassing ? 'Buen desempeño' : 'Requiere apoyo'}</em></article>
          <article><small>Mejor materia</small><strong>{bestSubject?.average.toFixed(1) ?? '0.0'}</strong><em>{bestSubject?.subject ?? 'Sin datos'}</em></article>
          <article><small>Por reforzar</small><strong>{supportSubject?.average.toFixed(1) ?? '0.0'}</strong><em>{supportSubject?.subject ?? 'Sin datos'}</em></article>
        </section>

        <section className="grades-panel">
          <div className="panel-heading"><div><h2>Detalle por materia</h2><p>{visibleGrades.length} calificaciones visibles</p></div>
            <label>Materia<select aria-label="Filtrar calificaciones por materia" value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}>
              <option value="ALL">Todas las materias</option>{subjects.map((subject) => <option key={subject}>{subject}</option>)}
            </select></label>
          </div>
          <div className="table-scroll" tabIndex="0" aria-label="Tabla de calificaciones con desplazamiento horizontal">
            <table><caption>Calificaciones de {student.name}</caption><thead><tr><th scope="col">Materia</th><th scope="col">Actividad</th><th scope="col">Fecha</th><th scope="col">Calificación</th><th scope="col">Estado</th></tr></thead>
              <tbody>{visibleGrades.length ? visibleGrades.map((grade) => <tr key={grade.id}><td><b>{grade.subjectName}</b><small>{grade.feedback}</small></td><td>{grade.activityTitle}</td><td>{grade.date}</td><td className="score">{grade.score.toFixed(1)}</td><td><span className={grade.score >= 3 ? 'pill pass' : 'pill risk'}>{grade.score >= 3 ? 'Aprobada' : 'En riesgo'}</span></td></tr>) : <tr><td colSpan="5">No hay calificaciones para esta materia.</td></tr>}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

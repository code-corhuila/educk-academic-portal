import { useCallback, useEffect, useMemo, useState } from 'react';
import { academicApi, createTraceHeaders } from './academicApi.js';
import { adaptGradesFromApi, mockApiResponse } from './gradeAdapter.js';
import { averageBySubject, classifyAverage, filterBySubject, weightedAverage } from './gradeCalculations.js';
import './styles.css';

const POLLING_INTERVAL_MS = 30_000;
const student = { id: '00000000-0000-4000-8000-000000000201', name: 'Juan Sebastián López', school: 'Colegio EduTrack · 10°A', guardian: 'María López' };

const INITIAL_ROSTER_10A = [
  { id: 'st-1', name: 'Juan Sebastián López', code: '2026-1001', q1: 4.5, q2: 4.3, exam: 4.4, feedback: 'Excelente dominio analítico y participación.' },
  { id: 'st-2', name: 'Carlos Andrés Pérez', code: '2026-1002', q1: 3.8, q2: 4.0, exam: 3.9, feedback: 'Buen desempeño en resolución de problemas.' },
  { id: 'st-3', name: 'Ana Sofía Gómez', code: '2026-1003', q1: 2.7, q2: 2.9, exam: 2.8, feedback: 'Asistir a tutoría de refuerzo en ecuaciones.' },
  { id: 'st-4', name: 'Luis Fernando Ramos', code: '2026-1004', q1: 4.1, q2: 3.9, exam: 4.0, feedback: 'Cumple oportunamente con los laboratorios.' },
  { id: 'st-5', name: 'Sofía Valentina Torres', code: '2026-1005', q1: 4.7, q2: 4.8, exam: 4.9, feedback: 'Primer puesto académico del curso 10°A.' },
];

const INITIAL_SCHOOL_COURSES = [
  { course: 'Grado 10°A', director: 'Prof. Carlos Ramírez', subject: 'Matemáticas y Ciencias', students: 32, avg: 4.1, approval: '93.8%', risk: 2, closed: true },
  { course: 'Grado 9°B', director: 'Prof. Laura Morales', subject: 'Física y Laboratorio', students: 29, avg: 3.9, approval: '89.6%', risk: 3, closed: true },
  { course: 'Grado 8°A', director: 'Prof. María Rodríguez', subject: 'Lengua Castellana', students: 34, avg: 3.6, approval: '85.2%', risk: 5, closed: false },
  { course: 'Grado 6°B', director: 'Prof. Andrés Castro', subject: 'Inglés Intensivo', students: 30, avg: 4.4, approval: '96.7%', risk: 1, closed: true },
];

function readAccessToken() {
  try {
    const parsed = JSON.parse(localStorage.getItem('edutrack_session') || 'null');
    if (parsed?.token) return parsed.token;
  } catch { /* ignore */ }
  return localStorage.getItem('edutrack_token');
}

export default function App() {
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState('Periodo 2');
  const [grades, setGrades] = useState(() => adaptGradesFromApi(mockApiResponse));
  const [roster, setRoster] = useState(INITIAL_ROSTER_10A);
  const [courses, setCourses] = useState(INITIAL_SCHOOL_COURSES);
  const [teacherForm, setTeacherForm] = useState({ studentId: 'st-3', field: 'exam', score: '3.8', feedback: 'Superó nivelación de ecuaciones.' });
  const [syncState, setSyncState] = useState({ status: 'loading', message: '', traceId: '' });

  const isEmbedded = typeof window !== 'undefined' && (window.self !== window.top || window.location.search.includes('embedded=1'));
  const activeRole = useMemo(() => {
    const r = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('role')?.toUpperCase() : '';
    return ['ACUDIENTE', 'DOCENTE', 'DIRECTIVO'].includes(r) ? r : 'ACUDIENTE';
  }, []);

  const loadGrades = useCallback(async (signal) => {
    const trace = createTraceHeaders();
    setSyncState((c) => ({ ...c, status: 'loading', traceId: trace.traceparent.slice(3, 19) }));
    try {
      const response = await academicApi.getStudentGrades(student.id, readAccessToken(), { signal, ...trace });
      setGrades(adaptGradesFromApi(response));
      setSyncState({ status: 'success', message: 'Datos sincronizados con Academic API.', traceId: trace.traceparent.slice(3, 19) });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setSyncState({ status: 'error', message: 'Modo demostrativo institucional activo (Academic API en espera).', traceId: trace.traceparent.slice(3, 19) });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadGrades(controller.signal);
    const pollingId = window.setInterval(() => loadGrades(controller.signal), POLLING_INTERVAL_MS);
    return () => { controller.abort(); window.clearInterval(pollingId); };
  }, [loadGrades]);

  const subjects = useMemo(() => [...new Set(grades.map((g) => g.subjectName))], [grades]);
  const visibleGrades = useMemo(() => filterBySubject(grades, selectedSubject), [grades, selectedSubject]);
  const visibleAverage = weightedAverage(visibleGrades);
  const subjectSummaries = averageBySubject(grades);
  const bestSubject = subjectSummaries.at(0);
  const supportSubject = subjectSummaries.at(-1);
  const isPassing = classifyAverage(visibleAverage) === 'approved';

  const handleTeacherSave = (e) => {
    e.preventDefault();
    const num = Math.min(5, Math.max(0, Number(teacherForm.score) || 0));
    setRoster((curr) => curr.map((st) => st.id === teacherForm.studentId ? { ...st, [teacherForm.field]: num, feedback: teacherForm.feedback || st.feedback } : st));
    setSyncState((c) => ({ ...c, status: 'success', message: 'Planilla del curso 10°A actualizada correctamente por el docente.' }));
  };

  if (activeRole === 'DOCENTE') {
    const courseAvg = (roster.reduce((acc, s) => acc + (s.q1 * 0.3 + s.q2 * 0.3 + s.exam * 0.4), 0) / roster.length).toFixed(1);
    const riskCount = roster.filter((s) => (s.q1 * 0.3 + s.q2 * 0.3 + s.exam * 0.4) < 3.0).length;
    return (
      <div className="app-shell is-embedded">
        <main>
          <header className="exec-header">
            <div><p>PORTAL DOCENTE · PLANILLA OFICIAL DE CALIFICACIONES</p><h1>Curso 10°A · Matemáticas ({selectedPeriod})</h1><span>Docente Titular: <strong>Prof. Carlos Ramírez</strong> · Registro y nivelación de estudiantes</span></div>
            <div className="header-actions"><select className="period-select" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}><option>Periodo 1</option><option>Periodo 2</option><option>Final</option></select></div>
          </header>
          <section className="summary-grid" style={{ marginTop: '18px' }}>
            <article className="kpi-primary"><small>Promedio del Curso 10°A</small><strong>{courseAvg}</strong><em className="success">{roster.length} estudiantes evaluados</em></article>
            <article className="kpi-emerald"><small>Estudiantes Aprobados</small><strong>{roster.length - riskCount}</strong><em>Desempeño satisfactorio</em></article>
            <article className="kpi-amber"><small>En Riesgo / Nivelación</small><strong>{riskCount}</strong><em className="danger">Requieren plan de refuerzo</em></article>
          </section>
          <section className="grades-panel" style={{ padding: '18px 22px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 12px', color: '#1e3a8a' }}>Calificar Estudiante del Curso 10°A</h2>
            <form onSubmit={handleTeacherSave} style={{ display: 'grid', gridTemplateColumns: '200px 170px 100px 1fr auto', gap: '10px', alignItems: 'center' }}>
              <select value={teacherForm.studentId} onChange={(e) => setTeacherForm({ ...teacherForm, studentId: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                {roster.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={teacherForm.field} onChange={(e) => setTeacherForm({ ...teacherForm, field: e.target.value })} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <option value="q1">Quiz 1 (30%)</option><option value="q2">Proyecto (30%)</option><option value="exam">Examen Final (40%)</option>
              </select>
              <input type="number" step="0.1" min="0" max="5" value={teacherForm.score} onChange={(e) => setTeacherForm({ ...teacherForm, score: e.target.value })} required style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 800 }} />
              <input type="text" placeholder="Concepto evaluativo del docente..." value={teacherForm.feedback} onChange={(e) => setTeacherForm({ ...teacherForm, feedback: e.target.value })} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              <button type="submit" style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Guardar en Planilla</button>
            </form>
          </section>
          <section className="grades-panel">
            <div className="panel-heading"><div><h2>Planilla Consolidada de Estudiantes · Grado 10°A</h2><p>Ponderación oficial: Quiz 1 (30%) · Proyecto (30%) · Examen Final (40%)</p></div></div>
            <div className="table-scroll">
              <table><thead><tr><th>Estudiante</th><th>Código</th><th>Quiz 1 (30%)</th><th>Proyecto (30%)</th><th>Examen (40%)</th><th>Definitiva</th><th>Estado</th></tr></thead>
                <tbody>{roster.map((st) => {
                  const def = (st.q1 * 0.3 + st.q2 * 0.3 + st.exam * 0.4);
                  return (<tr key={st.id}><td><b>{st.name}</b><small>{st.feedback}</small></td><td>{st.code}</td><td>{st.q1.toFixed(1)}</td><td>{st.q2.toFixed(1)}</td><td>{st.exam.toFixed(1)}</td><td className="score">{def.toFixed(1)}</td><td><span className={def >= 3 ? 'pill pass' : 'pill risk'}>{def >= 3 ? 'Aprobado' : 'En nivelación'}</span></td></tr>);
                })}</tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (activeRole === 'DIRECTIVO') {
    return (
      <div className="app-shell is-embedded">
        <main>
          <header className="exec-header">
            <div><p>DIRECCIÓN ACADÉMICA · SUPERVISIÓN INSTITUCIONAL</p><h1>Consolidado General de Rendimiento por Grado</h1><span>Coordinación: <strong>Mag. Juan Pérez</strong> · Auditoría de cierre de actas y promedios por curso</span></div>
          </header>
          <section className="summary-grid" style={{ marginTop: '18px' }}>
            <article className="kpi-primary"><small>Promedio Global Colegio</small><strong>4.0</strong><em className="success">4 Grados en seguimiento</em></article>
            <article className="kpi-emerald"><small>Índice de Aprobación</small><strong>91.3%</strong><em>Meta institucional: 90%</em></article>
            <article className="kpi-amber"><small>Estudiantes en Riesgo</small><strong>11</strong><em className="danger">Comité de evaluación activo</em></article>
          </section>
          <section className="grades-panel">
            <div className="panel-heading"><div><h2>Estado de Actas y Promedios por Curso ({selectedPeriod})</h2><p>Control directivo de cierre de notas por docente titular</p></div></div>
            <div className="table-scroll">
              <table><thead><tr><th>Grado / Curso</th><th>Docente Director de Grupo</th><th>Estudiantes</th><th>Promedio</th><th>Aprobación</th><th>En Riesgo</th><th>Acta de Periodo</th></tr></thead>
                <tbody>{courses.map((c) => (
                  <tr key={c.course}><td><b>{c.course}</b><small>{c.subject}</small></td><td>{c.director}</td><td>{c.students}</td><td className="score">{c.avg.toFixed(1)}</td><td><span className="weight-badge">{c.approval}</span></td><td>{c.risk} est.</td>
                    <td>{c.closed ? <span className="pill pass">Acta Cerrada</span> : <button type="button" onClick={() => setCourses((list) => list.map((x) => x.course === c.course ? { ...x, closed: true } : x))} style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: '#1d4ed8', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Avalar Cierre de Acta</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={`app-shell${isEmbedded ? ' is-embedded' : ''}`}>
      {!isEmbedded && (
        <aside className="sidebar">
          <div className="brand">Edu<span>Track</span></div>
          <div className="student-card"><b>JL</b><span>{student.name}<small>{student.school}</small></span></div>
          <nav aria-label="Navegación principal"><span>Resumen</span><strong aria-current="page">Calificaciones</strong><span>Asistencia</span><span>Mensajes</span></nav>
          <div className="guardian">ML <span>{student.guardian}<small>Madre / Tutora</small></span></div>
        </aside>
      )}
      <main>
        <header className="exec-header">
          <div><p>PORTAL FAMILIAS · BOLETÍN INDIVIDUAL DEL ESTUDIANTE</p><h1>Boletín de Calificaciones de {student.name}</h1><span>{student.school} · Acudiente: <strong>{student.guardian}</strong></span></div>
          <div className="header-actions"><select aria-label="Seleccionar periodo académico" className="period-select" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}><option value="Periodo 1">Periodo 1</option><option value="Periodo 2">Periodo 2 (Actual)</option></select></div>
        </header>
        <div className={`sync-notice ${syncState.status}`} role={syncState.status === 'error' ? 'alert' : 'status'}>
          <div><b>{syncState.status === 'success' ? 'Academic API conectada' : 'Boletín familiar · Trace W3C: ' + (syncState.traceId || 'activo')}</b><span>{syncState.status === 'loading' ? 'Actualizando calificaciones…' : syncState.message}</span></div>
        </div>
        <section className="summary-grid" aria-label="Resumen académico">
          <article className="kpi-primary"><small>Promedio de mi hijo ({selectedPeriod})</small><strong>{visibleAverage.toFixed(1)}</strong><em className={isPassing ? 'success' : 'danger'}>{isPassing ? 'Desempeño Aprobado' : 'Requiere refuerzo'}</em></article>
          <article className="kpi-emerald"><small>Materia Destacada</small><strong>{bestSubject?.average.toFixed(1) ?? '0.0'}</strong><em>{bestSubject?.subject ?? 'Sin datos'}</em></article>
          <article className="kpi-amber"><small>Materia por Reforzar</small><strong>{supportSubject?.average.toFixed(1) ?? '0.0'}</strong><em>{supportSubject?.subject ?? 'Sin datos'}</em></article>
        </section>
        <section className="grades-panel">
          <div className="panel-heading"><div><h2>Notas parciales de {student.name}</h2><p>{visibleGrades.length} evaluaciones calificadas</p></div>
            <label>Filtrar materia<select aria-label="Filtrar calificaciones por materia" value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}><option value="ALL">Todas las materias ({grades.length})</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          </div>
          <div className="table-scroll" tabIndex="0">
            <table><caption>Calificaciones de {student.name}</caption><thead><tr><th scope="col">Asignatura y Observación del Profesor</th><th scope="col">Actividad Evaluada</th><th scope="col">Peso</th><th scope="col">Fecha</th><th scope="col">Nota</th><th scope="col">Concepto</th></tr></thead>
              <tbody>{visibleGrades.map((g) => <tr key={g.id}><td><b>{g.subjectName}</b><small>{g.feedback}</small></td><td>{g.activityTitle}</td><td><span className="weight-badge">{g.weight}%</span></td><td>{g.date}</td><td className="score">{g.score.toFixed(1)}</td><td><span className={g.score >= 3 ? 'pill pass' : 'pill risk'}>{g.score >= 3 ? 'Aprobada' : 'En riesgo'}</span></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

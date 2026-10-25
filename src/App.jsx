import { useCallback, useEffect, useMemo, useState } from 'react';
import { academicApi, createTraceHeaders } from './academicApi.js';
import { adaptGradesFromApi, mockApiResponse } from './gradeAdapter.js';
import { averageBySubject, classifyAverage, filterBySubject, weightedAverage } from './gradeCalculations.js';
import './styles.css';

const POLLING_INTERVAL_MS = 30_000;
const student = {
  id: '00000000-0000-4000-8000-000000000201',
  name: 'Juan López',
  school: 'Colegio EduTrack · 8°A',
  guardian: 'María López',
};

function readAccessToken() {
  try {
    const rawSession = localStorage.getItem('edutrack_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed?.token) return parsed.token;
    }
  } catch {
    // Fall back to legacy token key
  }
  return localStorage.getItem('edutrack_token');
}

export default function App() {
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState('Periodo 2');
  const [grades, setGrades] = useState(() => adaptGradesFromApi(mockApiResponse));
  const [syncState, setSyncState] = useState({ status: 'loading', message: '', traceId: '' });

  const isEmbedded = typeof window !== 'undefined' && (window.self !== window.top || window.location.search.includes('embedded=1'));

  const loadGrades = useCallback(async (signal) => {
    const trace = createTraceHeaders();
    setSyncState((current) => ({ ...current, status: 'loading', traceId: trace.traceparent.slice(3, 19) }));
    try {
      const accessToken = readAccessToken();
      const response = await academicApi.getStudentGrades(student.id, accessToken, { signal, ...trace });
      setGrades(adaptGradesFromApi(response));
      setSyncState({ status: 'success', message: 'Datos sincronizados con Academic API.', traceId: trace.traceparent.slice(3, 19) });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setSyncState({
        status: 'error',
        message: 'Academic API no está disponible. Se conservan los datos de demostración.',
        traceId: trace.traceparent.slice(3, 19),
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadGrades(controller.signal);
    const pollingId = window.setInterval(() => loadGrades(controller.signal), POLLING_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(pollingId);
    };
  }, [loadGrades]);

  const subjects = useMemo(() => [...new Set(grades.map((grade) => grade.subjectName))], [grades]);
  const visibleGrades = useMemo(() => filterBySubject(grades, selectedSubject), [grades, selectedSubject]);
  const visibleAverage = weightedAverage(visibleGrades);
  const subjectSummaries = averageBySubject(grades);
  const bestSubject = subjectSummaries.at(0);
  const supportSubject = subjectSummaries.at(-1);
  const isPassing = classifyAverage(visibleAverage) === 'approved';

  const handleExportReport = () => {
    const lines = [
      `COLEGIO EDUTRACK — BOLETÍN ACADÉMICO OFICIAL (${selectedPeriod.toUpperCase()})`,
      `Estudiante: ${student.name} (${student.school}) | Acudiente: ${student.guardian}`,
      `Promedio Ponderado: ${visibleAverage.toFixed(1)} (${isPassing ? 'APROBADO' : 'EN RIESGO'})`,
      '------------------------------------------------------------------------',
      ...visibleGrades.map((g) => `- ${g.subjectName} | ${g.activityTitle} (${g.weight}%): ${g.score.toFixed(1)} | ${g.feedback} [${g.date}]`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boletin-${student.name.toLowerCase().replace(/\s+/g, '-')}-${selectedPeriod.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`app-shell${isEmbedded ? ' is-embedded' : ''}`}>
      {!isEmbedded && (
        <aside className="sidebar">
          <div className="brand">Edu<span>Track</span></div>
          <div className="student-card"><b>JL</b><span>{student.name}<small>{student.school}</small></span></div>
          <nav aria-label="Navegación principal">
            <span>Resumen</span><strong aria-current="page">Calificaciones</strong><span>Asistencia</span>
            <span>Mensajes</span><span>Notificaciones</span>
          </nav>
          <div className="guardian">ML <span>{student.guardian}<small>Madre / Tutora</small></span></div>
        </aside>
      )}

      <main>
        <header className="exec-header">
          <div>
            <p>PORTAL ACADÉMICO · VIGENCIA 2026-B</p>
            <h1>Calificaciones y Boletín Escolar</h1>
            <span>Seguimiento curricular de <strong>{student.name}</strong> ({student.school}) · Acudiente: {student.guardian}</span>
          </div>
          <div className="header-actions">
            <select aria-label="Seleccionar periodo académico" className="period-select" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
              <option value="Periodo 1">Periodo 1</option>
              <option value="Periodo 2">Periodo 2 (Actual)</option>
              <option value="Acumulado Anual">Acumulado Anual</option>
            </select>
            <button type="button" className="export-btn" onClick={handleExportReport}>Exportar Boletín (.txt)</button>
          </div>
        </header>

        <div className={`sync-notice ${syncState.status}`} role={syncState.status === 'error' ? 'alert' : 'status'}>
          <div>
            <b>{syncState.status === 'success' ? 'Academic API conectada' : 'Sincronización académica · Trace W3C: ' + (syncState.traceId || 'activo')}</b>
            <span>{syncState.status === 'loading' ? 'Actualizando calificaciones…' : syncState.message}</span>
          </div>
          {syncState.status === 'error' && (
            <button type="button" onClick={() => loadGrades()}>Reintentar sincronización</button>
          )}
        </div>

        <section className="summary-grid" aria-label="Resumen académico">
          <article className="kpi-primary"><small>{selectedSubject === 'ALL' ? `Promedio general (${selectedPeriod})` : `Promedio en ${selectedSubject}`}</small><strong>{visibleAverage.toFixed(1)}</strong><em className={isPassing ? 'success' : 'danger'}>{isPassing ? 'Buen desempeño académico' : 'Requiere refuerzo pedagógico'}</em></article>
          <article className="kpi-emerald"><small>Mejor desempeño</small><strong>{bestSubject?.average.toFixed(1) ?? '0.0'}</strong><em>{bestSubject?.subject ?? 'Sin datos'} · Destacado</em></article>
          <article className="kpi-amber"><small>Área por reforzar</small><strong>{supportSubject?.average.toFixed(1) ?? '0.0'}</strong><em>{supportSubject?.subject ?? 'Sin datos'} · Seguimiento</em></article>
        </section>

        <section className="grades-panel">
          <div className="panel-heading"><div><h2>Detalle de evaluaciones por asignatura</h2><p>{visibleGrades.length} calificaciones registradas en {selectedPeriod}</p></div>
            <label>Filtrar por materia<select aria-label="Filtrar calificaciones por materia" value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}>
              <option value="ALL">Todas las materias ({grades.length})</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select></label>
          </div>
          <div className="table-scroll" tabIndex="0" aria-label="Tabla de calificaciones con desplazamiento horizontal">
            <table><caption>Calificaciones de {student.name}</caption><thead><tr><th scope="col">Materia y Retroalimentación</th><th scope="col">Actividad Evaluativa</th><th scope="col">Peso</th><th scope="col">Fecha</th><th scope="col">Nota</th><th scope="col">Estado</th></tr></thead>
              <tbody>{visibleGrades.length ? visibleGrades.map((grade) => <tr key={grade.id}><td><b>{grade.subjectName}</b><small>{grade.feedback}</small></td><td>{grade.activityTitle}</td><td><span className="weight-badge">{grade.weight}%</span></td><td>{grade.date}</td><td className="score">{grade.score.toFixed(1)}</td><td><span className={grade.score >= 3 ? 'pill pass' : 'pill risk'}>{grade.score >= 3 ? 'Aprobada' : 'En riesgo'}</span></td></tr>) : <tr><td colSpan="6">No hay calificaciones para esta materia.</td></tr>}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

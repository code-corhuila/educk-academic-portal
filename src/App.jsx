import { useCallback, useEffect, useMemo, useState } from 'react';
import { academicApi, createTraceHeaders, extractShellContext, getPortalAccessToken, SHELL_ORIGIN } from './academicApi.js';
import { adaptGradesFromApi, mockApiResponse } from './gradeAdapter.js';
import { averageBySubject, classifyAverage, filterBySubject, weightedAverage } from './gradeCalculations.js';
import './styles.css';

const POLLING_INTERVAL_MS = 30_000;
const PASSING_SCORE = 3;
const FAMILY_ROLES = new Set(['ACUDIENTE', 'ESTUDIANTE']);
const WEIGHTS = { q1: 0.3, q2: 0.3, exam: 0.4 };
const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'calificaciones', label: 'Calificaciones' },
];

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

const finalScore = (s) => s.q1 * WEIGHTS.q1 + s.q2 * WEIGHTS.q2 + s.exam * WEIGHTS.exam;
const fmt = (n) => Number(n || 0).toFixed(1);

/* ───────────── Piezas de interfaz reutilizables ───────────── */

function DevPill() {
  if (!import.meta.env?.DEV) return null;
  return <span className="dev-pill">DEV · {window.location.origin}</span>;
}

function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

function PeriodSelect({ value, onChange, options }) {
  return (
    <label className="field">
      Periodo
      <select className="input" aria-label="Seleccionar periodo académico" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Kpi({ label, value, hint, tone = 'neutral' }) {
  return (
    <article className={`kpi kpi--${tone}`}>
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      <span className="kpi__hint">{hint}</span>
    </article>
  );
}

function Badge({ ok, okLabel, badLabel }) {
  return <span className={`badge ${ok ? 'badge--pass' : 'badge--risk'}`}>{ok ? okLabel : badLabel}</span>;
}

const SYNC_TITLES = {
  loading: 'Sincronizando con Academic API…',
  success: 'Academic API conectada',
  error: 'Modo contingencia · datos de demostración',
};

function SyncStatus({ state, onRetry }) {
  const { status, message, traceId } = state;
  const busy = status === 'loading';
  return (
    <div className={`sync-status sync-status--${status}`} role={status === 'error' ? 'alert' : 'status'}>
      <span className="sync-dot" aria-hidden="true" />
      <div className="sync-status__text">
        <strong>{SYNC_TITLES[status] ?? SYNC_TITLES.loading}</strong>
        {message && !busy && <span>{message}</span>}
      </div>
      {traceId && <code className="sync-trace" title={`W3C trace id: ${traceId}`}>trace {traceId.slice(0, 8)}</code>}
      <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry} disabled={busy}>
        {busy ? 'Sincronizando…' : status === 'error' ? 'Reintentar' : 'Actualizar'}
      </button>
    </div>
  );
}

function Notice({ message }) {
  if (!message) return null;
  return (
    <div className="sync-status sync-status--success" role="status">
      <span className="sync-dot" aria-hidden="true" />
      <div className="sync-status__text"><strong>{message}</strong></div>
    </div>
  );
}

/* ───────────── Aplicación ───────────── */

export default function App() {
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState('Periodo 2');
  const [tab, setTab] = useState('resumen');
  const [grades, setGrades] = useState(() => adaptGradesFromApi(mockApiResponse));
  const [roster, setRoster] = useState(INITIAL_ROSTER_10A);
  const [courses, setCourses] = useState(INITIAL_SCHOOL_COURSES);
  const [teacherForm, setTeacherForm] = useState({ studentId: 'st-3', field: 'exam', score: '3.8', feedback: 'Superó nivelación de ecuaciones.' });
  const [syncState, setSyncState] = useState({ status: 'loading', message: '', traceId: '' });
  const [notice, setNotice] = useState('');
  const [shellContext, setShellContext] = useState(null);

  const isStandalone = typeof window !== 'undefined' && window.parent === window;
  const activeRole = shellContext?.role || 'ACUDIENTE';
  const isFamily = FAMILY_ROLES.has(activeRole);

  useEffect(() => {
    if (isStandalone) return undefined;
    const handleMessage = (event) => {
      const ctx = extractShellContext(event);
      if (ctx) setShellContext(ctx);
    };
    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'edutrack:ready' }, SHELL_ORIGIN);
    return () => window.removeEventListener('message', handleMessage);
  }, [isStandalone]);

  const loadGrades = useCallback(async (signal) => {
    const token = getPortalAccessToken();
    if (!token) return;
    const trace = createTraceHeaders();
    const traceId = trace.traceparent.slice(3, 35);
    setSyncState((c) => ({ ...c, status: 'loading', traceId }));
    try {
      const response = await academicApi.getStudentGrades(student.id, token, { signal, ...trace });
      setGrades(adaptGradesFromApi(response));
      setSyncState({ status: 'success', message: 'Calificaciones actualizadas desde el API Gateway.', traceId });
    } catch (error) {
      if (error.name === 'AbortError') return;
      const cause = error.status ? `HTTP ${error.status}` : 'sin conexión con el Gateway';
      setSyncState({ status: 'error', message: `Academic API no respondió (${cause}). Se muestran datos de demostración.`, traceId });
    }
  }, []);

  // Solo los roles de consulta (acudiente / estudiante) leen el boletín desde la Academic API.
  useEffect(() => {
    if (!shellContext?.token || !isFamily) return undefined;
    const controller = new AbortController();
    loadGrades(controller.signal);
    const pollingId = window.setInterval(() => loadGrades(controller.signal), POLLING_INTERVAL_MS);
    return () => { controller.abort(); window.clearInterval(pollingId); };
  }, [loadGrades, shellContext?.token, isFamily]);

  useEffect(() => {
    if (!notice) return undefined;
    const id = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const periodGrades = useMemo(() => grades.filter((g) => (g.period ?? 'Periodo 2') === selectedPeriod), [grades, selectedPeriod]);
  const subjects = useMemo(() => [...new Set(periodGrades.map((g) => g.subjectName))], [periodGrades]);
  const visibleGrades = useMemo(() => filterBySubject(periodGrades, selectedSubject), [periodGrades, selectedSubject]);
  const periodAverage = weightedAverage(periodGrades);
  const subjectSummaries = averageBySubject(periodGrades);
  const bestSubject = subjectSummaries.at(0);
  const supportSubject = subjectSummaries.at(-1);
  const isPassing = classifyAverage(periodAverage) === 'approved';

  const handleTeacherSave = (e) => {
    e.preventDefault();
    const raw = Number(teacherForm.score);
    const num = Math.round(Math.min(5, Math.max(0, Number.isFinite(raw) ? raw : 0)) * 10) / 10;
    const target = roster.find((st) => st.id === teacherForm.studentId);
    setRoster((curr) => curr.map((st) => (st.id === teacherForm.studentId ? { ...st, [teacherForm.field]: num, feedback: teacherForm.feedback || st.feedback } : st)));
    setNotice(`Nota ${fmt(num)} registrada para ${target?.name ?? 'el estudiante'} en la planilla del curso 10°A.`);
  };

  const handleCloseActa = (courseName) => {
    setCourses((list) => list.map((x) => (x.course === courseName ? { ...x, closed: true } : x)));
    setNotice(`Acta de periodo de ${courseName} avalada y cerrada oficialmente.`);
  };

  /* ── Acceso directo (fuera del Shell) ── */
  if (isStandalone) {
    return (
      <div className="app-shell">
        <main className="portal">
          <section className="card gate">
            <p className="eyebrow">Académico</p>
            <h1 className="page-title">Acceso institucional protegido</h1>
            <p className="page-subtitle">Este módulo opera dentro del contenedor autenticado de EduTrack.</p>
            <a className="btn btn--primary" href={SHELL_ORIGIN}>Ingresar desde EduTrack</a>
          </section>
        </main>
      </div>
    );
  }

  /* ── Esperando el contexto seguro del Shell ── */
  if (!shellContext) {
    return (
      <div className="app-shell">
        <main className="portal">
          <p role="status" className="page-subtitle">Sincronizando contexto seguro con EduTrack…</p>
        </main>
      </div>
    );
  }

  /* ── Docente ── */
  if (activeRole === 'DOCENTE') {
    const courseAvg = fmt(roster.reduce((acc, s) => acc + finalScore(s), 0) / roster.length);
    const riskCount = roster.filter((s) => finalScore(s) < PASSING_SCORE).length;
    return (
      <div className="app-shell">
        <main className="portal">
          <PageHeader
            eyebrow="Académico · Docente"
            title={`Planilla de calificaciones · 10°A (${selectedPeriod})`}
            subtitle={<>Docente titular: <strong>{shellContext.user?.name || 'Prof. Carlos Ramírez'}</strong> · Matemáticas</>}
          >
            <PeriodSelect value={selectedPeriod} onChange={setSelectedPeriod} options={['Periodo 1', 'Periodo 2', 'Final']} />
          </PageHeader>

          <Notice message={notice} />

          <section className="kpi-grid" aria-label="Resumen del curso">
            <Kpi label="Promedio del curso 10°A" value={courseAvg} hint={`${roster.length} estudiantes evaluados`} tone="success" />
            <Kpi label="Estudiantes aprobados" value={roster.length - riskCount} hint="Desempeño satisfactorio" tone="neutral" />
            <Kpi label="En riesgo / nivelación" value={riskCount} hint="Requieren plan de refuerzo" tone="warning" />
          </section>

          <section className="card" aria-labelledby="calificar-titulo">
            <div className="card__head">
              <div>
                <h2 className="card__title" id="calificar-titulo">Calificar estudiante</h2>
                <p className="card__sub">Selecciona al estudiante, la evaluación y la nota (0.0 a 5.0).</p>
              </div>
            </div>
            <form className="grade-form" onSubmit={handleTeacherSave}>
              <label className="field">Estudiante
                <select className="input" value={teacherForm.studentId} onChange={(e) => setTeacherForm({ ...teacherForm, studentId: e.target.value })}>
                  {roster.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="field">Evaluación
                <select className="input" value={teacherForm.field} onChange={(e) => setTeacherForm({ ...teacherForm, field: e.target.value })}>
                  <option value="q1">Quiz 1 (30%)</option>
                  <option value="q2">Proyecto (30%)</option>
                  <option value="exam">Examen final (40%)</option>
                </select>
              </label>
              <label className="field">Nota
                <input className="input" type="number" step="0.1" min="0" max="5" value={teacherForm.score} onChange={(e) => setTeacherForm({ ...teacherForm, score: e.target.value })} required />
              </label>
              <label className="field">Concepto del docente
                <input className="input" type="text" placeholder="Observación cualitativa…" value={teacherForm.feedback} onChange={(e) => setTeacherForm({ ...teacherForm, feedback: e.target.value })} />
              </label>
              <button type="submit" className="btn btn--primary">Guardar en planilla</button>
            </form>
          </section>

          <section className="card" aria-labelledby="planilla-titulo">
            <div className="card__head">
              <div>
                <h2 className="card__title" id="planilla-titulo">Planilla consolidada · Grado 10°A</h2>
                <p className="card__sub">Ponderación oficial: Quiz 1 (30%) · Proyecto (30%) · Examen final (40%)</p>
              </div>
            </div>
            <div className="table-scroll" tabIndex="0">
              <table>
                <caption>Planilla consolidada del grado 10°A</caption>
                <thead>
                  <tr><th scope="col">Estudiante</th><th scope="col">Código</th><th scope="col">Quiz 1</th><th scope="col">Proyecto</th><th scope="col">Examen</th><th scope="col">Definitiva</th><th scope="col">Estado</th></tr>
                </thead>
                <tbody>
                  {roster.map((st) => {
                    const def = finalScore(st);
                    return (
                      <tr key={st.id}>
                        <td><span className="cell-strong">{st.name}</span><small>{st.feedback}</small></td>
                        <td className="num">{st.code}</td>
                        <td className="num">{fmt(st.q1)}</td>
                        <td className="num">{fmt(st.q2)}</td>
                        <td className="num">{fmt(st.exam)}</td>
                        <td className="score">{fmt(def)}</td>
                        <td><Badge ok={def >= PASSING_SCORE} okLabel="Aprobado" badLabel="En nivelación" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <DevPill />
        </main>
      </div>
    );
  }

  /* ── Directivo ── */
  if (activeRole === 'DIRECTIVO') {
    const totalStudents = courses.reduce((a, c) => a + c.students, 0);
    const globalAvg = fmt(courses.reduce((a, c) => a + c.avg * c.students, 0) / totalStudents);
    const approvalAvg = (courses.reduce((a, c) => a + parseFloat(c.approval), 0) / courses.length).toFixed(1);
    const riskTotal = courses.reduce((a, c) => a + c.risk, 0);
    const openActas = courses.filter((c) => !c.closed).length;
    return (
      <div className="app-shell">
        <main className="portal">
          <PageHeader
            eyebrow="Académico · Dirección"
            title="Consolidado de rendimiento por grado"
            subtitle={<>Coordinación: <strong>{shellContext.user?.name || 'Mag. Juan Pérez'}</strong> · Cierre de actas y promedios por curso</>}
          >
            <PeriodSelect value={selectedPeriod} onChange={setSelectedPeriod} options={['Periodo 1', 'Periodo 2', 'Final']} />
          </PageHeader>

          <Notice message={notice} />

          <section className="kpi-grid" aria-label="Indicadores institucionales">
            <Kpi label="Promedio global del colegio" value={globalAvg} hint={`${courses.length} grados en seguimiento`} tone="success" />
            <Kpi label="Índice de aprobación" value={`${approvalAvg}%`} hint="Meta institucional: 90%" tone={Number(approvalAvg) >= 90 ? 'success' : 'warning'} />
            <Kpi label="Estudiantes en riesgo" value={riskTotal} hint={openActas ? `${openActas} acta(s) pendiente(s) de cierre` : 'Todas las actas cerradas'} tone="warning" />
          </section>

          <section className="card" aria-labelledby="actas-titulo">
            <div className="card__head">
              <div>
                <h2 className="card__title" id="actas-titulo">Estado de actas y promedios ({selectedPeriod})</h2>
                <p className="card__sub">Control directivo de cierre de notas por docente titular</p>
              </div>
            </div>
            <div className="table-scroll" tabIndex="0">
              <table>
                <caption>Estado de actas y promedios por curso</caption>
                <thead>
                  <tr><th scope="col">Grado / curso</th><th scope="col">Director de grupo</th><th scope="col">Estudiantes</th><th scope="col">Promedio</th><th scope="col">Aprobación</th><th scope="col">En riesgo</th><th scope="col">Acta de periodo</th></tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.course}>
                      <td><span className="cell-strong">{c.course}</span><small>{c.subject}</small></td>
                      <td>{c.director}</td>
                      <td className="num">{c.students}</td>
                      <td className="score">{fmt(c.avg)}</td>
                      <td><span className="badge badge--neutral">{c.approval}</span></td>
                      <td className="num">{c.risk} est.</td>
                      <td>
                        {c.closed
                          ? <span className="badge badge--pass">Acta cerrada</span>
                          : <button type="button" className="btn btn--primary btn--sm" onClick={() => handleCloseActa(c.course)}>Avalar cierre</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <DevPill />
        </main>
      </div>
    );
  }

  /* ── Acudiente / Estudiante (consulta) ── */
  return (
    <div className="app-shell">
      <main className="portal">
        <PageHeader
          eyebrow="Académico"
          title="Calificaciones"
          subtitle={<>Rendimiento de <strong>{student.name}</strong> por materia · {student.school}{activeRole === 'ACUDIENTE' ? <> · Acudiente: <strong>{student.guardian}</strong></> : null}</>}
        >
          <PeriodSelect value={selectedPeriod} onChange={setSelectedPeriod} options={['Periodo 1', 'Periodo 2']} />
        </PageHeader>

        <SyncStatus state={syncState} onRetry={() => loadGrades()} />

        <nav className="tabs" role="tablist" aria-label="Secciones del portal académico">
          {TABS.map(({ id, label }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>

        {tab === 'resumen' ? (
          <>
            <section className="kpi-grid" aria-label="Resumen académico">
              <Kpi label={`Promedio general (${selectedPeriod})`} value={fmt(periodAverage)} hint={isPassing ? 'Buen desempeño' : 'Requiere refuerzo'} tone={isPassing ? 'success' : 'danger'} />
              <Kpi label="Mejor materia" value={fmt(bestSubject?.average)} hint={bestSubject?.subject ?? 'Sin datos'} tone="success" />
              <Kpi label="Por reforzar" value={fmt(supportSubject?.average)} hint={supportSubject?.subject ?? 'Sin datos'} tone="warning" />
            </section>

            <section className="card" aria-labelledby="promedios-titulo">
              <div className="card__head">
                <div>
                  <h2 className="card__title" id="promedios-titulo">Promedio por materia</h2>
                  <p className="card__sub">Escala de 0.0 a 5.0 · aprueba desde 3.0</p>
                </div>
              </div>
              {subjectSummaries.length === 0 ? (
                <p className="empty">No hay calificaciones registradas en este periodo.</p>
              ) : (
                <ul className="subject-list">
                  {subjectSummaries.map((s) => (
                    <li key={s.subject} className="subject-row">
                      <span className="cell-strong">{s.subject}</span>
                      <span className="bar" aria-hidden="true">
                        <span className={`bar__fill${s.average < PASSING_SCORE ? ' bar__fill--risk' : ''}`} style={{ width: `${Math.min(100, (s.average / 5) * 100)}%` }} />
                      </span>
                      <b>{fmt(s.average)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <section className="card" aria-labelledby="detalle-titulo">
            <div className="card__head">
              <div>
                <h2 className="card__title" id="detalle-titulo">Detalle por materia</h2>
                <p className="card__sub">{visibleGrades.length} calificaciones visibles</p>
              </div>
              <label className="field">Materia
                <select className="input" aria-label="Filtrar calificaciones por materia" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                  <option value="ALL">Todas las materias ({periodGrades.length})</option>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            {visibleGrades.length === 0 ? (
              <p className="empty">No hay calificaciones para mostrar.</p>
            ) : (
              <div className="table-scroll" tabIndex="0">
                <table>
                  <caption>Calificaciones de {student.name}</caption>
                  <thead>
                    <tr><th scope="col">Materia</th><th scope="col">Actividad</th><th scope="col">Peso</th><th scope="col">Fecha</th><th scope="col">Calificación</th><th scope="col">Estado</th></tr>
                  </thead>
                  <tbody>
                    {visibleGrades.map((g) => (
                      <tr key={g.id}>
                        <td><span className="cell-strong">{g.subjectName}</span><small>{g.feedback}</small></td>
                        <td>{g.activityTitle}</td>
                        <td><span className="badge badge--neutral">{g.weight}%</span></td>
                        <td className="num">{g.date}</td>
                        <td className="score">{fmt(g.score)}</td>
                        <td><Badge ok={g.score >= PASSING_SCORE} okLabel="Aprobada" badLabel="En riesgo" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        <DevPill />
      </main>
    </div>
  );
}


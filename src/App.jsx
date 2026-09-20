import React, { useState } from 'react';

export default function App() {
  const [grades, setGrades] = useState([
    { id: 'g-1', student: 'Carlos Pérez', assignment: 'Parcial 1', score: 4.5, feedback: 'Excelente sustentación' },
    { id: 'g-2', student: 'Ana Gómez', assignment: 'Parcial 1', score: 3.8, feedback: 'Buen desarrollo en taller' },
    { id: 'g-3', student: 'Luis Ramos', assignment: 'Parcial 1', score: 2.9, feedback: 'Reforzar microservicios' }
  ]);

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 800, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <h2 style={{ color: '#065f46' }}>EduTrack — Gestión Académica y Notas</h2>
      <p style={{ color: '#666', fontSize: 13 }}>Portal Docente & Boletines (HU-001) | Puerto 3002</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ background: '#f0fdf4', textAlign: 'left', borderBottom: '2px solid #a7f3d0' }}>
            <th style={{ padding: 10 }}>Estudiante</th>
            <th style={{ padding: 10 }}>Evaluación</th>
            <th style={{ padding: 10 }}>Calificación (0.0 - 5.0)</th>
            <th style={{ padding: 10 }}>Retroalimentación</th>
          </tr>
        </thead>
        <tbody>
          {grades.map(g => (
            <tr key={g.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: 10, fontWeight: 'bold' }}>{g.student}</td>
              <td style={{ padding: 10 }}>{g.assignment}</td>
              <td style={{ padding: 10, color: g.score >= 3.0 ? '#059669' : '#dc2626', fontWeight: 'bold' }}>{g.score.toFixed(1)}</td>
              <td style={{ padding: 10, color: '#4b5563', fontSize: 13 }}>{g.feedback}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

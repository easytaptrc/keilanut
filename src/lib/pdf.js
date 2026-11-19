// Exporta la dieta y la rutina a PDF con la identidad de marca.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GOALS, fullName } from './utils';
import { EXERCISE_MAP } from '../data/exercises';

const INK = [43, 42, 40];
const SAGE = [94, 111, 79];
const SOFT = [240, 243, 234];

async function loadImg(src) {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  } catch { return null; }
}

async function header(pdf, title, person) {
  const W = pdf.internal.pageSize.getWidth();
  const logo = await loadImg('/logo.png');
  if (logo) pdf.addImage(logo, 'PNG', 14, 10, 42, 28);
  pdf.setFont('times', 'normal').setFontSize(22).setTextColor(...INK);
  pdf.text(title, W - 14, 22, { align: 'right' });
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(120);
  pdf.text(`${fullName(person)}${person?.id ? ' · ID ' + person.id : ''}`, W - 14, 29, { align: 'right' });
  pdf.text(new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }), W - 14, 34, { align: 'right' });
  pdf.setDrawColor(...SAGE).setLineWidth(0.4).line(14, 42, W - 14, 42);
  return 50;
}

function footer(pdf) {
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(8).setTextColor(150);
    pdf.text('Keila Guerrero · Lic. en Nutrición', 14, H - 8);
    pdf.text(`${i} / ${n}`, W - 14, H - 8, { align: 'right' });
  }
}

function paragraph(pdf, y, label, text) {
  if (!text) return y;
  const W = pdf.internal.pageSize.getWidth();
  if (y > 260) { pdf.addPage(); y = 20; }
  pdf.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...SAGE).text(label.toUpperCase(), 14, y);
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK);
  const lines = pdf.splitTextToSize(Array.isArray(text) ? text.map((t) => '• ' + t).join('\n') : String(text), W - 28);
  pdf.text(lines, 14, y + 6);
  return y + 8 + lines.length * 4.6;
}

export async function dietPdf(diet, person) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = await header(pdf, diet.title || 'Plan de alimentación', person);
  autoTable(pdf, {
    startY: y, theme: 'plain', styles: { fontSize: 10, cellPadding: 3, textColor: INK }, headStyles: { fillColor: SOFT, textColor: SAGE, fontStyle: 'bold' },
    head: [['Calorías', 'Proteína', 'Carbohidratos', 'Grasas', 'Agua']],
    body: [[`${diet.calories || '—'} kcal`, `${diet.macros?.protein || '—'} g`, `${diet.macros?.carbs || '—'} g`, `${diet.macros?.fat || '—'} g`, `${diet.waterLiters || '—'} L`]],
  });
  y = pdf.lastAutoTable.finalY + 6;
  for (const m of diet.meals || []) {
    autoTable(pdf, {
      startY: y, theme: 'grid', styles: { fontSize: 10, cellPadding: 2.6, textColor: INK, lineColor: [231, 226, 216] },
      headStyles: { fillColor: SAGE, textColor: 255, fontStyle: 'bold' },
      head: [[`${m.name}${m.time ? '  ·  ' + m.time : ''}`, 'Cantidad']],
      body: (m.items || []).map((i) => [i.food, i.qty]),
      columnStyles: { 1: { cellWidth: 48 } },
      foot: m.notes ? [[{ content: m.notes, colSpan: 2, styles: { fontStyle: 'italic', textColor: 110, fillColor: [250, 248, 244] } }]] : undefined,
    });
    y = pdf.lastAutoTable.finalY + 5;
  }
  y = paragraph(pdf, y + 2, 'Recomendaciones', diet.recommendations?.length ? diet.recommendations : '');
  y = paragraph(pdf, y + 2, 'Evitar', diet.avoid?.length ? diet.avoid : '');
  paragraph(pdf, y + 2, 'Notas', diet.notes);
  footer(pdf);
  pdf.save(`Dieta - ${fullName(person)}.pdf`);
}

export async function routinePdf(routine, person) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = await header(pdf, routine.title || 'Rutina', person);
  pdf.setFontSize(10).setTextColor(...INK);
  pdf.text(`Objetivo: ${GOALS[routine.goal] || routine.goal || '—'}   ·   ${routine.daysPerWeek || routine.days?.length || '—'} días/semana   ·   Nivel: ${routine.level || '—'}`, 14, y);
  y += 6;
  y = paragraph(pdf, y, 'Calentamiento', routine.warmup);
  for (const d of routine.days || []) {
    autoTable(pdf, {
      startY: y, theme: 'grid', styles: { fontSize: 9.5, cellPadding: 2.4, textColor: INK, lineColor: [231, 226, 216] },
      headStyles: { fillColor: SAGE, textColor: 255 },
      head: [[d.name, 'Series', 'Reps', 'Descanso', 'Notas']],
      body: (d.exercises || []).map((x) => [EXERCISE_MAP[x.exerciseId]?.name || x.name, x.sets, x.reps, x.rest, x.notes || '']),
      columnStyles: { 1: { cellWidth: 16 }, 2: { cellWidth: 20 }, 3: { cellWidth: 22 }, 4: { cellWidth: 50 } },
      foot: d.cardio ? [[{ content: 'Cardio: ' + d.cardio, colSpan: 5, styles: { fontStyle: 'italic', textColor: 110, fillColor: [250, 248, 244] } }]] : undefined,
    });
    y = pdf.lastAutoTable.finalY + 5;
  }
  y = paragraph(pdf, y + 2, 'Enfriamiento', routine.cooldown);
  paragraph(pdf, y + 2, 'Notas', routine.notes);
  footer(pdf);
  pdf.save(`Rutina - ${fullName(person)}.pdf`);
}

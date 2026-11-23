// Horario de atención configurable por la administradora (Ajustes → Horario de citas).
import { todayISO } from './utils';

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const DEFAULT_SCHEDULE = {
  step: 60,               // duración de cada cita (min)
  maxDaysAhead: 60,       // hasta cuántos días adelante se puede reservar
  breakStart: '',         // hora de comida (opcional)
  breakEnd: '',
  blockedDates: [],       // días sin atención (vacaciones, festivos)
  week: {
    0: { on: false, start: '09:00', end: '14:00' },
    1: { on: true, start: '09:00', end: '19:00' },
    2: { on: true, start: '09:00', end: '19:00' },
    3: { on: true, start: '09:00', end: '19:00' },
    4: { on: true, start: '09:00', end: '19:00' },
    5: { on: true, start: '09:00', end: '19:00' },
    6: { on: true, start: '09:00', end: '14:00' },
  },
};

/** Acepta el formato anterior ({days, start, end, step}) y el nuevo ({week, ...}). */
export function normalizeSchedule(s) {
  const base = structuredClone(DEFAULT_SCHEDULE);
  if (!s) return base;
  const out = { ...base, ...s, week: { ...base.week } };
  if (s.week) {
    for (const k of Object.keys(base.week)) out.week[k] = { ...base.week[k], ...(s.week[k] || {}) };
  } else if (Array.isArray(s.days)) {
    for (const k of Object.keys(base.week)) {
      out.week[k] = { on: s.days.includes(Number(k)), start: s.start || '09:00', end: s.end || '19:00' };
    }
  }
  out.step = Number(out.step) || 60;
  out.maxDaysAhead = Number(out.maxDaysAhead) || 60;
  out.blockedDates = Array.isArray(out.blockedDates) ? out.blockedDates : [];
  delete out.days; delete out.start; delete out.end;
  return out;
}

const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const isoOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
}

/** ¿Se atiende ese día? (día laboral, no bloqueado, dentro del rango permitido) */
export function isDayOpen(iso, schedule) {
  const s = normalizeSchedule(schedule);
  if (!iso || iso < todayISO() || iso > addDaysISO(todayISO(), s.maxDaysAhead)) return false;
  if (s.blockedDates.includes(iso)) return false;
  return !!s.week[new Date(iso + 'T00:00:00').getDay()]?.on;
}

/** Todas las horas de inicio de cita de ese día (sin considerar las ocupadas). */
export function slotsFor(iso, schedule) {
  const s = normalizeSchedule(schedule);
  if (!isDayOpen(iso, s)) return [];
  const day = s.week[new Date(iso + 'T00:00:00').getDay()];
  const bS = s.breakStart && s.breakEnd ? toMin(s.breakStart) : null;
  const bE = bS != null ? toMin(s.breakEnd) : null;
  const out = [];
  for (let m = toMin(day.start); m + s.step <= toMin(day.end); m += s.step) {
    if (bS != null && m < bE && m + s.step > bS) continue; // se cruza con la hora de comida
    out.push(toHHMM(m));
  }
  if (iso === todayISO()) {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes() + 60; // al menos 1 h de anticipación
    return out.filter((t) => toMin(t) > cur);
  }
  return out;
}

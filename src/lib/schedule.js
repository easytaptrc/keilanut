// Horario de atención configurable por la administradora (Ajustes → Horario de citas).
// Cada día puede tener uno o varios turnos (ej. mañana 7:00–9:00 y tarde 17:30–19:30).
import { todayISO } from './utils';

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const SCHEDULE_VERSION = 3;

const SHIFTS = () => [{ start: '07:00', end: '09:00' }, { start: '17:30', end: '19:30' }];

export const DEFAULT_SCHEDULE = {
  version: SCHEDULE_VERSION,
  step: 60,               // duración de cada cita (min)
  maxDaysAhead: 60,       // hasta cuántos días adelante se puede reservar
  minNoticeHours: 2,      // anticipación mínima para reservar el mismo día
  blockedDates: [],       // días sin atención (vacaciones, festivos)
  week: {
    0: { on: false, shifts: SHIFTS() },
    1: { on: true, shifts: SHIFTS() },
    2: { on: true, shifts: SHIFTS() },
    3: { on: true, shifts: SHIFTS() },
    4: { on: true, shifts: SHIFTS() },
    5: { on: true, shifts: SHIFTS() },
    6: { on: false, shifts: SHIFTS() },
  },
};

const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const isoOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Horarios guardados con un formato anterior se reemplazan por el horario vigente (7–9 y 17:30–19:30). */
export function normalizeSchedule(s) {
  const base = structuredClone(DEFAULT_SCHEDULE);
  if (!s) return base;
  const out = { ...base, maxDaysAhead: Number(s.maxDaysAhead) || base.maxDaysAhead, blockedDates: Array.isArray(s.blockedDates) ? s.blockedDates : [] };
  if (s.version === SCHEDULE_VERSION && s.week) {
    out.step = Number(s.step) || 60;
    out.minNoticeHours = s.minNoticeHours ?? base.minNoticeHours;
    for (const k of Object.keys(base.week)) {
      const d = s.week[k] || {};
      out.week[k] = { on: !!d.on, shifts: Array.isArray(d.shifts) ? d.shifts.filter((x) => x?.start && x?.end) : base.week[k].shifts };
    }
  }
  return out;
}

export function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isDayOpen(iso, schedule) {
  const s = normalizeSchedule(schedule);
  if (!iso || iso < todayISO() || iso > addDaysISO(todayISO(), s.maxDaysAhead)) return false;
  if (s.blockedDates.includes(iso)) return false;
  const day = s.week[new Date(iso + 'T00:00:00').getDay()];
  return !!day?.on && day.shifts.length > 0;
}

/** Horas de inicio de cita de ese día (sin descontar las ocupadas). */
export function slotsFor(iso, schedule) {
  const s = normalizeSchedule(schedule);
  if (!isDayOpen(iso, s)) return [];
  const day = s.week[new Date(iso + 'T00:00:00').getDay()];
  const out = [];
  for (const sh of day.shifts) {
    for (let m = toMin(sh.start); m + s.step <= toMin(sh.end); m += s.step) out.push(toHHMM(m));
  }
  out.sort();
  if (iso === todayISO()) {
    const now = new Date();
    const limit = now.getHours() * 60 + now.getMinutes() + (Number(s.minNoticeHours) || 0) * 60;
    return [...new Set(out.filter((t) => toMin(t) >= limit))];
  }
  return [...new Set(out)];
}

export const shiftLabel = (sh) => `${sh.start} – ${sh.end}`;

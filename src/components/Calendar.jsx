import { useMemo, useState } from 'react';
import { addDaysISO, isDayOpen, isoOf, normalizeSchedule, slotsFor } from '../lib/schedule';
import { cx, todayISO } from '../lib/utils';
import { Icon } from './ui';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Calendario mensual. Solo se pueden elegir los días que la administradora atiende
 * y que todavía tienen al menos una hora libre.
 * takenByDate: { 'YYYY-MM-DD': ['10:00', ...] }
 */
export default function Calendar({ schedule, value, onChange, takenByDate = {}, onMonthChange }) {
  const s = useMemo(() => normalizeSchedule(schedule), [schedule]);
  const today = todayISO();
  const last = addDaysISO(today, s.maxDaysAhead);
  const start = value || today;
  const [ym, setYm] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));

  const go = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    const next = { y: d.getFullYear(), m: d.getMonth() };
    setYm(next);
    onMonthChange?.(next);
  };

  const firstDow = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const canPrev = isoOf(ym.y, ym.m, 1) > today.slice(0, 8) + '01' || false;
  const canNext = isoOf(ym.y, ym.m, daysInMonth) < last;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoOf(ym.y, ym.m, d);
    const open = isDayOpen(iso, s);
    const free = open ? slotsFor(iso, s).filter((t) => !(takenByDate[iso] || []).includes(t)).length : 0;
    cells.push({ d, iso, open, free });
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => go(-1)} disabled={!canPrev} aria-label="Mes anterior"><Icon name="arrowL" size={18} /></button>
        <b className="serif">{MONTHS[ym.m]} {ym.y}</b>
        <button type="button" className="icon-btn" onClick={() => go(1)} disabled={!canNext} aria-label="Mes siguiente"><Icon name="arrowR" size={18} /></button>
      </div>
      <div className="cal-grid cal-week">{WEEK.map((w, i) => <span key={i}>{w}</span>)}</div>
      <div className="cal-grid">
        {cells.map((c, i) => c === null ? <span key={'e' + i} /> : (
          <button
            type="button"
            key={c.iso}
            className={cx('cal-day', c.iso === value && 'on', c.iso === today && 'today', c.open && c.free > 0 && 'avail', c.open && c.free === 0 && 'full')}
            disabled={!c.open || c.free === 0}
            onClick={() => onChange(c.iso)}
            aria-label={`${c.d} de ${MONTHS[ym.m]}${c.open ? (c.free ? `, ${c.free} horarios libres` : ', lleno') : ', sin atención'}`}
          >
            {c.d}
            {c.open && c.free > 0 && <i />}
          </button>
        ))}
      </div>
      <div className="cal-legend tiny muted">
        <span><i className="dot avail" /> Disponible</span>
        <span><i className="dot full" /> Lleno</span>
        <span><i className="dot off" /> Sin atención</span>
      </div>
    </div>
  );
}

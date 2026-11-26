// Días, turnos, duración y bloqueos del calendario de citas.
import { useState } from 'react';
import { Field, Icon, useToast } from '../../../components/ui';
import { DAY_NAMES, SCHEDULE_VERSION, normalizeSchedule } from '../../../lib/schedule';
import { cx, fmtDate, todayISO } from '../../../lib/utils';
import { SaveBar, savePart } from './shared';

export default function ScheduleSettings({ pub }) {
  const toast = useToast();
  const [sch, setSchState] = useState(() => normalizeSchedule(pub.schedule));
  const [blockDay, setBlockDay] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const setSch = (patch) => { setSchState((s) => ({ ...s, ...patch })); setDirty(true); };

  const save = async () => {
    const bad = Object.values(sch.week).some((d) => d.on && d.shifts.some((x) => !x.start || !x.end || x.start >= x.end));
    if (bad) return toast('Revisa los turnos: la hora de inicio debe ser antes que la de fin.', 'err');
    if (!Object.values(sch.week).some((d) => d.on && d.shifts.length)) return toast('Activa al menos un día con un turno.', 'err');
    setBusy(true);
    try {
      await savePart('public', { schedule: { ...sch, version: SCHEDULE_VERSION, blockedDates: sch.blockedDates.filter((x) => x >= todayISO()) } });
      setDirty(false); toast('Horario guardado', 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Días y turnos</h4>
        <p className="small muted" style={{ margin: 0 }}>Activa los días que trabajas y sus turnos (por ejemplo, mañana de 7:00 a 9:00 y tarde de 17:30 a 19:30). El calendario de reservaciones solo mostrará esos días y horas; cada hora reservada desaparece para los demás.</p>
        <div className="stack" style={{ gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 0].map((i) => {
            const d = sch.week[i];
            const upd = (patch) => setSch({ week: { ...sch.week, [i]: { ...d, ...patch } } });
            const updShift = (k, patch) => upd({ shifts: d.shifts.map((x, j) => (j === k ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className={cx('day-shifts', !d.on && 'off')}>
                <button type="button" className={cx('opt', d.on && 'on')} onClick={() => upd({ on: !d.on, shifts: d.shifts.length ? d.shifts : [{ start: '09:00', end: '13:00' }] })}>{DAY_NAMES[i]}</button>
                {d.on && (
                  <div className="stack" style={{ gap: 6, flex: 1, minWidth: 0 }}>
                    {d.shifts.map((sh, k) => (
                      <div key={k} className="shift-row">
                        <span className="tiny muted">Turno {k + 1}</span>
                        <input className="input sm" type="time" value={sh.start} onChange={(e) => updShift(k, { start: e.target.value })} aria-label={`${DAY_NAMES[i]} desde`} />
                        <input className="input sm" type="time" value={sh.end} onChange={(e) => updShift(k, { end: e.target.value })} aria-label={`${DAY_NAMES[i]} hasta`} />
                        <button type="button" className="btn link xs" style={{ color: 'var(--danger)' }} onClick={() => upd({ shifts: d.shifts.filter((_, j) => j !== k) })} aria-label="Quitar turno"><Icon name="x" size={16} /></button>
                      </div>
                    ))}
                    {d.shifts.length < 4 && <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => upd({ shifts: [...d.shifts, { start: '12:00', end: '14:00' }] })}>+ Agregar turno</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Reglas de reservación</h4>
        <div className="grid g2">
          <Field label="Duración de cada cita"><select className="select" value={sch.step} onChange={(e) => setSch({ step: Number(e.target.value) })}>{[20, 30, 40, 45, 50, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</select></Field>
          <Field label="Se puede reservar con hasta"><select className="select" value={sch.maxDaysAhead} onChange={(e) => setSch({ maxDaysAhead: Number(e.target.value) })}>{[7, 14, 21, 30, 45, 60, 90, 180].map((m) => <option key={m} value={m}>{m} días de anticipación</option>)}</select></Field>
          <Field label="Anticipación mínima"><select className="select" value={sch.minNoticeHours} onChange={(e) => setSch({ minNoticeHours: Number(e.target.value) })}>{[0, 1, 2, 3, 6, 12, 24, 48].map((m) => <option key={m} value={m}>{m} h antes</option>)}</select></Field>
        </div>
      </div>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Días sin atención (vacaciones, festivos)</h4>
        <div className="row nowrap">
          <input className="input sm grow" type="date" min={todayISO()} value={blockDay} onChange={(e) => setBlockDay(e.target.value)} aria-label="Día a bloquear" />
          <button type="button" className="btn light sm" disabled={!blockDay} onClick={() => { if (!sch.blockedDates.includes(blockDay)) setSch({ blockedDates: [...sch.blockedDates, blockDay].sort() }); setBlockDay(''); }}>Bloquear</button>
        </div>
        {sch.blockedDates.filter((x) => x >= todayISO()).length > 0 ? (
          <div className="chip-list">
            {sch.blockedDates.filter((x) => x >= todayISO()).map((x) => (
              <button type="button" key={x} className="badge danger" onClick={() => setSch({ blockedDates: sch.blockedDates.filter((y) => y !== x) })} title="Quitar">{fmtDate(x)} ✕</button>
            ))}
          </div>
        ) : <p className="tiny muted" style={{ margin: 0 }}>No hay días bloqueados.</p>}
      </div>
      <SaveBar onSave={save} busy={busy} dirty={dirty} />
    </div>
  );
}

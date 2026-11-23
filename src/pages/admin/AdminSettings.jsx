import { useEffect, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useDoc } from '../../lib/hooks';
import { Field, Icon, useToast } from '../../components/ui';
import { DAY_NAMES, normalizeSchedule } from '../../lib/schedule';
import { DEFAULT_MODEL, SERVICES, cx, fmtDate, money, todayISO } from '../../lib/utils';

const DAYS = DAY_NAMES;

export default function AdminSettings() {
  const toast = useToast();
  const pub = useDoc('settings/public');
  const adm = useDoc('settings/admin');
  const [p, setP] = useState(null);
  const [a, setA] = useState(null);
  const [pw, setPw] = useState({ cur: '', next: '' });
  const [showKey, setShowKey] = useState(false);
  const [blockDay, setBlockDay] = useState('');

  useEffect(() => { if (!p && !pub.loading) setP({ whatsapp: '', instagram: '', address: '', ...(pub.data || {}), schedule: normalizeSchedule(pub.data?.schedule) }); }, [pub.loading]); // eslint-disable-line
  useEffect(() => { if (!a && !adm.loading) setA({ prices: { online: 500, presencial: 500 }, anthropicKey: '', model: DEFAULT_MODEL, ...(adm.data || {}) }); }, [adm.loading]); // eslint-disable-line
  if (!p || !a) return <div className="skeleton" style={{ height: 300 }} />;

  const savePub = async () => {
    const { id, ...rest } = p; // eslint-disable-line no-unused-vars
    try { await setDoc(doc(db, 'settings', 'public'), rest, { merge: true }); toast('Guardado', 'ok'); } catch (e) { toast(e.message, 'err'); }
  };
  const saveAdm = async () => {
    const { id, ...rest } = a; // eslint-disable-line no-unused-vars
    try { await setDoc(doc(db, 'settings', 'admin'), { ...rest, anthropicKey: (rest.anthropicKey || '').trim() }, { merge: true }); toast('Guardado', 'ok'); } catch (e) { toast(e.message, 'err'); }
  };
  const sch = p.schedule;
  const setSch = (patch) => setP({ ...p, schedule: { ...sch, ...patch } });

  const changePw = async (e) => {
    e.preventDefault();
    if (pw.next.length < 8) return toast('Mínimo 8 caracteres', 'err');
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw.cur));
      await updatePassword(auth.currentUser, pw.next);
      setPw({ cur: '', next: '' }); toast('Contraseña actualizada', 'ok');
    } catch (er) { toast(er.code === 'auth/invalid-credential' ? 'Contraseña actual incorrecta' : er.message, 'err'); }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Ajustes</h1></div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <div className="card-title" style={{ margin: 0 }}><h4>Precios de referencia</h4><span className="badge plain">Privado</span></div>
          <p className="small muted" style={{ margin: 0 }}>Solo tú los ves. Los pacientes solo ven el tipo de servicio.</p>
          <div className="grid g2">
            {Object.entries(SERVICES).map(([k, s]) => (
              <Field key={k} label={s.label}><input className="input" inputMode="numeric" value={a.prices?.[k] ?? ''} onChange={(e) => setA({ ...a, prices: { ...a.prices, [k]: Number(e.target.value) || 0 } })} /></Field>
            ))}
          </div>
          <div className="small muted">{Object.entries(SERVICES).map(([k, s]) => `${s.short}: ${money(a.prices?.[k])}`).join(' · ')}</div>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={saveAdm}>Guardar precios</button>
        </div>

        <div className="card stack">
          <h4 style={{ margin: 0 }}><Icon name="sparkle" size={18} /> Inteligencia artificial (Claude)</h4>
          <p className="small muted" style={{ margin: 0 }}>Pega tu llave de API de Anthropic (console.anthropic.com → API Keys). Se guarda protegida y solo tu cuenta puede leerla.</p>
          <Field label="Llave de API">
            <div className="row nowrap">
              <input className="input grow" type={showKey ? 'text' : 'password'} value={a.anthropicKey || ''} onChange={(e) => setA({ ...a, anthropicKey: e.target.value })} placeholder="sk-ant-…" autoComplete="off" />
              <button type="button" className="icon-btn" onClick={() => setShowKey(!showKey)} aria-label="Mostrar"><Icon name="eye" size={18} /></button>
            </div>
          </Field>
          <Field label="Modelo" hint={`Recomendado: ${DEFAULT_MODEL}`}><input className="input" value={a.model || ''} onChange={(e) => setA({ ...a, model: e.target.value })} /></Field>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={saveAdm}>Guardar</button>
        </div>

        <div className="card stack">
          <h4 style={{ margin: 0 }}>Horario de citas</h4>
          <p className="small muted" style={{ margin: 0 }}>Activa los días que trabajas y de qué hora a qué hora. El calendario de reservaciones solo mostrará esos días y horas; cada hora reservada desaparece para los demás.</p>
          <div className="stack" style={{ gap: 8 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((i) => {
              const d = sch.week[i];
              const upd = (patch) => setSch({ week: { ...sch.week, [i]: { ...d, ...patch } } });
              return (
                <div key={i} className={cx('week-row', !d.on && 'off')}>
                  <button type="button" className={cx('opt', d.on && 'on')} onClick={() => upd({ on: !d.on })}>{DAYS[i]}</button>
                  <input className="input sm" type="time" value={d.start} disabled={!d.on} onChange={(e) => upd({ start: e.target.value })} aria-label={`${DAYS[i]} desde`} />
                  <input className="input sm" type="time" value={d.end} disabled={!d.on} onChange={(e) => upd({ end: e.target.value })} aria-label={`${DAYS[i]} hasta`} />
                </div>
              );
            })}
          </div>
          <div className="grid g2">
            <Field label="Duración de cada cita"><select className="select" value={sch.step} onChange={(e) => setSch({ step: Number(e.target.value) })}>{[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</select></Field>
            <Field label="Reservar con hasta"><select className="select" value={sch.maxDaysAhead} onChange={(e) => setSch({ maxDaysAhead: Number(e.target.value) })}>{[14, 30, 60, 90, 180].map((m) => <option key={m} value={m}>{m} días de anticipación</option>)}</select></Field>
            <Field label="Hora de comida (sin citas) desde"><input className="input" type="time" value={sch.breakStart} onChange={(e) => setSch({ breakStart: e.target.value })} /></Field>
            <Field label="Hasta"><input className="input" type="time" value={sch.breakEnd} onChange={(e) => setSch({ breakEnd: e.target.value })} /></Field>
          </div>
          <Field label="Días sin atención (vacaciones, festivos)">
            <div className="row nowrap">
              <input className="input sm grow" type="date" min={todayISO()} value={blockDay} onChange={(e) => setBlockDay(e.target.value)} />
              <button type="button" className="btn light sm" disabled={!blockDay} onClick={() => { if (!sch.blockedDates.includes(blockDay)) setSch({ blockedDates: [...sch.blockedDates, blockDay].sort() }); setBlockDay(''); }}>Bloquear</button>
            </div>
          </Field>
          {sch.blockedDates.filter((x) => x >= todayISO()).length > 0 && (
            <div className="chip-list">
              {sch.blockedDates.filter((x) => x >= todayISO()).map((x) => (
                <button type="button" key={x} className="badge danger" onClick={() => setSch({ blockedDates: sch.blockedDates.filter((y) => y !== x) })} title="Quitar">{fmtDate(x)} ✕</button>
              ))}
            </div>
          )}
          <h4 style={{ margin: '10px 0 0' }}>Contacto público</h4>
          <div className="grid g2">
            <Field label="WhatsApp (10 dígitos)"><input className="input" value={p.whatsapp} onChange={(e) => setP({ ...p, whatsapp: e.target.value })} /></Field>
            <Field label="Instagram"><input className="input" value={p.instagram} onChange={(e) => setP({ ...p, instagram: e.target.value })} placeholder="@keilanutri" /></Field>
            <Field label="Dirección del consultorio" className="span2"><input className="input" value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} /></Field>
          </div>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={savePub}>Guardar horario y contacto</button>
        </div>

        <form className="card stack" onSubmit={changePw}>
          <h4 style={{ margin: 0 }}>Mi cuenta</h4>
          <div className="small muted">{auth.currentUser?.email}</div>
          <Field label="Contraseña actual"><input className="input" type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} autoComplete="current-password" /></Field>
          <Field label="Nueva contraseña"><input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></Field>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }}>Cambiar contraseña</button>
        </form>
      </div>
    </div>
  );
}

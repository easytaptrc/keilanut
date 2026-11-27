// Recepción y equipo: cuentas que ven la agenda y agendan citas (sin acceso a expedientes, historiales ni precios).
import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { deleteDoc, doc, orderBy, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../../firebase';
import { useCol } from '../../../lib/hooks';
import { createStaffAccount } from '../../../lib/admin';
import { Badge, Field, Icon, Modal, Spinner, useToast } from '../../../components/ui';
import { cx, fmtDate, waLink } from '../../../lib/utils';
import { Toggle } from './shared';
import '../../../reception.css';

const rebuild = () => httpsCallable(functions, 'rebuildAgenda', { timeout: 300000 })();

export default function StaffSettings() {
  const toast = useToast();
  const { list, loading } = useCol('staff', () => [orderBy('createdAt', 'desc')], 'staff-list');
  const [f, setF] = useState({ name: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [cred, setCred] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const sync = async (silent) => {
    setSyncing(true);
    try { const r = await rebuild(); if (!silent) toast(`Agenda actualizada: ${r.data.bookings} citas y ${r.data.members} pacientes`, 'ok'); }
    catch (e) { if (!silent) toast(e.message, 'err'); else console.warn('rebuildAgenda', e); }
    finally { setSyncing(false); }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return toast('Escribe el nombre.', 'err');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return toast('Escribe un correo válido.', 'err');
    setBusy(true);
    try {
      const r = await createStaffAccount(f);
      setCred({ name: f.name.trim(), email: f.email.trim().toLowerCase(), password: r.password });
      setF({ name: '', email: '' });
      if (!list.length) sync(true); // primera cuenta: llena la agenda con las citas existentes
    } catch (er) {
      toast(er.code === 'auth/email-already-in-use' ? 'Ese correo ya tiene una cuenta. Usa otro correo.' : er.code === 'auth/invalid-email' ? 'Correo no válido.' : er.message, 'err');
    } finally { setBusy(false); }
  };

  const setActive = async (s, active) => {
    try { await updateDoc(doc(db, 'staff', s.id), { active }); toast(active ? 'Cuenta activada' : 'Cuenta desactivada: ya no puede entrar a la agenda', 'ok'); } catch (e) { toast(e.message, 'err'); }
  };
  const remove = async (s) => {
    if (!window.confirm(`¿Quitar el acceso de ${s.name}? Ya no podrá entrar a la agenda.`)) return;
    try { await deleteDoc(doc(db, 'staff', s.id)); toast('Acceso eliminado', 'ok'); } catch (e) { toast(e.message, 'err'); }
  };
  const reset = async (s) => {
    try { await sendPasswordResetEmail(auth, s.email); toast(`Enviamos un correo a ${s.email} para crear una contraseña nueva`, 'ok'); } catch (e) { toast(e.message, 'err'); }
  };

  const loginUrl = `${location.origin}/admin`;
  const msg = cred && `Hola ${cred.name} 🌿 Ya tienes acceso a la agenda del consultorio de Keila Guerrero.\n\nEntra en: ${loginUrl}\nCorreo: ${cred.email}\nContraseña: ${cred.password}\n\nAhí puedes ver, agendar, confirmar y cancelar citas.`;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="notice small">
        Da de alta a tu recepcionista para que vea la <b>agenda</b>, agende citas nuevas, confirme y cancele. <b>No puede ver</b> expedientes, historial clínico, planes, fotos ni precios.
        Entra en <b>{loginUrl}</b> con su correo y contraseña.
      </div>

      <form className="card stack" onSubmit={create}>
        <h4 style={{ margin: 0 }}>Nueva cuenta de recepción</h4>
        <div className="grid g2">
          <Field label="Nombre"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} placeholder="Ej. Ana López" /></Field>
          <Field label="Correo con el que entrará"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} maxLength={160} autoComplete="off" /></Field>
        </div>
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={busy}>{busy ? <Spinner /> : <Icon name="plus" size={16} />} Crear acceso</button>
      </form>

      <div className="card stack">
        <div className="row between">
          <h4 style={{ margin: 0 }}>Cuentas ({list.length})</h4>
          <button type="button" className="btn light xs" disabled={syncing} onClick={() => sync(false)}>{syncing ? <Spinner /> : <Icon name="calendar" size={14} />} Actualizar agenda de recepción</button>
        </div>
        {loading ? <div className="skeleton" style={{ height: 60 }} /> : !list.length ? <p className="small muted" style={{ margin: 0 }}>Aún no hay cuentas de recepción.</p> : list.map((s) => (
          <div key={s.id} className={cx('card flat staff-row', s.active === false && 'off')}>
            <span className="avatar"><Icon name="user" /></span>
            <div className="grow" style={{ minWidth: 0 }}>
              <b className="small">{s.name}</b>
              <div className="tiny muted" style={{ overflowWrap: 'anywhere' }}>{s.email}{s.createdAt ? ` · desde ${fmtDate(s.createdAt)}` : ''}</div>
            </div>
            <Badge tone={s.active === false ? 'danger' : 'ok'}>{s.active === false ? 'Desactivada' : 'Activa'}</Badge>
            <div className="row" style={{ gap: 6 }}>
              <Toggle small label="Acceso" checked={s.active !== false} onChange={(v) => setActive(s, v)} />
              <button type="button" className="btn link xs" onClick={() => reset(s)}>Restablecer contraseña</button>
              <button type="button" className="icon-btn sm danger" onClick={() => remove(s)} aria-label={`Quitar acceso de ${s.name}`}><Icon name="trash" size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      {cred && (
        <Modal title="Acceso creado" onClose={() => setCred(null)}
          footer={<button className="btn" onClick={() => setCred(null)}>Listo</button>}>
          <div className="stack">
            <p className="small" style={{ margin: 0 }}>Comparte estos datos con <b>{cred.name}</b>. La contraseña solo se muestra esta vez.</p>
            <div className="cred-box">
              <div className="k">Entra en</div><div className="v" style={{ fontSize: '1rem', overflowWrap: 'anywhere' }}>{loginUrl}</div>
              <div className="k">Correo</div><div className="v" style={{ fontSize: '1rem', overflowWrap: 'anywhere' }}>{cred.email}</div>
              <div className="k">Contraseña</div><div className="v">{cred.password}</div>
            </div>
            <div className="row">
              <button className="btn light sm" onClick={() => navigator.clipboard.writeText(msg).then(() => toast('Copiado', 'ok'))}><Icon name="copy" size={16} /> Copiar mensaje</button>
              <a className="btn sage sm" href={waLink('', msg)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} /> Enviar por WhatsApp</a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

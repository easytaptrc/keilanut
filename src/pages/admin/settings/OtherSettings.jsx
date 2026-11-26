// Panel del paciente, inteligencia artificial, cuenta y respaldo de datos.
import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { collection, deleteField, doc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../../../firebase';
import { Field, Icon, Spinner, useToast } from '../../../components/ui';
import { DEFAULT_AI, TEAM_MODULES, mergeAI, mergeTeam } from '../../../lib/config';
import { DEFAULT_MODEL, todayISO } from '../../../lib/utils';
import { SaveBar, Toggle, savePart } from './shared';

export function TeamSettings({ pub }) {
  const toast = useToast();
  const [t, setT] = useState(() => mergeTeam(pub.team));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const upd = (patch) => { setT((x) => ({ ...x, ...patch })); setDirty(true); };
  const save = async () => {
    setBusy(true);
    try { await savePart('public', { team: { ...t, reviewWeeks: Number(t.reviewWeeks) || 3, reminderDaysBefore: Number(t.reminderDaysBefore) || 0 } }); setDirty(false); toast('Panel del paciente guardado', 'ok'); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Secciones de la app del paciente</h4>
        <p className="small muted" style={{ margin: 0 }}>Apaga lo que no quieras que vean tus pacientes. Inicio, Perfil y Avisos siempre están visibles.</p>
        <div className="stack" style={{ gap: 10 }}>
          {Object.entries(TEAM_MODULES).map(([k, l]) => <Toggle key={k} label={l} checked={t.modules[k] !== false} onChange={(v) => upd({ modules: { ...t.modules, [k]: v } })} />)}
        </div>
      </div>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Revisiones</h4>
        <div className="grid g2">
          <Field label="Revisión cada" hint="Se usa para calcular la próxima revisión al aceptar una cita o terminar una consulta.">
            <select className="select" value={t.reviewWeeks} onChange={(e) => upd({ reviewWeeks: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 8, 12].map((w) => <option key={w} value={w}>{w} semana{w > 1 ? 's' : ''}</option>)}</select>
          </Field>
          <Field label="Avisar al paciente" hint="Notificación automática (9:00 a. m.) si todavía no reserva.">
            <select className="select" value={t.reminderDaysBefore} onChange={(e) => upd({ reminderDaysBefore: Number(e.target.value) })}>{[0, 1, 2, 3, 4, 5, 7].map((d) => <option key={d} value={d}>{d ? `${d} día${d > 1 ? 's' : ''} antes y el día que le toca` : 'Solo el día que le toca'}</option>)}</select>
          </Field>
        </div>
        <Toggle label="Enviar recordatorios automáticos de revisión" checked={t.reminders !== false} onChange={(v) => upd({ reminders: v })} />
      </div>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Mensaje de bienvenida</h4>
        <Field label="Aparece en el Inicio de la app de cada paciente (opcional)"><textarea className="textarea" rows={3} value={t.welcomeText || ''} onChange={(e) => upd({ welcomeText: e.target.value })} placeholder="Ej. ¡Bienvenida al Team! Recuerda registrar tus comidas todos los días." /></Field>
      </div>
      <SaveBar onSave={save} busy={busy} dirty={dirty} />
    </div>
  );
}

export function AISettings({ adm }) {
  const toast = useToast();
  const [key, setKey] = useState('');
  const hasKey = !!(adm.aiKeySet || adm.anthropicKey);
  const [model, setModel] = useState(adm.model || DEFAULT_MODEL);
  const [ai, setAi] = useState(() => mergeAI(adm.ai));
  const [show, setShow] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const upd = (patch) => { setAi((x) => ({ ...x, ...patch })); setDirty(true); };
  const save = async () => {
    setBusy(true);
    try {
      const k = key.trim();
      if (k && !/^sk-ant-/.test(k)) { setBusy(false); return toast('La llave debe empezar con sk-ant-', 'err'); }
      // La llave se guarda en una zona que nadie puede leer desde el navegador; solo la usa el servidor
      if (k) await setDoc(doc(db, 'secrets', 'anthropic'), { key: k });
      const patch = { model: model.trim() || DEFAULT_MODEL, ai };
      if (k) Object.assign(patch, { aiKeySet: true, aiKeyHint: `…${k.slice(-4)}` });
      if (k || adm.anthropicKey) patch.anthropicKey = deleteField();
      if (!k && adm.anthropicKey) { await setDoc(doc(db, 'secrets', 'anthropic'), { key: adm.anthropicKey }); Object.assign(patch, { aiKeySet: true, aiKeyHint: `…${adm.anthropicKey.slice(-4)}` }); }
      await savePart('admin', patch);
      setKey(''); setDirty(false); toast('Ajustes de IA guardados', 'ok');
    }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack">
        <h4 style={{ margin: 0 }}><Icon name="sparkle" size={18} /> Conexión con Claude</h4>
        <p className="small muted" style={{ margin: 0 }}>Tu llave de API de Anthropic (console.anthropic.com → API Keys). Se guarda protegida en el servidor: nadie puede leerla desde el navegador, ni siquiera tu panel.</p>
        {hasKey && <div className="notice small"><Icon name="check" size={14} /> Llave guardada {adm.aiKeyHint || ''}. Escribe una nueva solo si quieres cambiarla.</div>}
        {adm.anthropicKey && <div className="notice small">Tu llave está guardada con el método anterior. Toca <b>Guardar cambios</b> para protegerla en el servidor.</div>}
        <Field label={hasKey ? 'Cambiar llave de API' : 'Llave de API'}>
          <div className="row nowrap">
            <input className="input grow" type={show ? 'text' : 'password'} value={key} onChange={(e) => { setKey(e.target.value); setDirty(true); }} placeholder="sk-ant-…" autoComplete="off" />
            <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label="Mostrar u ocultar la llave"><Icon name="eye" size={18} /></button>
          </div>
        </Field>
        <Field label="Modelo" hint={`Recomendado: ${DEFAULT_MODEL}`}><input className="input" value={model} onChange={(e) => { setModel(e.target.value); setDirty(true); }} /></Field>
      </div>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Cómo arma los planes</h4>
        <div className="grid g2">
          <Field label="Días de la dieta" hint="Cuando el plan base no usa “Opción 1/2/3”."><select className="select" value={ai.days} onChange={(e) => upd({ days: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} día{d > 1 ? 's' : ''}</option>)}</select></Field>
          <Field label="Opciones por comida" hint="Máximo de opciones en “Elige solo una opción…”."><select className="select" value={ai.maxOptions} onChange={(e) => upd({ maxOptions: Number(e.target.value) })}>{[1, 2, 3, 4].map((d) => <option key={d} value={d}>{d} opci{d > 1 ? 'ones' : 'ón'}</option>)}</select></Field>
          <Field label="Secciones por platillo" hint="Utilizar, acompañar, toppings…"><select className="select" value={ai.maxSectionsPerMeal} onChange={(e) => upd({ maxSectionsPerMeal: Number(e.target.value) })}>{[2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
        </div>
        <Field label="Tus reglas para la IA (opcional)" hint="Ej. Nunca uses atún en la cena. Usa porciones en gramos. Siempre incluye agua de jamaica como tip.">
          <textarea className="textarea" rows={5} value={ai.extraInstructions || ''} onChange={(e) => upd({ extraInstructions: e.target.value })} maxLength={4000} />
        </Field>
        <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => { setAi({ ...DEFAULT_AI }); setDirty(true); }}>Restaurar valores recomendados</button>
      </div>
      <SaveBar onSave={save} busy={busy} dirty={dirty} />
    </div>
  );
}

const plain = (v) => {
  if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

export function AccountSettings() {
  const toast = useToast();
  const [pw, setPw] = useState({ cur: '', next: '', next2: '' });
  const [prog, setProg] = useState('');
  const changePw = async (e) => {
    e.preventDefault();
    if (pw.next.length < 8) return toast('La nueva contraseña debe tener mínimo 8 caracteres.', 'err');
    if (pw.next !== pw.next2) return toast('Las contraseñas nuevas no coinciden.', 'err');
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw.cur));
      await updatePassword(auth.currentUser, pw.next);
      setPw({ cur: '', next: '', next2: '' }); toast('Contraseña actualizada', 'ok');
    } catch (er) { toast(er.code === 'auth/invalid-credential' || er.code === 'auth/wrong-password' ? 'La contraseña actual no es correcta.' : er.message, 'err'); }
  };

  const backup = async () => {
    try {
      const out = { exportedAt: new Date().toISOString() };
      const col = async (path) => (await getDocs(collection(db, path))).docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
      for (const c of ['settings', 'bookings', 'bookingAdmin', 'slots', 'logins', 'counters', 'planLibrary', 'broadcasts']) { setProg(`Copiando ${c}…`); out[c] = await col(c); }
      const adminSettings = out.settings.find((s) => s.id === 'admin');
      if (adminSettings?.anthropicKey) adminSettings.anthropicKey = '(oculta)';
      setProg('Copiando plantillas…');
      out.templates = (await col('templates')).map(({ text, ...t }) => ({ ...t, textLength: text?.length || 0 }));
      const members = await col('members');
      out.members = [];
      for (const [i, m] of members.entries()) {
        setProg(`Copiando pacientes ${i + 1} de ${members.length}…`);
        const sub = {};
        for (const s of ['plans', 'drafts', 'progress', 'clinical', 'photos', 'foodlog', 'notifications']) sub[s] = await col(`members/${m.id}/${s}`);
        out.members.push({ ...m, ...sub });
      }
      const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `respaldo-keila-nutricion-${todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast(`Respaldo descargado (${members.length} pacientes)`, 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { setProg(''); }
  };

  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <form className="card stack" onSubmit={changePw}>
        <h4 style={{ margin: 0 }}><Icon name="lock" size={18} /> Mi contraseña</h4>
        <div className="small muted">{auth.currentUser?.email}</div>
        <Field label="Contraseña actual"><input className="input" type="password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} autoComplete="current-password" /></Field>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres."><input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></Field>
        <Field label="Repite la nueva contraseña"><input className="input" type="password" value={pw.next2} onChange={(e) => setPw({ ...pw, next2: e.target.value })} autoComplete="new-password" /></Field>
        <button className="btn sm" style={{ alignSelf: 'flex-start' }}>Cambiar contraseña</button>
      </form>
      <div className="card stack">
        <h4 style={{ margin: 0 }}><Icon name="download" size={18} /> Respaldo de datos</h4>
        <p className="small muted" style={{ margin: 0 }}>Descarga un archivo con toda tu información: pacientes, expedientes, historiales, planes, progreso, registro de comidas, reservaciones, precios y ajustes. Guárdalo en un lugar seguro (contiene datos de salud).</p>
        <p className="tiny muted" style={{ margin: 0 }}>Incluye las miniaturas de las fotos de progreso; los PDF adjuntos y las fotos en tamaño completo se quedan en la app.</p>
        <button type="button" className="btn light sm" style={{ alignSelf: 'flex-start' }} disabled={!!prog} onClick={backup}>{prog ? <><Spinner /> {prog}</> : <><Icon name="download" size={16} /> Descargar respaldo</>}</button>
      </div>
    </div>
  );
}

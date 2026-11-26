// Contacto, textos del sitio público y fotos.
import { useRef, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Field, Icon, Spinner, useToast } from '../../../components/ui';
import { DEFAULT_SITE, forgetSiteImage, mergeSite, useSiteImage } from '../../../lib/config';
import { compressPhoto } from '../../../lib/photos';
import { LinesInput, SaveBar, Toggle, savePart } from './shared';

export function ImageSetting({ imgKey, label, hint }) {
  const toast = useToast();
  const src = useSiteImage(imgKey);
  const [local, setLocal] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  const shown = local !== undefined ? local : src;
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const { full } = await compressPhoto(file);
      await setDoc(doc(db, 'siteImages', imgKey), { data: full, updatedAt: serverTimestamp() });
      forgetSiteImage(imgKey); setLocal(full);
      toast('Foto actualizada', 'ok');
    } catch (er) { toast(er.message, 'err'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('¿Quitar esta foto?')) return;
    try { await deleteDoc(doc(db, 'siteImages', imgKey)); forgetSiteImage(imgKey); setLocal(null); toast('Foto quitada', 'ok'); } catch (er) { toast(er.message, 'err'); }
  };
  return (
    <div className="field">
      <span>{label}</span>
      <div className="img-setting">
        {shown ? <img className="preview" src={shown} alt="" /> : <div className="preview"><Icon name="image" size={28} /></div>}
        <div className="row">
          <button type="button" className="btn light sm" disabled={busy} onClick={() => ref.current.click()}>{busy ? <Spinner /> : <Icon name="upload" size={16} />} {shown ? 'Cambiar foto' : 'Subir foto'}</button>
          {shown && <button type="button" className="btn link xs" style={{ color: 'var(--danger)' }} onClick={remove}>Quitar</button>}
        </div>
        <input ref={ref} type="file" accept="image/*" hidden onChange={upload} />
      </div>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export default function SiteSettings({ pub }) {
  const toast = useToast();
  const [c, setC] = useState({ whatsapp: pub.whatsapp || '', instagram: pub.instagram || '', email: pub.email || '', address: pub.address || '' });
  const [s, setS] = useState(() => mergeSite(pub.site));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const setSite = (k) => (e) => { setS((x) => ({ ...x, [k]: e?.target ? e.target.value : e })); setDirty(true); };
  const setCt = (k) => (e) => { setC((x) => ({ ...x, [k]: e.target.value })); setDirty(true); };
  const T = (k, label, area, hint) => (
    <Field label={label} hint={hint} className={area ? 'span2' : ''}>
      {area ? <textarea className="textarea" rows={3} value={s[k] || ''} onChange={setSite(k)} /> : <input className="input" value={s[k] || ''} onChange={setSite(k)} />}
    </Field>
  );

  const save = async () => {
    const phone = c.whatsapp.replace(/\D/g, '');
    if (c.whatsapp && phone.length < 10) return toast('El WhatsApp debe tener 10 dígitos.', 'err');
    setBusy(true);
    try {
      const site = { ...s, steps: s.steps.filter((x) => x.title || x.text), teamItems: (s.teamItems || []).filter(Boolean) };
      await savePart('public', { whatsapp: phone, instagram: c.instagram.trim(), email: c.email.trim(), address: c.address.trim(), site });
      setDirty(false); toast('Sitio actualizado', 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="card stack">
        <h4 style={{ margin: 0 }}>Contacto público</h4>
        <p className="small muted" style={{ margin: 0 }}>Aparece en el sitio, en los PDF y en el botón de WhatsApp.</p>
        <div className="grid g2">
          <Field label="WhatsApp (10 dígitos)"><input className="input" inputMode="tel" value={c.whatsapp} onChange={setCt('whatsapp')} /></Field>
          <Field label="Instagram"><input className="input" value={c.instagram} onChange={setCt('instagram')} placeholder="@lic.guerrero.k" /></Field>
          <Field label="Correo de contacto"><input className="input" type="email" value={c.email} onChange={setCt('email')} /></Field>
          <Field label="Dirección del consultorio"><input className="input" value={c.address} onChange={setCt('address')} /></Field>
        </div>
      </div>

      <div className="card stack">
        <h4 style={{ margin: 0 }}>Portada</h4>
        <p className="small muted" style={{ margin: 0 }}>Escribe una palabra entre asteriscos para ponerla en cursiva (ej. Nutrición que se *adapta* a tu vida).</p>
        <div className="grid g2">
          {T('heroEyebrow', 'Texto pequeño superior')}
          {T('heroTitle', 'Título principal')}
          {T('heroLead', 'Descripción', true)}
          {T('ctaPrimary', 'Botón principal')}
          {T('ctaSecondary', 'Botón secundario')}
        </div>
      </div>

      <div className="card stack">
        <div className="row between"><h4 style={{ margin: 0 }}>Sección “Sobre mí”</h4><Toggle label="Mostrar en el sitio" checked={s.aboutEnabled} onChange={(v) => { setS((x) => ({ ...x, aboutEnabled: v })); setDirty(true); }} /></div>
        <div className="grid g2">
          {T('aboutEyebrow', 'Texto pequeño')}
          {T('aboutTitle', 'Título')}
          {T('aboutText', 'Texto (deja un renglón vacío para separar párrafos)', true)}
        </div>
        <ImageSetting imgKey="about" label="Tu foto" hint="Se guarda optimizada. Recomendado: foto vertical u horizontal con buena luz." />
      </div>

      <div className="card stack">
        <h4 style={{ margin: 0 }}>Servicios, proceso y app</h4>
        <div className="grid g2">
          {T('servicesEyebrow', 'Servicios: texto pequeño')}
          {T('servicesTitle', 'Servicios: título')}
          {T('servicesLead', 'Servicios: descripción', true)}
          {T('processEyebrow', 'Proceso: texto pequeño')}
          {T('processTitle', 'Proceso: título')}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span className="small"><b>Pasos del proceso</b></span>
          {s.steps.map((st, i) => (
            <div key={i} className="row nowrap" style={{ alignItems: 'flex-start' }}>
              <span className="tiny muted" style={{ paddingTop: 12 }}>{i + 1}</span>
              <input className="input" style={{ maxWidth: 180 }} value={st.title} placeholder="Título" onChange={(e) => { setS((x) => ({ ...x, steps: x.steps.map((y, k) => (k === i ? { ...y, title: e.target.value } : y)) })); setDirty(true); }} />
              <input className="input grow" value={st.text} placeholder="Descripción" onChange={(e) => { setS((x) => ({ ...x, steps: x.steps.map((y, k) => (k === i ? { ...y, text: e.target.value } : y)) })); setDirty(true); }} />
              <button type="button" className="icon-btn sm danger" aria-label="Quitar paso" onClick={() => { setS((x) => ({ ...x, steps: x.steps.filter((_, k) => k !== i) })); setDirty(true); }}><Icon name="trash" size={15} /></button>
            </div>
          ))}
          {s.steps.length < 6 && <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => { setS((x) => ({ ...x, steps: [...x.steps, { title: '', text: '' }] })); setDirty(true); }}>+ Agregar paso</button>}
        </div>
        <div className="grid g2">
          {T('teamEyebrow', 'App: texto pequeño')}
          {T('teamTitle', 'App: título')}
          {T('teamLead', 'App: descripción', true)}
        </div>
        <Field label="App: lista de beneficios (uno por renglón)"><LinesInput value={s.teamItems} onChange={(v) => { setS((x) => ({ ...x, teamItems: v })); setDirty(true); }} /></Field>
        <div className="grid g2">
          {T('quote', 'Frase final', true)}
          {T('quoteAuthor', 'Autora de la frase')}
          {T('quoteCta', 'Botón de la frase final')}
          {T('footerText', 'Texto del pie de página', true)}
        </div>
      </div>

      <div className="card stack">
        <h4 style={{ margin: 0 }}>Página de reservación</h4>
        <div className="grid g2">
          {T('bookingEyebrow', 'Texto pequeño')}
          {T('bookingTitle', 'Título')}
          {T('bookingLead', 'Descripción', true)}
          {T('bookingDoneTitle', 'Título al terminar la reservación')}
          {T('bookingDoneText', 'Mensaje al terminar la reservación', true)}
        </div>
        <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => { if (window.confirm('¿Regresar todos los textos del sitio a los originales?')) { setS({ ...DEFAULT_SITE, aboutEnabled: s.aboutEnabled }); setDirty(true); } }}>Restaurar textos originales</button>
      </div>
      <SaveBar onSave={save} busy={busy} dirty={dirty} />
    </div>
  );
}

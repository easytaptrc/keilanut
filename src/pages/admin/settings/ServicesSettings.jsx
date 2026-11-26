// Servicios (lo que ven los pacientes) y precios (solo la nutrióloga).
import { useState } from 'react';
import { Field, Icon, useToast } from '../../../components/ui';
import { mergeServices } from '../../../lib/config';
import { cx, money } from '../../../lib/utils';
import { ImageSetting } from './SiteSettings';
import { LinesInput, RowTools, SaveBar, Toggle, savePart } from './shared';

const ICONS = { video: 'Video', pin: 'Ubicación', leaf: 'Hoja', apple: 'Manzana', dumbbell: 'Pesa', heart: 'Corazón', chart: 'Gráfica', calendar: 'Calendario' };
const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

export default function ServicesSettings({ pub, adm }) {
  const toast = useToast();
  const [list, setList] = useState(() => Object.entries(mergeServices(pub.services)).map(([key, s]) => ({ key, ...s })));
  const [prices, setPrices] = useState(() => ({ online: 500, presencial: 500, ...(adm.prices || {}) }));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const upd = (i, patch) => { setList((l) => l.map((s, k) => (k === i ? { ...s, ...patch } : s))); setDirty(true); };

  const add = () => {
    const name = window.prompt('Nombre del nuevo servicio (ej. Paquete mensual, Consulta deportiva):');
    if (!name?.trim()) return;
    let key = slug(name) || 'servicio';
    while (list.some((s) => s.key === key)) key += '-2';
    setList((l) => [...l, { key, enabled: true, icon: 'leaf', label: name.trim(), short: (() => { const w = name.trim().split(' ').slice(-1)[0]; return w[0].toUpperCase() + w.slice(1); })(), desc: '', bullets: [] }]);
    setDirty(true);
  };

  const save = async () => {
    if (!list.some((s) => s.enabled !== false)) return toast('Deja al menos un servicio activo.', 'err');
    if (list.some((s) => !s.label.trim())) return toast('Todos los servicios necesitan nombre.', 'err');
    setBusy(true);
    try {
      const services = Object.fromEntries(list.map(({ key, ...s }) => [key, { ...s, label: s.label.trim(), short: (s.short || s.label).trim(), bullets: (s.bullets || []).filter(Boolean) }]));
      await savePart('public', { services });
      await savePart('admin', { prices: Object.fromEntries(list.map((s) => [s.key, Number(prices[s.key]) || 0])) });
      setDirty(false); toast('Servicios y precios guardados', 'ok');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="notice small">Los pacientes ven el nombre y la descripción de cada servicio al reservar. <b>Los precios solo los ves tú.</b> Si apagas un servicio, deja de aparecer en el sitio y en las reservaciones (las citas que ya existen no cambian).</div>
      {list.map((s, i) => (
        <div key={s.key} className={cx('svc-card', s.enabled === false && 'off')}>
          <div className="row between">
            <Toggle label={s.enabled === false ? 'Servicio apagado' : 'Servicio activo'} checked={s.enabled !== false} onChange={(v) => upd(i, { enabled: v })} />
            <RowTools list={list} i={i} onChange={(l) => { setList(l); setDirty(true); }} canDelete={list.length > 1} label="servicio" />
          </div>
          <div className="grid g2">
            <Field label="Nombre"><input className="input" maxLength={100} value={s.label} onChange={(e) => upd(i, { label: e.target.value })} /></Field>
            <Field label="Nombre corto (botones y listas)"><input className="input" maxLength={30} value={s.short || ''} onChange={(e) => upd(i, { short: e.target.value })} /></Field>
            <Field label="Descripción" className="span2"><textarea className="textarea" rows={2} value={s.desc || ''} onChange={(e) => upd(i, { desc: e.target.value })} /></Field>
            <Field label="Lo que incluye (uno por renglón)" className="span2"><LinesInput rows={3} value={s.bullets} onChange={(bullets) => upd(i, { bullets })} /></Field>
            <Field label="Ícono"><select className="select" value={s.icon || 'leaf'} onChange={(e) => upd(i, { icon: e.target.value })}>{Object.entries(ICONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Precio (privado)" hint={money(prices[s.key])}>
              <div className="row nowrap"><Icon name="lock" size={16} /><input className="input grow" inputMode="numeric" value={prices[s.key] ?? ''} onChange={(e) => { setPrices((p) => ({ ...p, [s.key]: e.target.value.replace(/[^\d.]/g, '') })); setDirty(true); }} /></div>
            </Field>
          </div>
          <ImageSetting imgKey={`service-${s.key}`} label="Foto del servicio (opcional, reemplaza el ícono)" />
        </div>
      ))}
      <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={add}><Icon name="plus" size={16} /> Agregar servicio</button>
      <SaveBar onSave={save} busy={busy} dirty={dirty} />
    </div>
  );
}

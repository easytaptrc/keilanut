import { useMemo, useRef, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { useCol } from '../lib/hooks';
import { POSES, addProgressPhoto, deleteProgressPhoto, getFullPhoto } from '../lib/photos';
import { cx, fmtDate, todayISO } from '../lib/utils';
import { Badge, Empty, Field, Icon, Modal, Spinner, useToast } from './ui';

export default function ProgressPhotos({ member, by = 'member' }) {
  const toast = useToast();
  const { list, loading } = useCol(`members/${member.id}/photos`, () => [orderBy('date', 'desc')], 'photos' + member.id);
  const [up, setUp] = useState(null); // { files, pose, date, note }
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const [compare, setCompare] = useState(false);
  const [pick, setPick] = useState({ a: '', b: '' });
  const fileRef = useRef();

  const byDate = useMemo(() => {
    const m = new Map();
    for (const p of list) { if (!m.has(p.date)) m.set(p.date, []); m.get(p.date).push(p); }
    return [...m.entries()];
  }, [list]);
  const dates = byDate.map(([d]) => d);

  const save = async () => {
    if (!up?.files?.length) return toast('Elige al menos una foto', 'err');
    setBusy(true);
    try {
      for (const [i, f] of [...up.files].entries()) {
        const pose = up.files.length > 1 ? (['frente', 'perfil', 'espalda'][i] || 'otra') : up.pose;
        await addProgressPhoto(member.id, f, { pose, date: up.date, by, note: up.note });
      }
      toast('Fotos guardadas', 'ok');
      setUp(null);
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const open = async (p) => {
    setView({ ...p, full: null });
    try { const full = await getFullPhoto(member.id, p.id); setView((v) => (v?.id === p.id ? { ...v, full } : v)); }
    catch (e) { toast(e.message, 'err'); }
  };

  const remove = async (p) => {
    if (!window.confirm('¿Eliminar esta foto?')) return;
    try { await deleteProgressPhoto(member.id, p.id); setView(null); toast('Foto eliminada', 'ok'); } catch (e) { toast(e.message, 'err'); }
  };
  const canDelete = (p) => by === 'admin' || p.by === 'member';

  const A = byDate.find(([d]) => d === (pick.a || dates[dates.length - 1]))?.[1] || [];
  const B = byDate.find(([d]) => d === (pick.b || dates[0]))?.[1] || [];

  return (
    <div className="card stack">
      <div className="card-title" style={{ margin: 0 }}>
        <h4>Fotos de progreso</h4>
        <div className="row">
          {dates.length > 1 && <button className={cx('btn sm', compare ? '' : 'light')} onClick={() => setCompare(!compare)}><Icon name="eye" size={16} /> Comparar</button>}
          <button className="btn sm sage" onClick={() => setUp({ files: [], pose: 'frente', date: todayISO(), note: '' })}><Icon name="camera" size={16} /> Subir fotos</button>
        </div>
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>Toma tus fotos con la misma luz, ropa ajustada y de frente, perfil y espalda. Solo tú y Keila pueden verlas.</p>

      {compare && dates.length > 1 && (
        <div className="card soft stack fade-in">
          <div className="grid g2">
            <Field label="Antes"><select className="select sm" value={pick.a || dates[dates.length - 1]} onChange={(e) => setPick({ ...pick, a: e.target.value })}>{dates.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}</select></Field>
            <Field label="Después"><select className="select sm" value={pick.b || dates[0]} onChange={(e) => setPick({ ...pick, b: e.target.value })}>{dates.map((d) => <option key={d} value={d}>{fmtDate(d)}</option>)}</select></Field>
          </div>
          {Object.keys(POSES).filter((pose) => A.some((x) => x.pose === pose) || B.some((x) => x.pose === pose)).map((pose) => (
            <div key={pose} className="compare-row">
              <span className="eyebrow">{POSES[pose]}</span>
              <div className="grid g2" style={{ gap: 8 }}>
                {[A, B].map((set, k) => { const p = set.find((x) => x.pose === pose); return p ? <img key={k} src={p.thumb} alt={POSES[pose]} className="photo-thumb" onClick={() => open(p)} /> : <div key={k} className="photo-thumb empty">—</div>; })}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="skeleton" style={{ height: 120 }} /> : !list.length ? (
        <Empty icon="📸">Aún no hay fotos. Sube las de hoy para comparar tu cambio en las próximas semanas.</Empty>
      ) : byDate.map(([d, photos]) => (
        <div key={d} className="stack" style={{ gap: 6 }}>
          <b className="small">{fmtDate(d, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</b>
          <div className="photo-grid">
            {photos.map((p) => (
              <button key={p.id} className="photo-cell" onClick={() => open(p)}>
                <img src={p.thumb} alt={POSES[p.pose]} loading="lazy" />
                <span>{POSES[p.pose]}{p.by === 'admin' ? ' · Keila' : ''}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {up && (
        <Modal title="Subir fotos de progreso" onClose={() => !busy && setUp(null)}
          footer={<><button className="btn ghost" disabled={busy} onClick={() => setUp(null)}>Cancelar</button><button className="btn sage" disabled={busy || !up.files.length} onClick={save}>{busy ? <><Spinner /> Guardando…</> : 'Guardar'}</button></>}>
          <div className="stack">
            <button type="button" className="btn light" onClick={() => fileRef.current.click()}><Icon name="camera" size={18} /> {up.files.length ? `${up.files.length} foto(s) seleccionada(s)` : 'Tomar o elegir fotos'}</button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => setUp({ ...up, files: [...(e.target.files || [])].slice(0, 6) })} />
            {up.files.length > 1 ? <div className="notice small">Se guardarán en orden: frente, perfil y espalda.</div> : (
              <Field label="Posición"><div className="checks">{Object.entries(POSES).map(([k, l]) => <button type="button" key={k} className={cx('opt', up.pose === k && 'on')} onClick={() => setUp({ ...up, pose: k })}>{l}</button>)}</div></Field>
            )}
            <Field label="Fecha"><input className="input" type="date" max={todayISO()} value={up.date} onChange={(e) => setUp({ ...up, date: e.target.value })} /></Field>
            <Field label="Nota (opcional)"><input className="input" value={up.note} maxLength={300} onChange={(e) => setUp({ ...up, note: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

      {view && (
        <Modal title={`${POSES[view.pose]} · ${fmtDate(view.date)}`} onClose={() => setView(null)}
          footer={canDelete(view) && <button className="btn ghost sm" onClick={() => remove(view)}><Icon name="trash" size={16} /> Eliminar</button>}>
          <div className="photo-full">{view.full ? <img src={view.full} alt="" /> : <><img src={view.thumb} alt="" style={{ filter: 'blur(2px)' }} /><Spinner /></>}</div>
          <div className="row mt">{view.by === 'admin' ? <Badge tone="sage" plain>Subida por Keila</Badge> : <Badge plain>Subida por el paciente</Badge>}{view.note && <span className="small">{view.note}</span>}</div>
        </Modal>
      )}
    </div>
  );
}

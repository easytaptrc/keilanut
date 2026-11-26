// Piezas compartidas de la pantalla de Ajustes.
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Icon } from '../../../components/ui';
import { cx } from '../../../lib/utils';

/** Guarda (reemplazando por completo) una parte de settings/public o settings/admin */
export async function savePart(which, patch) {
  const ref = doc(db, 'settings', which);
  try { await updateDoc(ref, patch); } catch (e) {
    if (e.code === 'not-found') await setDoc(ref, patch, { merge: true });
    else throw e;
  }
}

export function Toggle({ checked, onChange, label, disabled, small }) {
  return (
    <label className={cx('switch', small && 'sm', disabled && 'disabled')}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden><span className="thumb" /></span>
      {label && <span className="switch-label">{label}</span>}
    </label>
  );
}

/** Botones subir / bajar / quitar para elementos de una lista */
export function RowTools({ list, i, onChange, canDelete = true, label = 'elemento' }) {
  const move = (d) => { const x = [...list]; const j = i + d; if (j < 0 || j >= x.length) return; [x[i], x[j]] = [x[j], x[i]]; onChange(x); };
  return (
    <div className="row-tools">
      <button type="button" className="icon-btn sm" disabled={i === 0} onClick={() => move(-1)} aria-label={`Subir ${label}`}><Icon name="arrowUp" size={15} /></button>
      <button type="button" className="icon-btn sm" disabled={i === list.length - 1} onClick={() => move(1)} aria-label={`Bajar ${label}`}><Icon name="arrowDown" size={15} /></button>
      {canDelete && <button type="button" className="icon-btn sm danger" onClick={() => { if (window.confirm(`¿Eliminar este ${label}?`)) onChange(list.filter((_, k) => k !== i)); }} aria-label={`Eliminar ${label}`}><Icon name="trash" size={15} /></button>}
    </div>
  );
}

/** Lista de textos editable (un renglón por elemento) */
export function LinesInput({ value, onChange, rows = 4, placeholder }) {
  return (
    <textarea className="textarea" rows={rows} value={(value || []).join('\n')} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.split('\n'))}
      onBlur={(e) => onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />
  );
}

export function SaveBar({ onSave, busy, dirty, label = 'Guardar cambios' }) {
  return (
    <div className="save-bar">
      {dirty && <span className="small" style={{ color: 'var(--warn)' }}>Cambios sin guardar</span>}
      <button className="btn" disabled={busy} onClick={onSave}><Icon name="check" size={18} /> {busy ? 'Guardando…' : label}</button>
    </div>
  );
}

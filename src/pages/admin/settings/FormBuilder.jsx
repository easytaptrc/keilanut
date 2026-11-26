// Editor de formularios: secciones y preguntas (activar, desactivar, renombrar, ordenar, agregar y eliminar).
import { Badge, Field, Icon } from '../../../components/ui';
import { uid } from '../../../lib/config';
import { cx } from '../../../lib/utils';
import { RowTools, Toggle } from './shared';

const CHOICE = ['choice', 'multi', 'single'];
const PLACEHOLDER = ['text', 'textarea', 'number', 'tel', 'email', 'yesno-detail'];

/** Opciones con valor fijo (p. ej. objetivo): cada opción conserva su valor interno aunque cambies el texto u ordenes. */
function KeyedOptionsEditor({ value, onChange }) {
  const list = value || [];
  const set = (i, label) => onChange(list.map((o, k) => (k === i ? { ...o, label } : o)));
  return (
    <div className="field">
      <span>Opciones</span>
      <div className="stack" style={{ gap: 6 }}>
        {list.map((o, i) => (
          <div key={o.value} className="row nowrap" style={{ gap: 6 }}>
            <input className="input sm grow" value={o.label} onChange={(e) => set(i, e.target.value)} aria-label="Texto de la opción" />
            <RowTools list={list} i={i} onChange={onChange} canDelete={list.length > 2} label="opción" />
          </div>
        ))}
        <button type="button" className="btn link xs" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...list, { value: uid('op'), label: 'Nueva opción' }])}>+ Agregar opción</button>
      </div>
    </div>
  );
}

/** Opciones como texto (un renglón por opción). */
function OptionsEditor({ value, onChange }) {
  const list = (value || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const isObj = (value || []).some((o) => typeof o === 'object');
  if (isObj) return <KeyedOptionsEditor value={list} onChange={onChange} />;
  return (
    <Field label="Opciones (una por renglón)">
      <textarea className="textarea" rows={Math.min(10, Math.max(3, list.length + 1))} value={list.map((o) => o.label).join('\n')}
        onChange={(e) => {
          const lines = e.target.value.split('\n');
          onChange(isObj ? lines.map((l, i) => ({ value: list[i]?.value ?? l.trim(), label: l })) : lines);
        }}
        onBlur={(e) => {
          const lines = e.target.value.split('\n').map((x) => x.trim());
          const out = [];
          lines.forEach((l, i) => { if (l) out.push(isObj ? { value: list[i]?.value || l, label: l } : l); });
          onChange(out);
        }} />
    </Field>
  );
}

function FieldEditor({ q, mode, types, onChange, list, i, onList }) {
  const set = (patch) => onChange({ ...q, ...patch });
  const locked = !!q.locked;
  return (
    <details className={cx('fb-field', q.enabled === false && 'off')}>
      <summary>
        <Icon name="edit" size={15} />
        <span className="fb-label">{q.label || 'Sin texto'}</span>
        {q.required && mode === 'booking' && <Badge plain>Obligatoria</Badge>}
        <Badge plain>{types[q.type] || q.type}</Badge>
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
          <Toggle small checked={q.enabled !== false} disabled={locked} onChange={(v) => set({ enabled: v })} />
        </span>
      </summary>
      <div className="fb-field-body">
        <Field label="Pregunta o texto que se muestra">
          <textarea className="textarea" rows={2} value={q.label || ''} onChange={(e) => set({ label: e.target.value })} />
        </Field>
        <div className="grid g2">
          <Field label="Tipo de respuesta">
            <select className="select" value={q.type} disabled={!!q.builtin} onChange={(e) => set({ type: e.target.value, ...(CHOICE.includes(e.target.value) && !q.options?.length ? { options: ['Opción 1', 'Opción 2'] } : {}) })}>
              {Object.entries(types).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              {!types[q.type] && <option value={q.type}>{q.type}</option>}
            </select>
          </Field>
          {PLACEHOLDER.includes(q.type) && mode === 'booking' && (
            <Field label="Texto de ejemplo (opcional)"><input className="input" value={q.placeholder || ''} onChange={(e) => set({ placeholder: e.target.value })} /></Field>
          )}
        </div>
        {CHOICE.includes(q.type) && <OptionsEditor value={q.options} onChange={(options) => set({ options })} />}
        <Field label="Ayuda debajo de la pregunta (opcional)"><input className="input" value={q.hint || ''} onChange={(e) => set({ hint: e.target.value })} /></Field>
        <div className="fb-toggles">
          <Toggle label="Activa" checked={q.enabled !== false} disabled={locked} onChange={(v) => set({ enabled: v })} />
          {mode === 'booking' && <Toggle label="Obligatoria" checked={!!q.required} disabled={locked} onChange={(v) => set({ required: v })} />}
          {mode === 'clinical' && CHOICE.includes(q.type) && <Toggle label="Permitir “Otros: especifica”" checked={!!q.other} onChange={(v) => set({ other: v })} />}
          <span className="grow" />
          <RowTools list={list} i={i} onChange={onList} canDelete={!q.builtin} label="pregunta" />
        </div>
        {locked && <p className="tiny muted" style={{ margin: 0 }}><Icon name="lock" size={12} /> Esta pregunta es necesaria para crear la cuenta del paciente: puedes cambiar el texto, pero no quitarla.</p>}
        {q.builtin && !locked && <p className="tiny muted" style={{ margin: 0 }}>Pregunta original del sistema: puedes cambiar el texto, desactivarla u ordenarla; no se puede borrar.</p>}
      </div>
    </details>
  );
}

export default function FormBuilder({ sections, onChange, mode, types }) {
  const setSection = (i, patch) => onChange(sections.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const addField = (i) => setSection(i, { fields: [...sections[i].fields, { key: uid('q'), label: 'Nueva pregunta', type: mode === 'booking' ? 'text' : 'area', enabled: true, required: false }] });
  return (
    <div className="stack" style={{ gap: 14 }}>
      {sections.map((s, i) => (
        <div key={s.key} className={cx('fb-section', s.enabled === false && 'off')}>
          <div className="fb-section-head">
            <span className="tiny muted">{i + 1}.</span>
            <input className="input sm" value={s.title} onChange={(e) => setSection(i, { title: e.target.value })} aria-label="Título de la sección" />
            <Toggle small label="Activa" checked={s.enabled !== false} disabled={s.fields.some((q) => q.locked)} onChange={(v) => setSection(i, { enabled: v })} />
            <RowTools list={sections} i={i} onChange={onChange} canDelete={!s.builtin} label="sección" />
          </div>
          <div className="fb-fields">
            {s.fields.map((q, j) => (
              <FieldEditor key={q.key} q={q} mode={mode} types={types} list={s.fields} i={j}
                onList={(fields) => setSection(i, { fields })}
                onChange={(nq) => setSection(i, { fields: s.fields.map((x, k) => (k === j ? nq : x)) })} />
            ))}
            {!s.fields.length && <p className="small muted" style={{ padding: '10px 12px', margin: 0 }}>Sección sin preguntas.</p>}
          </div>
          <div className="fb-add">
            <button type="button" className="btn light sm" onClick={() => addField(i)}><Icon name="plus" size={16} /> Agregar pregunta</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...sections, { key: uid('s'), title: 'Nueva sección', enabled: true, fields: [] }])}>
        <Icon name="plus" size={16} /> Agregar sección
      </button>
    </div>
  );
}

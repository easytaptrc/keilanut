// Biblioteca de planes base: explorar, ver y usar los planes de Keila para un paciente.
import { useEffect, useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { useCol } from '../lib/hooks';
import { deleteFromLibrary, libraryTags, loadBuiltInLibrary, rankLibrary } from '../lib/library';
import { foodPhoto } from '../data/planAssets';
import { GOALS, cx } from '../lib/utils';
import { DietView } from './PlanViews';
import { Badge, Empty, Icon, Modal, Spinner, useToast } from './ui';

/** Planes incluidos + guardados por la nutrióloga */
export function usePlanLibrary() {
  const [builtIn, setBuiltIn] = useState(null);
  const custom = useCol('planLibrary', () => [orderBy('createdAt', 'desc')], 'planLibrary');
  useEffect(() => { let on = true; loadBuiltInLibrary().then((l) => on && setBuiltIn(l)).catch(() => on && setBuiltIn([])); return () => { on = false; }; }, []);
  const list = useMemo(() => [...custom.list.map((x) => ({ ...x, custom: true })), ...(builtIn || [])], [custom.list, builtIn]);
  return { list, loading: builtIn === null || custom.loading };
}

const photosOf = (plan) => [...new Set((plan?.days || []).flatMap((d) => d.meals || []).map((m) => m.photo).filter(Boolean))].slice(0, 5);

export function PlanLibraryBrowser({ member, clinical, onUse }) {
  const toast = useToast();
  const { list, loading } = usePlanLibrary();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('todos');
  const [preview, setPreview] = useState(null);

  const ranked = useMemo(() => (member ? rankLibrary(list, member, clinical) : list), [list, member, clinical]);
  const bestId = member && ranked[0]?.match?.score > 0 ? ranked[0].id : null;
  const shown = ranked.filter((e) => {
    if (filter === 'hombre' || filter === 'mujer') { if (e.tags?.sex !== filter) return false; }
    if (filter === 'tuyos' && !e.custom) return false;
    if (filter === 'anemia' && !(e.tags?.conditions || []).includes('anemia')) return false;
    if (!q.trim()) return true;
    const hay = `${e.title} ${e.description} ${libraryTags(e.tags).join(' ')} ${GOALS[e.tags?.goal] || ''}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  });

  const remove = async (e) => {
    if (!window.confirm(`¿Eliminar “${e.title}” de tu biblioteca?`)) return;
    try { await deleteFromLibrary(e.id); toast('Plan eliminado de tu biblioteca', 'ok'); } catch (er) { toast(er.message, 'err'); }
  };

  if (loading) return <div className="row" style={{ justifyContent: 'center', padding: 30 }}><Spinner /></div>;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 10 }}>
        <input className="input grow" style={{ minWidth: 180 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: déficit, anemia, ayuno, 3 menús…" aria-label="Buscar plan" />
      </div>
      <div className="lib-filter">
        {[['todos', 'Todos'], ['mujer', 'Mujer'], ['hombre', 'Hombre'], ['anemia', 'Anemia'], ['tuyos', 'Guardados por ti']].map(([k, l]) => (
          <button key={k} type="button" className={cx('chip', filter === k && 'on')} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {member && bestId && <p className="small muted" style={{ margin: 0 }}>Ordenados según el perfil de <b>{member.firstName}</b> (sexo, edad, peso, objetivo, condiciones y comidas al día).</p>}
      {!shown.length ? <Empty icon="📚" title="Sin resultados">Prueba con otra búsqueda o filtro.</Empty> : (
        <div className="lib-list">
          {shown.map((e) => (
            <div key={(e.custom ? 'c-' : 'b-') + e.id} className={cx('lib-card', e.id === bestId && 'best')}>
              <div className="row between nowrap" style={{ alignItems: 'flex-start' }}>
                <h4>{e.title}</h4>
                {e.id === bestId ? <Badge tone="sage">★ Recomendado</Badge> : e.custom ? <Badge plain>Tuyo</Badge> : null}
              </div>
              {e.description && <p className="tiny muted" style={{ margin: 0 }}>{e.description}</p>}
              <div className="lib-photos">{photosOf(e.plan).map((p) => <img key={p} src={foodPhoto(p)} alt="" loading="lazy" />)}</div>
              <div className="lib-tags">
                {e.tags?.goal && <Badge tone="sage" plain>{GOALS[e.tags.goal] || e.tags.goal}</Badge>}
                {libraryTags(e.tags).map((t) => <Badge key={t} plain>{t}</Badge>)}
                <Badge plain>{e.plan?.days?.length || 0} {e.tags?.format === 'opciones' ? 'opciones' : 'días/menús'}</Badge>
              </div>
              {member && e.match?.why?.length > 0 && <div className="tiny" style={{ color: 'var(--sage-dark)' }}>Coincide: {e.match.why.join(' · ')}</div>}
              <div className="lib-actions">
                <button type="button" className="btn light xs" onClick={() => setPreview(e)}><Icon name="eye" size={14} /> Ver</button>
                {onUse && <button type="button" className="btn sage xs" onClick={() => onUse(e)}><Icon name="check" size={14} /> Usar este plan</button>}
                {e.custom && <button type="button" className="btn link xs" style={{ color: 'var(--danger)' }} onClick={() => remove(e)}><Icon name="trash" size={14} /> Eliminar</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {preview && (
        <Modal wide title={preview.title} onClose={() => setPreview(null)}
          footer={<><button className="btn ghost" onClick={() => setPreview(null)}>Cerrar</button>{onUse && <button className="btn sage" onClick={() => { onUse(preview); setPreview(null); }}><Icon name="check" size={16} /> Usar este plan</button>}</>}>
          <DietView diet={preview.plan} />
        </Modal>
      )}
    </div>
  );
}

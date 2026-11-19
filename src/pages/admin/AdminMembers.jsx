import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCol } from '../../lib/hooks';
import { Avatar, Badge, Empty } from '../../components/ui';
import { GOALS, ageFrom, cx, fullName } from '../../lib/utils';

export default function AdminMembers() {
  const nav = useNavigate();
  const { list, loading } = useCol('members', null, 'members-list');
  const [q, setQ] = useState('');
  const [show, setShow] = useState('activos');
  const shown = list
    .filter((m) => (show === 'activos' ? m.active !== false : m.active === false))
    .filter((m) => !q || `${fullName(m)} ${m.id} ${m.email} ${m.phone}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.id.localeCompare(b.id));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Team</h1><Badge tone="sage">{list.filter((m) => m.active !== false).length} activos</Badge></div>
      <div className="row between">
        <div className="tabs">
          <button className={cx('tab', show === 'activos' && 'on')} onClick={() => setShow('activos')}>Activos</button>
          <button className={cx('tab', show === 'inactivos' && 'on')} onClick={() => setShow('inactivos')}>Inactivos</button>
        </div>
        <input className="input sm" style={{ maxWidth: 280 }} placeholder="Buscar por nombre, ID, correo…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? <div className="skeleton" style={{ height: 200 }} /> : !shown.length ? (
        <Empty icon="👥" title="Sin miembros todavía">Cuando aceptes una reservación nueva y le des su ID, aparecerá aquí.</Empty>
      ) : (
        <div className="grid g3 stagger">
          {shown.map((m) => (
            <div key={m.id} className="card click row nowrap" onClick={() => nav(`/admin/team/${m.id}`)}>
              <Avatar person={m} size="lg" />
              <div className="grow" style={{ minWidth: 0 }}>
                <b>{fullName(m)}</b>
                <div className="tiny muted">{m.id} · {ageFrom(m.birthDate) ?? '?'} años · {m.weightKg || '?'} kg</div>
                <div className="mt" style={{ marginTop: 6 }}><Badge plain tone="sage">{GOALS[m.goal] || 'Sin objetivo'}</Badge></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

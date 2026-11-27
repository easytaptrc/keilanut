// App de recepción: agenda de citas y agendar. Sin acceso a expedientes, historial clínico, planes ni precios.
import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSession } from '../../lib/session';
import { BOOKING_STATUS, fmtDate, todayISO } from '../../lib/utils';
import { serviceName, useServices } from '../../lib/config';
import Agenda from '../../components/Agenda';
import { Badge, Brand, Icon } from '../../components/ui';
import '../../reception.css';

function Upcoming() {
  const services = useServices();
  const [list, setList] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'agenda'), where('date', '>=', todayISO()), orderBy('date'), limit(60)),
    (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => ['pendiente', 'aceptada'].includes(b.status))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 12)),
    () => setList([])), []);
  if (!list?.length) return null;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <h3 style={{ margin: 0 }}>Próximas citas</h3>
      <div className="rec-up">
        {list.map((b) => (
          <div key={b.id} className="card flat" style={{ padding: 12 }}>
            <div className="row between nowrap"><b className="small">{fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {b.time}</b><Badge tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.label}</Badge></div>
            <div className="small">{`${b.firstName || ''} ${b.lastName || ''}`.trim()}</div>
            <div className="tiny muted">{serviceName(services, b)}{b.memberId ? ` · ${b.memberId}` : ' · Paciente nuevo'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReceptionApp() {
  const { staff, logout } = useSession();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="rec-top">
        <Brand to="/admin" small />
        <div className="row nowrap" style={{ gap: 10 }}>
          <div className="hide-sm" style={{ textAlign: 'right' }}><b className="small">{staff?.name}</b><div className="tiny muted">Recepción</div></div>
          <button className="icon-btn" onClick={logout} aria-label="Cerrar sesión"><Icon name="logout" /></button>
        </div>
      </header>
      <main className="rec-main">
        <div>
          <div className="eyebrow">Recepción</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(1.8rem,5vw,2.6rem)' }}>Agenda de citas</h1>
          <p className="small muted" style={{ margin: '6px 0 0' }}>Hola {staff?.name?.split(' ')[0] || ''}. Aquí ves las citas del consultorio, agendas nuevas, confirmas y cancelas.</p>
        </div>
        <Agenda mode="staff" />
        <Upcoming />
      </main>
    </div>
  );
}

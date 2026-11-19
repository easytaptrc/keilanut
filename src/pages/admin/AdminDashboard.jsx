import { Link } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import { useSession } from '../../lib/session';
import { useCol, useDoc } from '../../lib/hooks';
import { Badge, Empty, Icon } from '../../components/ui';
import PushCard from '../../components/PushCard';
import { BOOKING_STATUS, SERVICES, fmtDate, fullName, money, todayISO } from '../../lib/utils';

export default function AdminDashboard() {
  const { user } = useSession();
  const { list: bookings, loading } = useCol('bookings', () => [orderBy('date', 'desc')], 'all-bookings');
  const members = useCol('members', null, 'members').list;
  const settings = useDoc('settings/admin').data;
  const today = todayISO();
  const month = today.slice(0, 7);
  const prices = settings?.prices || {};
  const priceOf = (b) => Number(b.price ?? prices[b.service] ?? 0);

  const pending = bookings.filter((b) => b.status === 'pendiente');
  const upcoming = bookings.filter((b) => b.date >= today && b.status === 'aceptada').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const todayList = upcoming.filter((b) => b.date === today);
  const monthDone = bookings.filter((b) => b.date.startsWith(month) && ['aceptada', 'completada'].includes(b.status));
  const income = monthDone.reduce((s, b) => s + priceOf(b), 0);
  const paid = monthDone.filter((b) => b.paid).reduce((s, b) => s + priceOf(b), 0);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar">
        <div><div className="muted small">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>Hola, Keila</h1></div>
        <Link to="/admin/reservaciones" className="btn sage sm"><Icon name="calendar" size={16} /> Reservaciones</Link>
      </div>

      <PushCard docPath={`admins/${user.uid}`} />

      <div className="grid g4 stagger">
        <Link to="/admin/reservaciones" className="card click" style={{ textDecoration: 'none' }}>
          <div className="stat"><span className="l">Por aceptar</span><span className="v">{pending.length}</span></div>
        </Link>
        <div className="card"><div className="stat"><span className="l">Citas hoy</span><span className="v">{todayList.length}</span></div></div>
        <Link to="/admin/team" className="card click" style={{ textDecoration: 'none' }}>
          <div className="stat"><span className="l">Miembros Team</span><span className="v">{members.filter((m) => m.active !== false).length}</span></div>
        </Link>
        <div className="card soft">
          <div className="stat"><span className="l">Ingresos del mes</span><span className="v">{money(income)}</span></div>
          <div className="tiny muted mt">Cobrado: {money(paid)} · Solo tú ves esto</div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-title"><h4>Pendientes de aceptar</h4><Link to="/admin/reservaciones" className="btn link xs">Ver todas</Link></div>
          {loading ? <div className="skeleton" style={{ height: 120 }} /> : !pending.length ? <Empty icon="✨">No hay reservaciones pendientes.</Empty> : (
            <div className="list">
              {pending.slice(0, 6).map((b) => (
                <Link key={b.id} to={`/admin/reservaciones?id=${b.id}`} className="list-item" style={{ textDecoration: 'none' }}>
                  <div className="grow"><b className="small">{fullName(b)}</b><div className="tiny muted">{SERVICES[b.service]?.short} · {fmtDate(b.date)} · {b.time}</div></div>
                  <Badge tone={b.memberId ? 'sage' : 'warn'}>{b.memberId ? 'Team' : 'Nuevo'}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title"><h4>Próximas citas</h4></div>
          {!upcoming.length ? <Empty icon="📅">Sin citas confirmadas próximas.</Empty> : (
            <div className="list">
              {upcoming.slice(0, 7).map((b) => (
                <Link key={b.id} to={`/admin/reservaciones?id=${b.id}`} className="list-item" style={{ textDecoration: 'none' }}>
                  <div className="avatar" style={{ borderRadius: 12, flexDirection: 'column', lineHeight: 1, fontSize: '0.8rem' }}>
                    <span>{new Date(b.date + 'T00:00').getDate()}</span><span className="tiny">{fmtDate(b.date, { month: 'short' })}</span>
                  </div>
                  <div className="grow"><b className="small">{fullName(b)}</b><div className="tiny muted">{b.time} · {SERVICES[b.service]?.short}</div></div>
                  <Badge tone={BOOKING_STATUS[b.status].tone}>{b.date === today ? 'Hoy' : BOOKING_STATUS[b.status].label}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useMemberBookings, usePlan, useProgress } from '../../lib/hooks';
import { Avatar, Badge, Icon, Ring } from '../../components/ui';
import { BOOKING_STATUS, GOALS, SERVICES, fmtDate, todayISO } from '../../lib/utils';
import PushCard from '../../components/PushCard';
import { normalizeDiet, normalizeRoutine } from '../../lib/plans';

export default function TeamHome({ unread }) {
  const { member } = useSession();
  const diet = usePlan(member.id, 'diet').data;
  const routine = usePlan(member.id, 'routine').data;
  const progress = useProgress(member.id).list;
  const bookings = useMemberBookings(member.id).list;
  const next = bookings
    .filter((b) => b.date >= todayISO() && ['pendiente', 'aceptada'].includes(b.status))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const last = progress[0], first = progress[progress.length - 1];
  const delta = last && first && last !== first ? Math.round((last.weightKg - first.weightKg) * 10) / 10 : null;
  const reviewIn = member.nextReview ? Math.round((new Date(member.nextReview + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000) : 99;
  const hour = new Date().getHours();
  const hi = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const days = normalizeRoutine(routine?.data)?.days || [];
  const todayIdx = days.length ? (new Date().getDay() + 6) % 7 % days.length : -1;

  return (
    <div className="stack stagger" style={{ gap: 18 }}>
      <div className="row nowrap" style={{ gap: 16 }}>
        <Avatar person={member} size="lg" />
        <div className="grow">
          <div className="muted small">{hi},</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(2rem,6vw,2.8rem)' }}>{member.firstName}</h1>
          <div className="row small" style={{ gap: 8, marginTop: 6 }}>
            <Badge tone="sage">Team · {member.id}</Badge>
            {member.goal && <Badge plain>{GOALS[member.goal]}</Badge>}
          </div>
        </div>
      </div>

      <PushCard docPath={`members/${member.id}`} />

      {member.nextReview && !next && reviewIn <= 3 && (
        <div className="card review-card row between fade-in">
          <div className="row nowrap grow">
            <span className="avatar" style={{ background: '#fff' }}><Icon name="calendar" /></span>
            <div>
              <b>{reviewIn < 0 ? 'Tu revisión está pendiente' : reviewIn === 0 ? 'Hoy te toca revisión' : `Tu revisión es en ${reviewIn} día${reviewIn === 1 ? '' : 's'}`}</b>
              <div className="small">Cada 3 semanas revisamos tu avance y ajustamos tu plan. Agenda tu cita ({fmtDate(member.nextReview, { weekday: 'long', day: 'numeric', month: 'long' })}).</div>
            </div>
          </div>
          <Link to="/team/reservar" className="btn sm">Agendar</Link>
        </div>
      )}

      <div className="grid g3">
        <Link to="/team/dieta" className="card click" style={{ textDecoration: 'none' }}>
          <div className="row between nowrap">
            <div><div className="eyebrow">Dieta</div><h3 style={{ marginTop: 8 }}>{diet?.data?.title || 'En preparación'}</h3>
              <div className="small muted">{normalizeDiet(diet?.data)?.days?.length ? `${normalizeDiet(diet.data).days[0].meals.length} tiempos de comida al día` : 'Keila la publicará pronto'}</div></div>
            {diet?.data?.calories ? <Ring value={1} max={1} label={diet.data.calories} sub="kcal" /> : <Icon name="apple" size={40} />}
          </div>
        </Link>
        <Link to="/team/rutina" className="card click" style={{ textDecoration: 'none' }}>
          <div className="eyebrow">Rutina de hoy</div>
          <h3 style={{ marginTop: 8 }}>{todayIdx >= 0 ? days[todayIdx].name : 'En preparación'}</h3>
          <div className="small muted">{todayIdx >= 0 ? `${days[todayIdx].blocks.reduce((n, b) => n + b.exercises.length, 0)} ejercicios` : 'Explora la biblioteca de ejercicios'}</div>
          <div className="row mt"><span className="btn sm sage">Ver rutina <Icon name="arrowR" size={16} /></span></div>
        </Link>
        <Link to="/team/progreso" className="card click" style={{ textDecoration: 'none' }}>
          <div className="eyebrow">Progreso</div>
          <div className="row between mt" style={{ alignItems: 'flex-end' }}>
            <div className="stat"><span className="v">{last?.weightKg ?? member.weightKg ?? '—'}</span><span className="l">kg actual</span></div>
            {delta != null && <Badge tone={delta <= 0 ? 'ok' : 'warn'}>{delta > 0 ? '+' : ''}{delta} kg</Badge>}
          </div>
          <div className="small muted mt">{progress.length} registros</div>
        </Link>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-title"><h4>Próxima cita</h4><Link to="/team/reservar" className="btn sm">Reservar</Link></div>
          {next ? (
            <div className="row nowrap">
              <div className="avatar lg" style={{ borderRadius: 18, flexDirection: 'column', lineHeight: 1 }}>
                <span style={{ fontSize: '1.8rem' }}>{new Date(next.date + 'T00:00').getDate()}</span>
                <span className="tiny" style={{ fontFamily: 'var(--sans)' }}>{fmtDate(next.date, { month: 'short' })}</span>
              </div>
              <div>
                <b>{SERVICES[next.service]?.label}</b>
                <div className="small muted">{fmtDate(next.date, { weekday: 'long' })} · {next.time}</div>
                <Badge tone={BOOKING_STATUS[next.status]?.tone}>{BOOKING_STATUS[next.status]?.label}</Badge>
              </div>
            </div>
          ) : <p className="muted small">No tienes citas próximas.{member.nextReview ? ` Tu próxima revisión sugerida es el ${fmtDate(member.nextReview, { day: 'numeric', month: 'long' })}.` : ''}</p>}
        </div>
        <Link to="/team/avisos" className="card click" style={{ textDecoration: 'none' }}>
          <div className="card-title"><h4>Avisos de Keila</h4>{unread > 0 && <Badge tone="danger">{unread} nuevos</Badge>}</div>
          <p className="small muted" style={{ margin: 0 }}>{unread ? 'Tienes mensajes sin leer.' : 'Estás al día. Aquí verás los mensajes y actualizaciones de tu plan.'}</p>
        </Link>
      </div>
    </div>
  );
}

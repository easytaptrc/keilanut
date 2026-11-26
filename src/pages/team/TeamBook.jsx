import { useState } from 'react';
import { useSession } from '../../lib/session';
import { useMemberBookings } from '../../lib/hooks';
import BookingForm from '../../components/BookingForm';
import { useSchedule } from '../Reservar';
import { Badge, Empty, useToast } from '../../components/ui';
import { serviceName, useServices } from '../../lib/config';
import { BOOKING_STATUS, fmtDate } from '../../lib/utils';

export default function TeamBook() {
  const services = useServices();
  const { member } = useSession();
  const schedule = useSchedule();
  const toast = useToast();
  const { list } = useMemberBookings(member.id);
  const [k, setK] = useState(0);
  const sorted = [...list].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Reservar cita</h1></div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          {schedule ? <BookingForm key={k} member={member} schedule={schedule} onDone={() => { toast({ title: '¡Reservación enviada!', body: 'Keila te confirmará pronto.' }, 'ok'); setK(k + 1); }} /> : <div className="skeleton" style={{ height: 280 }} />}
        </div>
        <div className="card">
          <h4>Mis citas</h4>
          {!sorted.length ? <Empty icon="📅">Aún no tienes citas registradas.</Empty> : (
            <div className="list">
              {sorted.map((b) => (
                <div key={b.id} className="list-item" style={{ cursor: 'default' }}>
                  <div className="grow">
                    <b className="small">{serviceName(services, b)}</b>
                    <div className="tiny muted">{fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {b.time}</div>
                  </div>
                  <Badge tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.label}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

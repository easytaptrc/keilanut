import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import BookingForm, { DEFAULT_SCHEDULE } from '../components/BookingForm';
import { Icon } from '../components/ui';
import { SiteNav, Footer, useContact } from './Home';
import { SERVICES, fmtDate, waLink } from '../lib/utils';

export function useSchedule() {
  const [s, setS] = useState(null);
  useEffect(() => {
    getDoc(doc(db, 'settings', 'public'))
      .then((d) => setS(d.data()?.schedule || DEFAULT_SCHEDULE))
      .catch(() => setS(DEFAULT_SCHEDULE));
  }, []);
  return s;
}

export default function Reservar() {
  const [params] = useSearchParams();
  const schedule = useSchedule();
  const contact = useContact();
  const [done, setDone] = useState(null);

  return (
    <>
      <SiteNav />
      <main className="section" style={{ paddingTop: 40 }}>
        <div className="container" style={{ maxWidth: 860 }}>
          {done ? (
            <div className="card center fade-in" style={{ padding: '48px 24px' }}>
              <div className="avatar lg" style={{ margin: '0 auto 16px', background: 'var(--ok-bg)', color: 'var(--ok)' }}><Icon name="check" size={40} /></div>
              <h2>¡Reservación enviada!</h2>
              <p className="muted" style={{ maxWidth: 520, margin: '0 auto 18px' }}>
                Gracias, {done.firstName}. Solicitaste <b>{SERVICES[done.service]?.label}</b> el <b>{fmtDate(done.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b> a las <b>{done.time}</b>.
                Keila revisará tu información y te confirmará. Al aceptarte recibirás tu <b>ID de Team</b> para entrar a tu app.
              </p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <Link to="/" className="btn ghost">Volver al inicio</Link>
                {contact?.whatsapp && (
                  <a className="btn sage" target="_blank" rel="noreferrer" href={waLink(contact.whatsapp, `Hola Keila, soy ${done.firstName} ${done.lastName}. Acabo de reservar para el ${done.date} a las ${done.time}.`)}>
                    <Icon name="whatsapp" size={18} /> Avisar por WhatsApp
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="section-head" style={{ marginBottom: 30 }}>
                <div className="eyebrow">Reservación</div>
                <h1 style={{ fontSize: 'clamp(2rem,5vw,3.2rem)' }}>Agenda tu consulta</h1>
                <p className="muted">Llena tu registro con calma: con esta información Keila preparará tu plan a tu medida. Tus datos son confidenciales.</p>
              </div>
              <div className="card">
                {schedule ? <BookingForm schedule={schedule} initialService={params.get('servicio') || ''} onDone={setDone} /> : <div className="skeleton" style={{ height: 300 }} />}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer contact={contact} />
    </>
  );
}

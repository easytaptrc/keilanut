import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import BookingForm, { DEFAULT_SCHEDULE } from '../components/BookingForm';
import { Icon } from '../components/ui';
import { SiteNav, Footer, useContact } from './Home';
import { fmtDate, waLink } from '../lib/utils';
import { DEFAULT_SITE, usePublicSettings } from '../lib/config';

export function useSchedule() {
  const p = usePublicSettings();
  return p ? p.schedule || DEFAULT_SCHEDULE : null;
}

export default function Reservar() {
  const [params] = useSearchParams();
  const schedule = useSchedule();
  const contact = useContact();
  const p = usePublicSettings();
  const site = p?.site || DEFAULT_SITE;
  const [done, setDone] = useState(null);

  return (
    <>
      <SiteNav />
      <main className="section" style={{ paddingTop: 40 }}>
        <div className="container" style={{ maxWidth: 860 }}>
          {done ? (
            <div className="card center fade-in" style={{ padding: '48px 24px' }}>
              <div className="avatar lg" style={{ margin: '0 auto 16px', background: 'var(--ok-bg)', color: 'var(--ok)' }}><Icon name="check" size={40} /></div>
              <h2>{site.bookingDoneTitle}</h2>
              <p className="muted" style={{ maxWidth: 520, margin: '0 auto 18px' }}>
                Gracias, {done.firstName}. Solicitaste <b>{done.serviceLabel || done.service}</b> el <b>{fmtDate(done.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b> a las <b>{done.time}</b>.{' '}
                {site.bookingDoneText}
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
                <div className="eyebrow">{site.bookingEyebrow}</div>
                <h1 style={{ fontSize: 'clamp(2rem,5vw,3.2rem)' }}>{site.bookingTitle}</h1>
                <p className="muted">{site.bookingLead}</p>
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

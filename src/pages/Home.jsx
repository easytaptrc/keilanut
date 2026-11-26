import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand, ExerciseAnim, Icon, useReveal } from '../components/ui';
import { waLink } from '../lib/utils';
import { DEFAULT_SERVICES, DEFAULT_SITE, activeServices, usePublicSettings, useSiteImage } from '../lib/config';

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 10);
    f(); window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return (
    <nav className={`site-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="container inner">
        <Brand />
        <div className="nav-links">
          <a href="/#servicios" className="hide-m">Servicios</a>
          <a href="/#team" className="hide-m">Team</a>
          <Link to="/team" className="btn ghost sm">Team</Link>
          <Link to="/reservar" className="btn sm">Reservar</Link>
        </div>
      </div>
    </nav>
  );
}

function Leaf({ style, size = 60 }) {
  return (
    <svg className="leaf" style={style} width={size} height={size} viewBox="0 0 60 60" fill="currentColor" aria-hidden>
      <path d="M8 52C8 26 26 8 54 6c-2 28-20 46-46 46zm6-6c10-10 20-20 32-32-14 8-24 18-32 32z" />
    </svg>
  );
}

export function useContact() {
  const p = usePublicSettings();
  return p ? { ...p.raw, whatsapp: p.whatsapp, instagram: p.instagram, address: p.address, email: p.email } : null;
}

/** Texto con *palabras* en cursiva */
function Rich({ text }) {
  return String(text || '').split(/(\*[^*]+\*)/g).map((t, i) => (t.startsWith('*') && t.endsWith('*') ? <i key={i}>{t.slice(1, -1)}</i> : t));
}

export function Footer({ contact }) {
  const p = usePublicSettings();
  const site = p?.site || DEFAULT_SITE;
  return (
    <footer className="footer">
      <div className="container row between" style={{ alignItems: 'flex-start', gap: 28 }}>
        <div style={{ maxWidth: 320 }}>
          <img src="/logo.png" alt="Keila Guerrero, Lic. Nutrición" style={{ width: 170, marginBottom: 12 }} />
          <p className="small muted">{site.footerText}</p>
        </div>
        <div className="stack small" style={{ gap: 8 }}>
          <b>Navegación</b>
          <Link to="/reservar">Reservar cita</Link>
          <Link to="/team">Entrar a Team</Link>
          <Link to="/admin" className="muted">Acceso administración</Link>
        </div>
        <div className="stack small" style={{ gap: 8 }}>
          <b>Contacto</b>
          {contact?.whatsapp && <a href={waLink(contact.whatsapp, 'Hola Keila, me gustaría información sobre la consulta.')} target="_blank" rel="noreferrer">WhatsApp</a>}
          {contact?.instagram && <a href={`https://instagram.com/${contact.instagram.replace('@', '')}`} target="_blank" rel="noreferrer">Instagram {contact.instagram}</a>}
          {contact?.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          {contact?.address && <span className="muted">{contact.address}</span>}
          {!contact?.whatsapp && !contact?.instagram && <span className="muted">Reserva tu cita en línea</span>}
        </div>
      </div>
      <div className="container tiny muted mt2">© {new Date().getFullYear()} Keila Guerrero · Lic. en Nutrición</div>
    </footer>
  );
}

function ServiceCard({ k, s, i }) {
  const img = useSiteImage(`service-${k}`);
  return (
    <div className="card service-card reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
      {img ? <img className="service-img" src={img} alt={s.label} loading="lazy" /> : <div className="ico"><Icon name={s.icon || 'leaf'} size={26} /></div>}
      <h3>{s.label}</h3>
      <p className="muted">{s.desc}</p>
      {!!s.bullets?.filter(Boolean).length && <ul>{s.bullets.filter(Boolean).map((b) => <li key={b}>{b}</li>)}</ul>}
      <Link to={`/reservar?servicio=${k}`} className="btn sage" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>Reservar {(s.short || s.label).toLowerCase()}</Link>
    </div>
  );
}

const TEAM_ICONS = ['apple', 'dumbbell', 'chart', 'bell', 'calendar', 'leaf', 'sparkle', 'check'];

export default function Home() {
  const ref = useReveal();
  const p = usePublicSettings();
  const contact = useContact();
  const site = p?.site || DEFAULT_SITE;
  const services = activeServices(p?.services || DEFAULT_SERVICES);
  const aboutImg = useSiteImage(site.aboutEnabled ? 'about' : null);
  return (
    <div ref={ref}>
      <SiteNav />
      <header className="hero">
        <div className="hero-ring" style={{ width: 620, height: 620, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        <div className="hero-ring" style={{ width: 900, height: 900, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.6 }} />
        <Leaf style={{ top: '14%', left: '8%' }} size={70} />
        <Leaf style={{ bottom: '18%', right: '9%', animationDelay: '-3s', transform: 'scaleX(-1)' }} size={90} />
        <Leaf style={{ top: '22%', right: '20%', animationDelay: '-5s' }} size={34} />
        <div className="container" style={{ position: 'relative' }}>
          <img className="mono" src="/monogram.png" alt="Monograma GK" />
          <div className="eyebrow" style={{ marginBottom: 14, animation: 'pop 1s .1s both' }}>{site.heroEyebrow}</div>
          <h1><Rich text={site.heroTitle} /></h1>
          <p className="lead">{site.heroLead}</p>
          <div className="cta">
            <Link to="/reservar" className="btn">{site.ctaPrimary} <Icon name="arrowR" size={18} /></Link>
            <Link to="/team" className="btn ghost">{site.ctaSecondary}</Link>
          </div>
        </div>
        <div className="scroll-hint">Descubre</div>
      </header>

      <section className="section alt" id="servicios">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">{site.servicesEyebrow}</div>
            <h2>{site.servicesTitle}</h2>
            <p className="muted">{site.servicesLead}</p>
          </div>
          <div className={`grid ${Object.keys(services).length >= 3 ? 'g3' : 'g2'}`}>
            {Object.entries(services).map(([k, s], i) => <ServiceCard key={k} k={k} s={s} i={i} />)}
          </div>
        </div>
      </section>

      {site.aboutEnabled && (
        <section className="section" id="sobre-mi">
          <div className="container grid g2 about" style={{ alignItems: 'center', gap: 40 }}>
            {aboutImg && <div className="reveal"><img className="about-img" src={aboutImg} alt={site.aboutTitle} /></div>}
            <div className="reveal" style={{ transitionDelay: '.1s' }}>
              <div className="eyebrow">{site.aboutEyebrow}</div>
              <h2>{site.aboutTitle}</h2>
              {String(site.aboutText || '').split(/\n{2,}/).map((t, i) => <p key={i} className="muted" style={{ whiteSpace: 'pre-line' }}>{t}</p>)}
            </div>
          </div>
        </section>
      )}

      <section className={`section ${site.aboutEnabled ? 'alt' : ''}`}>
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">{site.processEyebrow}</div>
            <h2>{site.processTitle}</h2>
          </div>
          <div className={`grid ${site.steps.length === 3 ? 'g3' : 'g4'} steps`}>
            {site.steps.filter((s) => s.title || s.text).map((s, i) => (
              <div className="step reveal" key={i} style={{ transitionDelay: `${i * 0.08}s` }}>
                <div className="n">{String(i + 1).padStart(2, '0')}</div>
                <div><h4>{s.title}</h4><p className="small muted">{s.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`section ${site.aboutEnabled ? '' : 'alt'}`} id="team">
        <div className="container grid g2" style={{ alignItems: 'center', gap: 40 }}>
          <div className="reveal">
            <div className="eyebrow">{site.teamEyebrow}</div>
            <h2>{site.teamTitle}</h2>
            <p className="muted">{site.teamLead}</p>
            <div className="stack" style={{ gap: 12, marginTop: 18 }}>
              {site.teamItems.filter(Boolean).map((t, i) => (
                <div className="row nowrap" key={i}><span className="avatar" style={{ width: 38, height: 38 }}><Icon name={TEAM_ICONS[i % TEAM_ICONS.length]} size={18} /></span><span>{t}</span></div>
              ))}
            </div>
            <div className="row mt2">
              <Link to="/team" className="btn">Entrar a Team</Link>
            </div>
          </div>
          <div className="reveal" style={{ transitionDelay: '.15s' }}>
            <div className="grid g2" style={{ gap: 12 }}>
              {['Barbell_Hip_Thrust', 'Dumbbell_Lunges', 'Side_Lateral_Raise', 'Seated_Cable_Rows'].map((id, i) => (
                <div key={id} className="card flat" style={{ padding: 8, transform: `translateY(${i % 2 ? 24 : 0}px)` }}><ExerciseAnim id={id} smooth /></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {site.quote && (
        <section className="section">
          <div className="container reveal">
            <p className="quote">“{site.quote}”</p>
            {site.quoteAuthor && <p className="center eyebrow mt">{site.quoteAuthor}</p>}
            <div className="row mt2" style={{ justifyContent: 'center' }}>
              <Link to="/reservar" className="btn sage">{site.quoteCta || 'Reservar'}</Link>
            </div>
          </div>
        </section>
      )}
      <Footer contact={contact} />
    </div>
  );
}

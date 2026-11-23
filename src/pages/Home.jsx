import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Brand, ExerciseAnim, Icon, useReveal } from '../components/ui';
import { SERVICES, waLink } from '../lib/utils';

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
  const [c, setC] = useState(null);
  useEffect(() => { getDoc(doc(db, 'settings', 'public')).then((d) => setC(d.data() || {})).catch(() => setC({})); }, []);
  return c;
}

export function Footer({ contact }) {
  return (
    <footer className="footer">
      <div className="container row between" style={{ alignItems: 'flex-start', gap: 28 }}>
        <div style={{ maxWidth: 320 }}>
          <img src="/logo.png" alt="Keila Guerrero, Lic. Nutrición" style={{ width: 170, marginBottom: 12 }} />
          <p className="small muted">Nutrición clínica y deportiva con un enfoque humano, realista y basado en evidencia.</p>
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
          {contact?.address && <span className="muted">{contact.address}</span>}
          {!contact?.whatsapp && !contact?.instagram && <span className="muted">Reserva tu cita en línea</span>}
        </div>
      </div>
      <div className="container tiny muted mt2">© {new Date().getFullYear()} Keila Guerrero · Lic. en Nutrición</div>
    </footer>
  );
}

export default function Home() {
  const ref = useReveal();
  const contact = useContact();
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
          <div className="eyebrow" style={{ marginBottom: 14, animation: 'pop 1s .1s both' }}>Lic. en Nutrición · Keila Guerrero</div>
          <h1>Nutrición que se <i>adapta</i> a tu vida</h1>
          <p className="lead">Planes de alimentación y entrenamiento personalizados, diseñados según tu historia clínica, tu cuerpo y tu objetivo. Sin dietas extremas, con resultados reales.</p>
          <div className="cta">
            <Link to="/reservar" className="btn">Reservar mi cita <Icon name="arrowR" size={18} /></Link>
            <Link to="/team" className="btn ghost">Soy parte del Team</Link>
          </div>
        </div>
        <div className="scroll-hint">Descubre</div>
      </header>

      <section className="section alt" id="servicios">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">Servicios</div>
            <h2>Elige cómo quieres empezar</h2>
            <p className="muted">Ambas modalidades incluyen evaluación completa, plan personalizado y acceso a la app Team.</p>
          </div>
          <div className="grid g2">
            <div className="card service-card reveal">
              <div className="ico"><Icon name="video" size={26} /></div>
              <h3>{SERVICES.online.label}</h3>
              <p className="muted">{SERVICES.online.desc}</p>
              <ul>
                <li>Videollamada con evaluación de hábitos e historial</li>
                <li>Plan de alimentación y rutina en tu app</li>
                <li>Seguimiento de progreso y notificaciones</li>
              </ul>
              <Link to="/reservar?servicio=online" className="btn sage" style={{ alignSelf: 'flex-start' }}>Reservar online</Link>
            </div>
            <div className="card service-card reveal" style={{ transitionDelay: '.1s' }}>
              <div className="ico"><Icon name="pin" size={26} /></div>
              <h3>{SERVICES.presencial.label}</h3>
              <p className="muted">{SERVICES.presencial.desc}</p>
              <ul>
                <li>Mediciones antropométricas y composición corporal</li>
                <li>Plan de alimentación y rutina en tu app</li>
                <li>Seguimiento cercano en cada cita</li>
              </ul>
              <Link to="/reservar?servicio=presencial" className="btn sage" style={{ alignSelf: 'flex-start' }}>Reservar presencial</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <div className="eyebrow">Proceso</div>
            <h2>Así trabajamos juntas</h2>
          </div>
          <div className="grid g4 steps">
            {[
              ['Reserva', 'Llena tu registro con tu historial clínico, hábitos y objetivo.'],
              ['Evaluación', 'Keila revisa tu caso y confirma tu cita online o presencial.'],
              ['Tu plan', 'Recibes tu dieta y rutina personalizadas dentro de tu app Team.'],
              ['Seguimiento', 'Registra tu progreso y recibe avisos y ajustes a tu plan.'],
            ].map(([t, d], i) => (
              <div className="step reveal" key={t} style={{ transitionDelay: `${i * 0.08}s` }}>
                <div className="n">0{i + 1}</div>
                <div><h4>{t}</h4><p className="small muted">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="team">
        <div className="container grid g2" style={{ alignItems: 'center', gap: 40 }}>
          <div className="reveal">
            <div className="eyebrow">App Team</div>
            <h2>Tu plan completo, en tu bolsillo</h2>
            <p className="muted">Al formar parte del Team recibes tu ID de acceso. Instala la app en tu teléfono y lleva todo contigo:</p>
            <div className="stack" style={{ gap: 12, marginTop: 18 }}>
              {[
                ['apple', 'Tu dieta con porciones, horarios y recomendaciones'],
                ['dumbbell', 'Tu rutina con animaciones de cada ejercicio'],
                ['chart', 'Tu progreso: peso y medidas en gráficas'],
                ['bell', 'Notificaciones directas de Keila'],
                ['calendar', 'Agenda tu siguiente cita en un toque'],
              ].map(([ic, t]) => (
                <div className="row nowrap" key={t}><span className="avatar" style={{ width: 38, height: 38 }}><Icon name={ic} size={18} /></span><span>{t}</span></div>
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

      <section className="section">
        <div className="container reveal">
          <p className="quote">“No se trata de comer menos, se trata de comer mejor y sostenerlo en el tiempo.”</p>
          <p className="center eyebrow mt">Keila Guerrero</p>
          <div className="row mt2" style={{ justifyContent: 'center' }}>
            <Link to="/reservar" className="btn sage">Agenda tu primera cita</Link>
          </div>
        </div>
      </section>
      <Footer contact={contact} />
    </div>
  );
}

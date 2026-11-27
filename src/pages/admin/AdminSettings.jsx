// Ajustes: todo lo configurable del sitio, la reservación, el historial, el panel del paciente y la IA.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDoc } from '../../lib/hooks';
import { Icon } from '../../components/ui';
import { cx } from '../../lib/utils';
import SiteSettings from './settings/SiteSettings';
import ServicesSettings from './settings/ServicesSettings';
import ScheduleSettings from './settings/ScheduleSettings';
import { BookingFormSettings, ClinicalFormSettings } from './settings/FormsSettings';
import { AISettings, AccountSettings, TeamSettings } from './settings/OtherSettings';
import EnergySettings from './settings/EnergySettings';
import StaffSettings from './settings/StaffSettings';

const TABS = [
  ['sitio', 'home', 'Sitio y contacto'],
  ['servicios', 'money', 'Servicios y precios'],
  ['horario', 'calendar', 'Horario de citas'],
  ['reservacion', 'list', 'Preguntas de reservación'],
  ['historial', 'file', 'Historial clínico'],
  ['calculo', 'chart', 'Cálculo energético'],
  ['paciente', 'users', 'App del paciente'],
  ['ia', 'sparkle', 'Inteligencia artificial'],
  ['equipo', 'users', 'Recepción y equipo'],
  ['cuenta', 'lock', 'Cuenta y respaldo'],
];

export default function AdminSettings() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'sitio';
  const pub = useDoc('settings/public');
  const adm = useDoc('settings/admin');
  const [stamp] = useState(() => Date.now());
  const go = (k) => { if (document.querySelector('.save-bar .small') && !window.confirm('Tienes cambios sin guardar en esta sección. ¿Salir sin guardar?')) return; setParams({ tab: k }, { replace: true }); window.scrollTo({ top: 0 }); };

  if (pub.loading || adm.loading) return <div className="skeleton" style={{ height: 300 }} />;
  const p = pub.data || {}, a = adm.data || {};
  const title = TABS.find(([k]) => k === tab)[2];
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="topbar"><h1>Ajustes</h1></div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Secciones de ajustes">
          {TABS.map(([k, ic, l]) => <button key={k} type="button" className={cx(tab === k && 'on')} onClick={() => go(k)}><Icon name={ic} size={18} />{l}</button>)}
        </nav>
        <div className="stack fade-in" key={tab + stamp} style={{ gap: 14, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {tab === 'sitio' && <SiteSettings pub={p} />}
          {tab === 'servicios' && <ServicesSettings pub={p} adm={a} />}
          {tab === 'horario' && <ScheduleSettings pub={p} />}
          {tab === 'reservacion' && <BookingFormSettings pub={p} />}
          {tab === 'historial' && <ClinicalFormSettings adm={a} />}
          {tab === 'paciente' && <TeamSettings pub={p} />}
          {tab === 'ia' && <AISettings adm={a} />}
          {tab === 'calculo' && <EnergySettings adm={a} />}
          {tab === 'equipo' && <StaffSettings />}
          {tab === 'cuenta' && <AccountSettings />}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { isIOS, isStandalone } from '../lib/utils';
import { Icon } from './ui';

let deferred = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; window.dispatchEvent(new Event('kg-installable')); });
}

const KEY = 'kg-install-dismissed';
const getDismissed = () => { try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; } };

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (Date.now() - getDismissed() < 1000 * 60 * 60 * 24 * 5) return;
    if (isIOS()) { setIos(true); const t = setTimeout(() => setShow(true), 2500); return () => clearTimeout(t); }
    const on = () => setShow(true);
    if (deferred) on();
    window.addEventListener('kg-installable', on);
    return () => window.removeEventListener('kg-installable', on);
  }, []);

  const dismiss = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* */ } };
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    setShow(false);
  };

  if (!show) return null;
  return (
    <div className="install-banner">
      <img src="/icons/icon-192.png" alt="" />
      <div className="grow small">
        <b>Instala la app Keila Nutri</b>
        <div style={{ opacity: 0.8 }}>
          {ios ? <>Toca <Icon name="share" size={14} /> Compartir y luego “Agregar a inicio” para recibir notificaciones.</> : 'Accede rápido y recibe notificaciones de tu plan.'}
        </div>
      </div>
      {!ios && <button className="btn light sm" onClick={install}>Instalar</button>}
      <button className="icon-btn" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.25)', color: '#fff', width: 32, height: 32 }} onClick={dismiss} aria-label="Cerrar"><Icon name="x" size={16} /></button>
    </div>
  );
}

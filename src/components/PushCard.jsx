import { useEffect, useState } from 'react';
import { enablePush, pushPermission, pushSupported } from '../lib/push';
import { isIOS, isStandalone } from '../lib/utils';
import { Icon, useToast } from './ui';

export default function PushCard({ docPath, compact }) {
  const toast = useToast();
  const [perm, setPerm] = useState(pushPermission());
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushSupported().then(setSupported); }, []);

  // Si ya hay permiso, refrescamos el token en silencio (cambia con el tiempo)
  useEffect(() => {
    if (perm === 'granted' && supported) enablePush(docPath).catch(() => {});
  }, [perm, supported, docPath]);

  if (perm === 'granted') return compact ? <div className="success-box small">🔔 Notificaciones activadas en este dispositivo.</div> : null;
  const iosNeedsInstall = isIOS() && !isStandalone();

  const go = async () => {
    setBusy(true);
    try { await enablePush(docPath); setPerm('granted'); toast('Notificaciones activadas', 'ok'); }
    catch (e) { toast(e.message, 'err'); setPerm(pushPermission()); }
    finally { setBusy(false); }
  };

  return (
    <div className="card soft row between">
      <div className="row nowrap grow">
        <span className="avatar" style={{ background: '#fff' }}><Icon name="bell" /></span>
        <div className="small">
          <b>Activa tus notificaciones</b>
          <div className="muted">
            {iosNeedsInstall ? 'En iPhone: agrega la app a tu pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.'
              : !supported ? 'Este navegador no admite notificaciones push.'
              : perm === 'denied' ? 'Las bloqueaste: actívalas desde la configuración del navegador para este sitio.'
              : 'Recibe avisos cuando Keila actualice tu plan o te envíe un mensaje.'}
          </div>
        </div>
      </div>
      {supported && !iosNeedsInstall && perm !== 'denied' && <button className="btn sm sage" disabled={busy} onClick={go}>Activar</button>}
    </div>
  );
}

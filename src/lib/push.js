// Notificaciones push (Firebase Cloud Messaging) + avisos locales cuando la app está abierta.
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { app, db } from '../firebase';

let swReg = null;

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    swReg = await navigator.serviceWorker.register('/sw.js');
    return swReg;
  } catch (e) {
    console.warn('SW no registrado', e);
    return null;
  }
}

export const pushSupported = async () => 'Notification' in window && 'serviceWorker' in navigator && (await isSupported().catch(() => false));
export const pushPermission = () => ('Notification' in window ? Notification.permission : 'unsupported');

/** Pide permiso y guarda el token FCM en el documento indicado (members/{id} o admins/{uid}). */
export async function enablePush(docPath) {
  if (!(await pushSupported())) throw new Error('Este navegador no admite notificaciones. En iPhone, primero agrega la app a tu pantalla de inicio.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permiso de notificaciones denegado. Actívalo en la configuración del navegador.');
  const reg = swReg || (await navigator.serviceWorker.ready);
  const token = await getToken(getMessaging(app), { serviceWorkerRegistration: reg });
  if (token) await updateDoc(doc(db, docPath), { fcmTokens: arrayUnion(token) });
  return token;
}

/** Muestra una notificación del sistema (si hay permiso) usando el service worker. */
export async function localNotify(title, body, url = '/') {
  if (pushPermission() !== 'granted') return;
  try {
    const reg = swReg || (await navigator.serviceWorker.ready);
    reg.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/favicon.png', data: { url }, tag: title + body });
  } catch { /* ignorar */ }
}

export async function listenForeground(cb) {
  if (!(await pushSupported())) return () => {};
  return onMessage(getMessaging(app), (p) => cb?.(p));
}

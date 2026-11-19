// Cloud Functions: envía notificaciones push (FCM) cuando se crea un aviso o una reservación.
// Requiere plan Blaze en Firebase. Despliegue: firebase deploy --only functions
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });
const db = getFirestore();

const INVALID = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

async function sendTo(ref, tokens, data) {
  const list = [...new Set(tokens || [])].filter(Boolean);
  if (!list.length) return;
  const res = await getMessaging().sendEachForMulticast({
    tokens: list,
    data,
    webpush: { headers: { Urgency: 'high', TTL: '86400' }, fcmOptions: { link: data.url } },
  });
  const bad = [];
  res.responses.forEach((r, i) => { if (!r.success && INVALID.has(r.error?.code)) bad.push(list[i]); });
  if (bad.length) await ref.update({ fcmTokens: FieldValue.arrayRemove(...bad) });
}

exports.pushMemberNotification = onDocumentCreated('members/{memberId}/notifications/{nid}', async (event) => {
  const n = event.data?.data();
  if (!n) return;
  const ref = db.doc(`members/${event.params.memberId}`);
  const m = (await ref.get()).data();
  await sendTo(ref, m?.fcmTokens, {
    title: String(n.title || 'Keila Guerrero · Nutrición').slice(0, 120),
    body: String(n.body || '').slice(0, 500),
    url: n.type === 'plan' ? '/team' : '/team/avisos',
  });
});

exports.pushNewBooking = onDocumentCreated('bookings/{bookingId}', async (event) => {
  const b = event.data?.data();
  if (!b) return;
  const admins = await db.collection('admins').get();
  const kind = b.memberId ? `Team ${b.memberId}` : 'Paciente nuevo';
  await Promise.all(admins.docs.map((d) => sendTo(d.ref, d.data().fcmTokens, {
    title: 'Nueva reservación',
    body: `${b.firstName || ''} ${b.lastName || ''} · ${b.date} ${b.time} · ${kind}`,
    url: `/admin/reservaciones?id=${event.params.bookingId}`,
  })));
});

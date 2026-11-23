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

// ---------- Recordatorio de revisión (cada 3 semanas) ----------
const { onSchedule } = require('firebase-functions/v2/scheduler');
const TZ = 'America/Monterrey';
const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const human = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} de ${MESES[m - 1]}`; };

exports.reviewReminders = onSchedule({ schedule: 'every day 09:00', timeZone: TZ, retryCount: 1 }, async () => {
  const today = isoToday();
  const snap = await db.collection('members').where('nextReview', '<=', addDays(today, 3)).get();
  let sent = 0;
  for (const m of snap.docs) {
    const data = m.data();
    if (data.active === false || !data.nextReview) continue;
    const left = diffDays(today, data.nextReview);
    if (left < -7) continue; // muy atrasado: ya no insistimos
    const stage = left > 0 ? 'pre' : 'due';
    const flag = stage === 'pre' ? 'reminderPreFor' : 'reminderDueFor';
    if (data[flag] === data.nextReview) continue;
    // Si ya tiene una cita próxima, no se envía el aviso
    const bookings = await db.collection('bookings').where('memberId', '==', m.id).get();
    if (bookings.docs.some((b) => b.data().date >= today && ['pendiente', 'aceptada'].includes(b.data().status))) continue;
    const title = stage === 'pre' ? `Tu revisión es en ${left} día${left === 1 ? '' : 's'} 📅` : 'Te toca tu revisión 📅';
    const body = stage === 'pre'
      ? `Cada 3 semanas revisamos tu avance. Tu próxima revisión es el ${human(data.nextReview)}: agenda tu cita desde la app.`
      : 'Ya se cumplieron 3 semanas desde tu última consulta. Reserva tu cita para revisar tu avance y ajustar tu plan.';
    await m.ref.collection('notifications').add({ title, body, type: 'booking', read: false, createdAt: FieldValue.serverTimestamp() });
    await m.ref.update({ [flag]: data.nextReview });
    sent++;
  }
  console.log(`Recordatorios enviados: ${sent}`);
});

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

// Solo se borran tokens realmente inválidos (no por otros errores del mensaje)
const INVALID = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
const SITE = 'https://kg-nutricion.com';

async function sendTo(ref, tokens, data) {
  const list = [...new Set(tokens || [])].filter(Boolean);
  if (!list.length) return;
  const res = await getMessaging().sendEachForMulticast({
    tokens: list,
    data,
    webpush: { headers: { Urgency: 'high', TTL: '86400' }, fcmOptions: { link: SITE + data.url } },
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
  // Configuración desde Ajustes → App del paciente
  const team = (await db.doc('settings/public').get()).data()?.team || {};
  if (team.reminders === false) { console.log('Recordatorios desactivados en Ajustes'); return; }
  const before = Math.max(0, Math.min(14, Number(team.reminderDaysBefore ?? 3)));
  const weeks = Math.max(1, Number(team.reviewWeeks) || 3);
  const snap = await db.collection('members').where('nextReview', '<=', addDays(today, before)).get();
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
      ? `Cada ${weeks} semana${weeks > 1 ? 's' : ''} revisamos tu avance. Tu próxima revisión es el ${human(data.nextReview)}: agenda tu cita desde la app.`
      : `Ya se cumplieron ${weeks} semana${weeks > 1 ? 's' : ''} desde tu última consulta. Reserva tu cita para revisar tu avance y ajustar tu plan.`;
    await m.ref.collection('notifications').add({ title, body, type: 'booking', read: false, createdAt: FieldValue.serverTimestamp() });
    await m.ref.update({ [flag]: data.nextReview });
    sent++;
  }
  console.log(`Recordatorios enviados: ${sent}`);
});

// ---------- IA: genera planes con Claude desde el servidor (la llave nunca llega al navegador) ----------
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');

exports.generatePlan = onCall({ timeoutSeconds: 540, memory: '1GiB', maxInstances: 3 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión como administradora.');
  const isAdmin = (await db.doc(`admins/${req.auth.uid}`).get()).exists;
  if (!isAdmin) throw new HttpsError('permission-denied', 'Solo la administradora puede usar la IA.');
  const secret = (await db.doc('secrets/anthropic').get()).data()?.key;
  const legacy = (await db.doc('settings/admin').get()).data()?.anthropicKey;
  const apiKey = String(secret || legacy || '').trim();
  if (!apiKey) throw new HttpsError('failed-precondition', 'Configura tu llave de API de Claude en Ajustes para usar la IA.');

  // Solo se aceptan los campos que usa la app
  const p = req.data?.params || {};
  if (typeof p.model !== 'string' || !/^claude-[a-z0-9.-]+$/.test(p.model)) throw new HttpsError('invalid-argument', 'Modelo no válido.');
  if (!Array.isArray(p.messages) || !p.messages.length) throw new HttpsError('invalid-argument', 'Solicitud vacía.');
  const params = {
    model: p.model,
    max_tokens: Math.min(Number(p.max_tokens) || 16000, 64000),
    system: typeof p.system === 'string' ? p.system.slice(0, 60000) : undefined,
    messages: p.messages,
    ...(p.output_config ? { output_config: p.output_config } : {}),
  };
  const client = new Anthropic({ apiKey });
  let msg;
  try {
    try {
      msg = await client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }).finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) msg = await client.messages.stream(params).finalMessage();
      else throw e;
    }
  } catch (e) {
    console.error('Claude', e.status, e.message);
    if (e instanceof Anthropic.AuthenticationError) throw new HttpsError('unauthenticated', 'La llave de API no es válida. Revísala en Ajustes.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new HttpsError('permission-denied', 'La llave de API no tiene permiso para este modelo. Revisa el modelo en Ajustes.');
    if (e instanceof Anthropic.RateLimitError) throw new HttpsError('resource-exhausted', 'Se alcanzó el límite de uso de la API. Intenta en unos minutos.');
    if (e instanceof Anthropic.BadRequestError) throw new HttpsError('invalid-argument', 'La solicitud a la IA no fue válida: ' + e.message);
    if (e instanceof Anthropic.APIConnectionError) throw new HttpsError('unavailable', 'No hay conexión con el servicio de IA. Intenta de nuevo.');
    throw new HttpsError('internal', 'La IA no respondió: ' + (e.message || 'error desconocido'));
  }
  return {
    stop_reason: msg.stop_reason,
    text: msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''),
  };
});

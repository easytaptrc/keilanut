// Configuración editable desde Ajustes: textos del sitio, servicios, formulario de reservación,
// historial clínico, medidas, panel del paciente e IA. Aquí viven los valores por defecto y cómo se combinan
// con lo que la nutrióloga guarda en Firestore (settings/public y settings/admin).
import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { BODY_FIELDS, CLINICAL_SECTIONS } from '../data/clinical';

const clone = (x) => JSON.parse(JSON.stringify(x));
export const uid = (p = 'c') => `${p}_${Math.random().toString(36).slice(2, 8)}`;

/* ---------------- Servicios ---------------- */
export const DEFAULT_SERVICES = {
  online: {
    enabled: true, icon: 'video', label: 'Consulta online', short: 'Online',
    desc: 'Videollamada desde cualquier lugar. Plan y seguimiento en tu app.',
    bullets: ['Videollamada con evaluación de hábitos e historial', 'Plan de alimentación y rutina en tu app', 'Seguimiento de progreso y notificaciones'],
  },
  presencial: {
    enabled: true, icon: 'pin', label: 'Consulta presencial', short: 'Presencial',
    desc: 'Cita en consultorio con evaluación y mediciones corporales.',
    bullets: ['Mediciones antropométricas y composición corporal', 'Plan de alimentación y rutina en tu app', 'Seguimiento cercano en cada cita'],
  },
};
/** Servicios guardados + por defecto (conserva el orden guardado) */
export function mergeServices(stored) {
  if (!stored || typeof stored !== 'object' || !Object.keys(stored).length) return clone(DEFAULT_SERVICES);
  const out = {};
  for (const [k, v] of Object.entries(stored)) out[k] = { ...(DEFAULT_SERVICES[k] || { icon: 'leaf', bullets: [] }), ...v };
  return out;
}
export const activeServices = (services) => Object.fromEntries(Object.entries(services).filter(([, s]) => s.enabled !== false));

/* ---------------- Textos e imágenes del sitio ---------------- */
export const DEFAULT_SITE = {
  heroEyebrow: 'Lic. en Nutrición · Keila Guerrero',
  heroTitle: 'Nutrición que se *adapta* a tu vida',
  heroLead: 'Planes de alimentación y entrenamiento personalizados, diseñados según tu historia clínica, tu cuerpo y tu objetivo. Sin dietas extremas, con resultados reales.',
  ctaPrimary: 'Reservar mi cita',
  ctaSecondary: 'Soy parte del Team',
  servicesEyebrow: 'Servicios',
  servicesTitle: 'Elige cómo quieres empezar',
  servicesLead: 'Ambas modalidades incluyen evaluación completa, plan personalizado y acceso a la app Team.',
  aboutEnabled: false,
  aboutEyebrow: 'Sobre mí',
  aboutTitle: 'Conoce a Keila',
  aboutText: 'Soy Licenciada en Nutrición. Te acompaño con un plan realista, hecho a tu medida y con seguimiento cercano.',
  processEyebrow: 'Proceso',
  processTitle: 'Así trabajamos juntas',
  steps: [
    { title: 'Reserva', text: 'Llena tu registro con tu historial clínico, hábitos y objetivo.' },
    { title: 'Evaluación', text: 'Keila revisa tu caso y confirma tu cita online o presencial.' },
    { title: 'Tu plan', text: 'Recibes tu dieta y rutina personalizadas dentro de tu app Team.' },
    { title: 'Seguimiento', text: 'Registra tu progreso y recibe avisos y ajustes a tu plan.' },
  ],
  teamEyebrow: 'App Team',
  teamTitle: 'Tu plan completo, en tu bolsillo',
  teamLead: 'Al formar parte del Team recibes tu ID de acceso. Instala la app en tu teléfono y lleva todo contigo:',
  teamItems: [
    'Tu dieta con porciones, horarios y recomendaciones',
    'Tu rutina con animaciones de cada ejercicio',
    'Tu progreso: peso y medidas en gráficas',
    'Notificaciones directas de Keila',
    'Agenda tu siguiente cita en un toque',
  ],
  quote: 'No se trata de comer menos, se trata de comer mejor y sostenerlo en el tiempo.',
  quoteAuthor: 'Keila Guerrero',
  quoteCta: 'Agenda tu primera cita',
  footerText: 'Nutrición clínica y deportiva con un enfoque humano, realista y basado en evidencia.',
  bookingEyebrow: 'Reservación',
  bookingTitle: 'Agenda tu consulta',
  bookingLead: 'Llena tu registro con calma: con esta información Keila preparará tu plan a tu medida. Tus datos son confidenciales.',
  bookingDoneTitle: '¡Reservación enviada!',
  bookingDoneText: 'Keila revisará tu información y te confirmará. Al aceptarte recibirás tu ID de Team para entrar a tu app.',
};
export const mergeSite = (s) => ({ ...clone(DEFAULT_SITE), ...(s || {}) });

/* ---------------- Formulario de reservación ---------------- */
// Tipos: text, textarea, number, date, tel, email, choice (una opción), multi (varias), yesno, yesno-detail, consent
export const BOOKING_FIELD_TYPES = {
  text: 'Texto corto', textarea: 'Texto largo', number: 'Número', date: 'Fecha', choice: 'Una opción', multi: 'Varias opciones',
  yesno: 'Sí / No', 'yesno-detail': 'Sí / No + ¿cuál?', consent: 'Casilla de aceptación', tel: 'Teléfono', email: 'Correo',
};
const F = (key, label, type, extra = {}) => ({ key, label, type, enabled: true, required: false, builtin: true, ...extra });
export const DEFAULT_BOOKING_FORM = {
  scheduleTitle: 'Servicio y horario',
  sections: [
    { key: 'datos', title: 'Datos personales', enabled: true, builtin: true, fields: [
      F('firstName', 'Nombre(s)', 'text', { required: true, locked: true }),
      F('lastName', 'Apellidos', 'text', { required: true, locked: true }),
      F('birthDate', 'Fecha de nacimiento', 'date', { required: true }),
      F('phone', 'Teléfono y WhatsApp', 'tel', { required: true, locked: true }),
      F('email', 'Correo electrónico', 'email', { required: true, locked: true, hint: 'Si es Gmail, podrás entrar a tu app con Google.' }),
    ] },
    { key: 'motivo', title: 'Motivo de consulta', enabled: true, builtin: true, fields: [
      F('reason', '¿Cuál es el motivo de tu consulta?', 'textarea', { placeholder: 'Cuéntanos brevemente qué te gustaría lograr o mejorar.' }),
      F('goal', 'Objetivo principal', 'choice', { required: true, options: [
        { value: 'perder_grasa', label: 'Bajar grasa' }, { value: 'ganar_musculo', label: 'Ganar músculo' }, { value: 'salud', label: 'Mejorar salud' },
        { value: 'rendimiento', label: 'Rendimiento deportivo' }, { value: 'otro', label: 'Otro' },
      ] }),
      F('prevNutritionist', '¿Has acudido antes con un nutriólogo?', 'yesno'),
    ] },
    { key: 'medidas', title: 'Medidas', enabled: true, builtin: true, fields: [
      F('heightCm', 'Estatura (cm)', 'number', { required: true, placeholder: '165' }),
      F('weightKg', 'Peso actual (kg)', 'number', { required: true, placeholder: '68' }),
    ] },
    { key: 'salud', title: 'Información básica de salud', enabled: true, builtin: true, fields: [
      F('hasDisease', '¿Tienes alguna enfermedad o diagnóstico médico?', 'yesno-detail', { detailKey: 'diseases', placeholder: '¿Cuál?' }),
      F('takesMeds', '¿Tomas medicamentos actualmente?', 'yesno-detail', { detailKey: 'medications', placeholder: '¿Cuáles?' }),
      F('hasAllergy', '¿Tienes alguna alergia o intolerancia alimentaria?', 'yesno-detail', { detailKey: 'allergies', placeholder: '¿Cuál?' }),
      F('hasInjury', '¿Tienes alguna lesión o condición que debamos conocer antes de la consulta?', 'yesno-detail', { detailKey: 'injuries', placeholder: '¿Cuál?' }),
    ] },
    { key: 'confirmacion', title: 'Confirmación', enabled: true, builtin: true, fields: [
      F('consentPrivacy', 'Acepto el aviso de privacidad y el tratamiento de mis datos personales y de salud, que se usarán únicamente para mi atención nutricional de forma confidencial.', 'consent', { required: true }),
      F('consentTerms', 'Confirmo mi reservación y acepto las condiciones del servicio.', 'consent', { required: true }),
    ] },
  ],
};
/** Campos internos que siempre deben existir (se necesitan para crear la cuenta del paciente) */
const LOCKED = DEFAULT_BOOKING_FORM.sections.flatMap((s) => s.fields.filter((f) => f.locked).map((f) => [s.key, f]));
export function mergeBookingForm(stored) {
  if (!stored?.sections?.length) return clone(DEFAULT_BOOKING_FORM);
  const out = { ...clone(DEFAULT_BOOKING_FORM), ...clone(stored) };
  const has = new Set(out.sections.flatMap((s) => s.fields.map((f) => f.key)));
  for (const [sec, f] of LOCKED) {
    if (has.has(f.key)) continue;
    let s = out.sections.find((x) => x.key === sec) || out.sections[0];
    s.fields.unshift(clone(f));
  }
  // Los campos bloqueados nunca se desactivan
  for (const s of out.sections) for (const f of s.fields) if (LOCKED.some(([, l]) => l.key === f.key)) { f.enabled = true; f.required = true; f.locked = true; s.enabled = true; }
  return out;
}
/** Campos activos del formulario */
export const activeBookingFields = (form) => form.sections.filter((s) => s.enabled !== false).flatMap((s) => s.fields.filter((f) => f.enabled !== false));
/** Opciones como lista {value,label} (acepta lista de textos) */
export const optionList = (opts) => (opts || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)).filter((o) => o && String(o.label ?? o.value).trim());

/* ---------------- Historial clínico y medidas ---------------- */
export const CLINICAL_FIELD_TYPES = { multi: 'Varias opciones', single: 'Una opción', text: 'Texto corto', area: 'Texto largo', date: 'Fecha', number: 'Número' };
export function mergeClinicalForm(stored) {
  const sections = stored?.sections?.length ? clone(stored.sections) : clone(CLINICAL_SECTIONS).map((s) => ({ ...s, enabled: true, builtin: true, fields: s.fields.map((f) => ({ ...f, enabled: true, builtin: true })) }));
  const bodyFields = stored?.bodyFields?.length ? clone(stored.bodyFields) : BODY_FIELDS.map((f) => ({ ...f, enabled: true, builtin: true }));
  return { sections, bodyFields };
}
export const activeClinicalSections = (form) => form.sections.filter((s) => s.enabled !== false).map((s) => ({ ...s, fields: s.fields.filter((f) => f.enabled !== false) }));
export const activeBodyFields = (form) => form.bodyFields.filter((f) => f.enabled !== false);

/* ---------------- Panel del paciente (Team) ---------------- */
export const TEAM_MODULES = { dieta: 'Dieta', comidas: 'Registro de comidas', rutina: 'Rutina', progreso: 'Progreso', fotos: 'Fotos de progreso', reservar: 'Reservar citas' };
export const DEFAULT_TEAM = {
  modules: { dieta: true, comidas: true, rutina: true, progreso: true, fotos: true, reservar: true },
  reviewWeeks: 3, reminderDaysBefore: 3, reminders: true,
  welcomeText: '',
};
export const mergeTeam = (t) => ({ ...clone(DEFAULT_TEAM), ...(t || {}), modules: { ...DEFAULT_TEAM.modules, ...(t?.modules || {}) } });

/* ---------------- IA ---------------- */
export const DEFAULT_AI = { days: 5, maxOptions: 2, maxSectionsPerMeal: 4, extraInstructions: '' };
export const mergeAI = (a) => ({ ...DEFAULT_AI, ...(a || {}) });

/* ---------------- Lectura compartida de settings/public ---------------- */
let pubCache = null;
let pubListeners = new Set();
let pubUnsub = null;
function startPublic() {
  if (pubUnsub) return;
  pubUnsub = onSnapshot(doc(db, 'settings', 'public'), (d) => {
    pubCache = d.data() || {};
    pubListeners.forEach((fn) => fn(pubCache));
  }, () => { pubCache = pubCache || {}; pubListeners.forEach((fn) => fn(pubCache)); });
}
/** Ajustes públicos ya combinados con los valores por defecto (una sola suscripción para toda la app) */
export function usePublicSettings() {
  const [raw, setRaw] = useState(pubCache);
  useEffect(() => {
    startPublic();
    pubListeners.add(setRaw);
    if (pubCache) setRaw(pubCache);
    return () => { pubListeners.delete(setRaw); };
  }, []);
  if (!raw) return null;
  return {
    raw,
    whatsapp: raw.whatsapp || '', instagram: raw.instagram || '', address: raw.address || '', email: raw.email || '',
    schedule: raw.schedule, services: mergeServices(raw.services), site: mergeSite(raw.site),
    bookingForm: mergeBookingForm(raw.bookingForm), team: mergeTeam(raw.team),
  };
}
/** Servicios (con valores por defecto mientras carga) */
export function useServices() {
  const p = usePublicSettings();
  return p?.services || DEFAULT_SERVICES;
}

/* ---------------- Imágenes del sitio (colección pública siteImages) ---------------- */
const imgCache = {};
export function useSiteImage(key) {
  const [src, setSrc] = useState(key ? imgCache[key] : null);
  useEffect(() => {
    if (!key) return;
    if (imgCache[key] !== undefined) { setSrc(imgCache[key]); return; }
    let on = true;
    getDoc(doc(db, 'siteImages', key)).then((d) => { imgCache[key] = d.data()?.data || null; if (on) setSrc(imgCache[key]); }).catch(() => { imgCache[key] = null; });
    return () => { on = false; };
  }, [key]);
  return src;
}
export const forgetSiteImage = (key) => { delete imgCache[key]; };

/** Nombre del servicio de una cita (aunque el servicio ya se haya borrado de Ajustes) */
export const serviceName = (services, b, short = false) => {
  const s = services?.[b?.service];
  return (s && (short ? s.short || s.label : s.label)) || b?.serviceLabel || b?.service || '';
};

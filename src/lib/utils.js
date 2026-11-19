export const SERVICES = {
  online: { label: 'Consulta online', short: 'Online', desc: 'Videollamada desde cualquier lugar. Plan y seguimiento en tu app.' },
  presencial: { label: 'Consulta presencial', short: 'Presencial', desc: 'Cita en consultorio con evaluación y mediciones corporales.' },
};

export const BOOKING_STATUS = {
  pendiente: { label: 'Pendiente', tone: 'warn' },
  aceptada: { label: 'Aceptada', tone: 'ok' },
  completada: { label: 'Completada', tone: 'info' },
  rechazada: { label: 'Rechazada', tone: 'danger' },
};

export const ACTIVITY = {
  sedentaria: { label: 'Sedentaria (trabajo de oficina, sin ejercicio)', factor: 1.2 },
  ligera: { label: 'Ligera (ejercicio 1–3 días/semana)', factor: 1.375 },
  moderada: { label: 'Moderada (ejercicio 3–5 días/semana)', factor: 1.55 },
  alta: { label: 'Alta (ejercicio 6–7 días/semana)', factor: 1.725 },
  muy_alta: { label: 'Muy alta (atleta / trabajo físico pesado)', factor: 1.9 },
};

export const GOALS = {
  perder_grasa: 'Perder grasa / bajar de peso',
  ganar_musculo: 'Ganar masa muscular',
  recomposicion: 'Recomposición corporal (tonificar)',
  mantener: 'Mantener peso y comer saludable',
  rendimiento: 'Rendimiento deportivo',
  salud: 'Control de enfermedad / salud clínica',
  embarazo: 'Embarazo o lactancia',
};

export function ageFrom(birth) {
  if (!birth) return null;
  const b = new Date(birth + 'T00:00:00');
  if (isNaN(b)) return null;
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

export function bmi(weightKg, heightCm) {
  const w = Number(weightKg), h = Number(heightCm) / 100;
  if (!w || !h) return null;
  return Math.round((w / (h * h)) * 10) / 10;
}

export function bmiLabel(v) {
  if (v == null) return '';
  if (v < 18.5) return 'Bajo peso';
  if (v < 25) return 'Normal';
  if (v < 30) return 'Sobrepeso';
  if (v < 35) return 'Obesidad I';
  if (v < 40) return 'Obesidad II';
  return 'Obesidad III';
}

export const toDate = (ts) => (ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : ts ? new Date(ts) : null);

export function fmtDate(v, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : toDate(v);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleDateString('es-MX', opts);
}

export function fmtDateTime(v) {
  const d = toDate(v);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const money = (n) =>
  Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function genPassword(len = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => chars[x % chars.length]).join('');
}

export function cx(...a) {
  return a.filter(Boolean).join(' ');
}

export function fullName(p) {
  return [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Sin nombre';
}

export function initials(p) {
  return ((p?.firstName || '?')[0] + (p?.lastName || '')[0] || '').toUpperCase();
}

// Redimensiona una imagen a dataURL JPEG (para fotos de perfil sin necesidad de Storage)
export function resizeImage(file, max = 360, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      // recorte cuadrado centrado
      const c = document.createElement('canvas');
      const out = Math.round(Math.min(max, side));
      c.width = out; c.height = out;
      const ctx = c.getContext('2d');
      const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export const waLink = (phone, text) => {
  const p = String(phone || '').replace(/\D/g, '');
  const num = p.length === 10 ? '52' + p : p;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
};

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const DEFAULT_MODEL = 'claude-opus-5-5';

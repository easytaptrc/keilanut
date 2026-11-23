// Operaciones de la administradora: alta de miembros, accesos, notificaciones.
import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, inMemoryPersistence, setPersistence, signOut } from 'firebase/auth';
import { addDoc, collection, deleteField, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, firebaseConfig, memberEmailFromId, MEMBER_DOMAIN, USE_EMULATORS } from '../firebase';
import { genPassword, todayISO } from './utils';
import { normalizeBooking } from '../components/BookingForm';

// App secundaria para crear cuentas sin cerrar la sesión de la administradora
async function secondaryAuth() {
  const app = getApps().find((a) => a.name === 'secondary') || initializeApp({ ...firebaseConfig, authDomain: 'egogym-39e45.firebaseapp.com' }, 'secondary');
  const a = getAuth(app);
  if (USE_EMULATORS && !a.emulatorConfig) connectAuthEmulator(a, 'http://127.0.0.1:9399', { disableWarnings: true });
  await setPersistence(a, inMemoryPersistence);
  return a;
}

async function createLogin(email, password) {
  const a = await secondaryAuth();
  const cred = await createUserWithEmailAndPassword(a, email, password);
  const uid = cred.user.uid;
  await signOut(a);
  return uid;
}

export async function nextMemberId() {
  const ref = doc(db, 'counters', 'members');
  const n = await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const next = (s.exists() ? s.data().next : 1) || 1;
    tx.set(ref, { next: next + 1 }, { merge: true });
    return next;
  });
  return `KG-${String(n).padStart(4, '0')}`;
}

export async function notifyMember(memberId, { title, body, type = 'mensaje' }) {
  return addDoc(collection(db, 'members', memberId, 'notifications'), { title, body, type, read: false, createdAt: serverTimestamp() });
}

/** Acepta una reservación de alguien nuevo: crea ID, contraseña, cuenta y expediente. */
export async function createMemberFromBooking(booking, priceDefault) {
  const id = await nextMemberId();
  const password = genPassword(8);
  const loginEmail = memberEmailFromId(id);
  const uid = await createLogin(loginEmail, password);
  const profile = normalizeBooking(booking);
  const b = writeBatch(db);
  b.set(doc(db, 'members', id), {
    ...profile,
    authUid: uid,
    email: (booking.email || '').toLowerCase(),
    active: true,
    photo: null,
    fcmTokens: [],
    firstBookingId: booking.id,
    lastVisit: booking.date || todayISO(),
    nextReview: addDays(booking.date || todayISO(), 21),
    createdAt: serverTimestamp(),
  });
  b.set(doc(db, 'logins', id), { email: loginEmail });
  b.update(doc(db, 'bookings', booking.id), {
    status: 'aceptada', memberId: id, acceptedAt: serverTimestamp(),
  });
  b.set(doc(db, 'bookingAdmin', booking.id), { price: booking.price ?? priceDefault ?? null, paid: !!booking.paid, adminNotes: booking.adminNotes || '', updatedAt: serverTimestamp() }, { merge: true });
  // Peso inicial como primer registro de progreso
  if (booking.weightKg) {
    b.set(doc(collection(db, 'members', id, 'progress')), {
      date: todayISO(), weightKg: Number(booking.weightKg) || null,
      heightCm: Number(booking.heightCm) || null, notes: 'Registro inicial (reservación)', by: 'admin', createdAt: serverTimestamp(),
    });
  }
  b.set(doc(collection(db, 'members', id, 'notifications')), {
    title: '¡Bienvenida/o al Team!', body: `Tu cita del ${booking.date} a las ${booking.time} fue confirmada. Aquí verás tu dieta, rutina y progreso.`,
    type: 'booking', read: false, createdAt: serverTimestamp(),
  });
  await b.commit();
  return { id, password };
}

/** Genera una nueva contraseña (crea un nuevo acceso y lo enlaza al mismo ID). */
export async function resetMemberAccess(memberId) {
  const password = genPassword(8);
  const login = await getDoc(doc(db, 'logins', memberId));
  const n = (login.data()?.rev || 1) + 1;
  const email = `${memberId.toLowerCase()}.r${n}@${MEMBER_DOMAIN}`;
  const uid = await createLogin(email, password);
  const b = writeBatch(db);
  b.set(doc(db, 'logins', memberId), { email, rev: n });
  b.update(doc(db, 'members', memberId), { authUid: uid });
  await b.commit();
  return { id: memberId, password };
}

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Precio, pago y notas privadas viven en bookingAdmin/{id}: solo la administradora puede leerlos. */
export async function saveBookingAdmin(booking, patch) {
  await setDoc(doc(db, 'bookingAdmin', booking.id), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  // Limpia datos privados antiguos que estaban dentro de la reservación (visible para el paciente)
  if (booking._legacyPrivate) {
    await updateDoc(doc(db, 'bookings', booking.id), { price: deleteField(), paid: deleteField(), adminNotes: deleteField() }).catch(() => {});
  }
}

/** Une las reservaciones con sus datos privados */
export function mergeBookingAdmin(bookings, adminList) {
  const map = Object.fromEntries(adminList.map((a) => [a.id, a]));
  return bookings.map((b) => {
    const a = map[b.id] || {};
    const legacy = b.price != null || b.paid != null || b.adminNotes != null;
    return { ...b, price: a.price ?? b.price ?? null, paid: a.paid ?? b.paid ?? false, adminNotes: a.adminNotes ?? b.adminNotes ?? '', _legacyPrivate: legacy };
  });
}

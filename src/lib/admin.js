// Operaciones de la administradora: alta de miembros, accesos, notificaciones.
import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, inMemoryPersistence, setPersistence, signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
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
  const profile = normalizeBooking({ ...booking, diseasesList: [], diseasesOther: booking.diseases || '' });
  const b = writeBatch(db);
  b.set(doc(db, 'members', id), {
    ...profile,
    authUid: uid,
    email: (booking.email || '').toLowerCase(),
    active: true,
    photo: null,
    fcmTokens: [],
    firstBookingId: booking.id,
    createdAt: serverTimestamp(),
  });
  b.set(doc(db, 'logins', id), { email: loginEmail });
  b.update(doc(db, 'bookings', booking.id), {
    status: 'aceptada', memberId: id, acceptedAt: serverTimestamp(),
    price: booking.price ?? priceDefault ?? null,
  });
  // Peso inicial como primer registro de progreso
  if (booking.weightKg) {
    b.set(doc(collection(db, 'members', id, 'progress')), {
      date: todayISO(), weightKg: Number(booking.weightKg) || null,
      waistCm: Number(booking.waistCm) || null, hipCm: Number(booking.hipCm) || null, bodyFat: null, notes: 'Registro inicial', by: 'admin', createdAt: serverTimestamp(),
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

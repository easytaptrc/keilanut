import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const host = typeof location !== 'undefined' ? location.hostname : '';
// En producción usamos el mismo dominio como authDomain para que el login con Google
// funcione con redirect dentro de la app instalada (iOS/Android) sin cookies de terceros.
const sameDomainAuth = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');

export const firebaseConfig = {
  apiKey: 'AIzaSyDV3SVxoFv0Lk6OwnE7-c3Upp55pcKxIqg',
  authDomain: sameDomainAuth ? host : 'egogym-39e45.firebaseapp.com',
  projectId: 'egogym-39e45',
  storageBucket: 'egogym-39e45.firebasestorage.app',
  messagingSenderId: '784474467563',
  appId: '1:784474467563:web:63a4ac5d8d6c5995d622ae',
  measurementId: 'G-6BTWWRLQ31',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
// Pruebas locales: VITE_EMULATORS=1 npm run dev (usa los emuladores de Firebase, no la base real)
export const USE_EMULATORS = import.meta.env.VITE_EMULATORS === '1';
if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9399', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8381);
}
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Dominio sintético para las cuentas de Team (ID + contraseña)
export const MEMBER_DOMAIN = 'team.keilaguerrero.app';
export const memberEmailFromId = (id) => `${String(id).trim().toLowerCase()}@${MEMBER_DOMAIN}`;

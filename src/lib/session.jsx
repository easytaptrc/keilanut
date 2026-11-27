import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const [state, setState] = useState({ user: undefined, isAdmin: false, staff: null, member: null, ready: false });

  useEffect(() => {
    let unsubMember = null;
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsubMember?.();
      unsubMember = null;
      if (!user) {
        setState({ user: null, isAdmin: false, staff: null, member: null, ready: true });
        return;
      }
      let isAdmin = false;
      try {
        isAdmin = (await getDoc(doc(db, 'admins', user.uid))).exists();
      } catch { /* sin permiso => no es admin */ }

      // Recepción (cuenta creada por la administradora)
      let staff = null;
      if (!isAdmin) {
        try {
          const s = await getDoc(doc(db, 'staff', user.uid));
          if (s.exists()) staff = { uid: user.uid, ...s.data() };
        } catch { /* sin permiso */ }
      }
      if (staff) { setState({ user, isAdmin: false, staff, member: null, ready: true }); return; }

      let memberId = null;
      if (!isAdmin) {
        try {
          let snap = await getDocs(query(collection(db, 'members'), where('authUid', '==', user.uid), limit(1)));
          if (snap.empty && user.email && user.emailVerified) {
            snap = await getDocs(query(collection(db, 'members'), where('email', '==', user.email.toLowerCase()), limit(1)));
          }
          if (!snap.empty) memberId = snap.docs[0].id;
        } catch (e) {
          console.warn('No se pudo buscar el miembro', e);
        }
      }

      if (memberId) {
        unsubMember = onSnapshot(doc(db, 'members', memberId), (d) => {
          setState({ user, isAdmin, staff: null, member: d.exists() ? { id: d.id, ...d.data() } : null, ready: true });
        });
      } else {
        setState({ user, isAdmin, staff: null, member: null, ready: true });
      }
    });
    return () => { unsub(); unsubMember?.(); };
  }, []);

  return <Ctx.Provider value={{ ...state, logout: () => signOut(auth) }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

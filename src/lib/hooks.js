import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export function useDoc(path) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  useEffect(() => {
    if (!path) return;
    return onSnapshot(doc(db, path), (d) => setState({ data: d.exists() ? { id: d.id, ...d.data() } : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }));
  }, [path]);
  return state;
}

/** Escucha una colección. `build` devuelve las restricciones; `key` identifica la consulta. */
export function useCol(path, build, key = '') {
  const [state, setState] = useState({ list: [], loading: true, error: null });
  useEffect(() => {
    if (!path) return;
    return onSnapshot(query(collection(db, path), ...(build ? build() : [])),
      (s) => setState({ list: s.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => { console.warn(path, error); setState({ list: [], loading: false, error }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);
  return state;
}

export const usePlan = (memberId, kind) => useDoc(memberId ? `members/${memberId}/plans/${kind}` : null);
export const useProgress = (memberId) => useCol(memberId ? `members/${memberId}/progress` : null, () => [orderBy('date', 'desc')], 'progress');
export const useMemberBookings = (memberId) => useCol(memberId ? 'bookings' : null, () => [where('memberId', '==', memberId)], 'mb' + memberId);

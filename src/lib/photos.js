// Fotos de progreso: miniatura + imagen completa en documentos separados (Firestore, comprimidas en el navegador).
import { collection, deleteDoc, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

export const POSES = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda', otra: 'Otra' };
const MAX_DOC = 900_000; // margen bajo el límite de 1 MiB por documento

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen. Usa JPG o PNG.')); };
    img.src = url;
  });
}

function toJpeg(img, maxSide, quality) {
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

export async function compressPhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona una imagen.');
  if (file.size > 25 * 1024 * 1024) throw new Error('La imagen es demasiado pesada (máx. 25 MB).');
  const img = await loadImage(file);
  let full = toJpeg(img, 1400, 0.8);
  for (const [side, q] of [[1200, 0.72], [1000, 0.65], [800, 0.6]]) {
    if (full.length <= MAX_DOC) break;
    full = toJpeg(img, side, q);
  }
  return { full, thumb: toJpeg(img, 360, 0.7) };
}

/** Sube una foto de progreso. by: 'admin' | 'member' */
export async function addProgressPhoto(memberId, file, { pose = 'frente', date, by, note = '' }) {
  const { full, thumb } = await compressPhoto(file);
  const ref = doc(collection(db, 'members', memberId, 'photos'));
  const b = writeBatch(db);
  b.set(ref, { pose, date, by, note: String(note).slice(0, 300), thumb, createdAt: serverTimestamp() });
  b.set(doc(db, 'members', memberId, 'photoFull', ref.id), { data: full, by });
  await b.commit();
  return ref.id;
}

export async function getFullPhoto(memberId, photoId) {
  const d = await getDoc(doc(db, 'members', memberId, 'photoFull', photoId));
  return d.exists() ? d.data().data : null;
}

export async function deleteProgressPhoto(memberId, photoId) {
  await deleteDoc(doc(db, 'members', memberId, 'photoFull', photoId)).catch(() => {});
  await deleteDoc(doc(db, 'members', memberId, 'photos', photoId));
}

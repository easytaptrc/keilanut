// Almacenamiento de PDFs en Firestore por fragmentos (no requiere Firebase Storage / plan Blaze).
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const CHUNK = 700_000; // caracteres base64 por documento (< 1 MiB)
export const MAX_PDF_BYTES = 6 * 1024 * 1024;

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Sube un archivo. meta: { kind: 'template'|'plan', ownerMemberId?: string } */
export async function uploadFile(file, meta = {}) {
  if (file.size > MAX_PDF_BYTES) throw new Error('El archivo supera 6 MB. Comprime el PDF e inténtalo de nuevo.');
  const b64 = await fileToBase64(file);
  const parts = [];
  for (let i = 0; i < b64.length; i += CHUNK) parts.push(b64.slice(i, i + CHUNK));
  const ref = await addDoc(collection(db, 'files'), {
    name: file.name,
    mime: file.type || 'application/pdf',
    size: file.size,
    chunks: parts.length,
    kind: meta.kind || 'plan',
    ownerMemberId: meta.ownerMemberId || null,
    createdAt: serverTimestamp(),
  });
  // Lotes pequeños para no exceder el tamaño máximo de una escritura
  for (let i = 0; i < parts.length; i++) {
    const b = writeBatch(db);
    b.set(doc(db, 'files', ref.id, 'chunks', String(i).padStart(3, '0')), { i, data: parts[i] });
    await b.commit();
  }
  return { id: ref.id, name: file.name, size: file.size };
}

export async function readFileBase64(fileId) {
  const meta = await getDoc(doc(db, 'files', fileId));
  if (!meta.exists()) throw new Error('Archivo no encontrado');
  const snap = await getDocs(query(collection(db, 'files', fileId, 'chunks'), orderBy('i')));
  return { meta: meta.data(), base64: snap.docs.map((d) => d.data().data).join('') };
}

export async function openFile(fileId, download = false) {
  // Abrimos la ventana antes del await para que no la bloquee el navegador (iOS)
  const win = download ? null : window.open('', '_blank');
  try {
    const { meta, base64 } = await readFileBase64(fileId);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: meta.mime || 'application/pdf' }));
    if (win) win.location.href = url;
    else {
      const a = document.createElement('a');
      a.href = url; a.download = meta.name || 'archivo.pdf';
      document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    win?.close();
    throw e;
  }
}

export async function deleteFile(fileId) {
  const snap = await getDocs(collection(db, 'files', fileId, 'chunks'));
  for (const d of snap.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db, 'files', fileId));
}

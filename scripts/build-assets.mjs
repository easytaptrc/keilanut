// Genera íconos PWA a partir del logo y descarga las imágenes de ejercicios.
// Uso: npm run assets
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { EXERCISES } from '../src/data/exercises.js';

import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'static');
fs.mkdirSync(path.join(pub, 'icons'), { recursive: true });

const LOGO = path.join(root, 'IMG_0646.PNG');
const CREAM = { r: 255, g: 251, b: 239, alpha: 1 };

async function logos() {
  // Logo con fondo transparente (blanco -> alfa)
  const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.min(data[i], data[i + 1], data[i + 2]);
    if (m > 235) data[i + 3] = 0;
    else if (m > 200) data[i + 3] = Math.round(((235 - m) / 35) * 255);
  }
  const transparent = await sharp(data, { raw: info }).png().toBuffer();
  const trimmed = await sharp(transparent).trim().png().toBuffer();
  await sharp(trimmed).resize({ width: 640 }).png().toFile(path.join(pub, 'logo.png'));

  // Solo monograma (parte superior: GK + hojas) para íconos
  const meta = await sharp(trimmed).metadata();
  const mono = await sharp(trimmed).extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.78) }).trim().png().toBuffer();
  await sharp(mono).resize({ width: 400 }).png().toFile(path.join(pub, 'monogram.png'));

  const icon = async (size, pad, file) => {
    const inner = Math.round(size * (1 - pad * 2));
    const m = await sharp(mono).resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
      .composite([{ input: m, gravity: 'center' }]).png().toFile(path.join(pub, 'icons', file));
  };
  await icon(192, 0.14, 'icon-192.png');
  await icon(512, 0.14, 'icon-512.png');
  await icon(512, 0.24, 'maskable-512.png');
  await icon(180, 0.14, 'apple-touch-icon.png');
  await icon(64, 0.08, 'favicon.png');
  console.log('Íconos y logo listos');
}

async function exercises() {
  const base = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
  let ok = 0;
  for (const ex of EXERCISES) {
    const dir = path.join(pub, 'exercises', ex.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of [0, 1]) {
      const out = path.join(dir, `${f}.jpg`);
      if (fs.existsSync(out)) continue;
      const res = await fetch(`${base}/${encodeURIComponent(ex.id)}/${f}.jpg`);
      if (!res.ok) { console.warn('Falta', ex.id, f, res.status); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toFile(out);
    }
    ok++;
  }
  console.log(`Ejercicios: ${ok}/${EXERCISES.length}`);
}

await logos();
await exercises();

// Genera los PDF de dieta y rutina con el diseño de los planes de Keila (fondos, tipografías e imágenes originales).
import { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, moveTo, lineTo, appendBezierCurve, closePath, clip, endPath } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { PLAN_BASE, STATIC_PAGES, SUPP_MAP, foodPhoto, isSnack, slotLabel, suppImg, tipImg } from '../data/planAssets';
import { EXERCISE_MAP } from '../data/exercises';
import { normalizeDiet, normalizeRoutine } from './plans';
import { ageFrom, bmi, fmtDate, fullName } from './utils';
import { getFullPhoto, POSES } from './photos';

const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
const C = { ink: hex('#1f1f1f'), green: hex('#90b680'), lime: hex('#8dad39'), orange: hex('#df5934'), rust: hex('#a1411c'), pill: hex('#c8a67e'), snack: hex('#8fae7d'), white: rgb(1, 1, 1), dark: hex('#2f2e2c'), muted: hex('#555555') };
const KAPPA = 0.5523;

const cache = new Map();
async function bytes(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error('No se pudo cargar ' + url); return r.arrayBuffer(); }));
  return cache.get(url);
}
const dataUrlBytes = (d) => Uint8Array.from(atob(d.split(',')[1]), (c) => c.charCodeAt(0));

class Doc {
  static async create(width, height) {
    const d = new Doc();
    d.pdf = await PDFDocument.create();
    d.pdf.registerFontkit(fontkit);
    d.W = width; d.H = height;
    const f = async (n) => d.pdf.embedFont(await bytes(`${PLAN_BASE}/fonts/${n}.ttf`), { subset: true });
    [d.londrina, d.reg, d.light, d.bold, d.semi, d.italic, d.boldItalic] = await Promise.all(
      ['LondrinaSolid-Black', 'Poppins-Regular', 'Poppins-Light', 'Poppins-Bold', 'Poppins-SemiBold', 'Poppins-Italic', 'Poppins-BoldItalic'].map(f));
    d.helv = await d.pdf.embedFont(StandardFonts.Helvetica);
    d.imgs = new Map();
    d.pdf.setTitle('Plan Keila Guerrero');
    d.pdf.setAuthor('Keila Guerrero · Lic. Nutrición');
    return d;
  }
  async img(src) {
    if (!src) return null;
    if (this.imgs.has(src)) return this.imgs.get(src);
    let im = null;
    try {
      const b = src.startsWith('data:') ? dataUrlBytes(src) : await bytes(src);
      const isPng = src.startsWith('data:image/png') || /\.png(\?|$)/i.test(src);
      im = isPng ? await this.pdf.embedPng(b) : await this.pdf.embedJpg(b);
    } catch (e) { console.warn('Imagen omitida', src.slice(0, 60), e); }
    this.imgs.set(src, im);
    return im;
  }
  page() { this.p = this.pdf.addPage([this.W, this.H]); return this.p; }
  y(top) { return this.H - top; }
  async staticPage(src) {
    const im = await this.img(src);
    if (!im) return;
    const p = this.page();
    p.drawImage(im, { x: 0, y: 0, width: this.W, height: this.H });
  }
  async bg(src) { const im = await this.img(src); if (im) this.p.drawImage(im, { x: 0, y: 0, width: this.W, height: this.H }); }
  roundPath(x, top, w, h, r) {
    const y = this.H - top - h;
    const k = r * KAPPA;
    return [
      moveTo(x + r, y), lineTo(x + w - r, y), appendBezierCurve(x + w - r + k, y, x + w, y + r - k, x + w, y + r),
      lineTo(x + w, y + h - r), appendBezierCurve(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h),
      lineTo(x + r, y + h), appendBezierCurve(x + r - k, y + h, x, y + h - r + k, x, y + h - r),
      lineTo(x, y + r), appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y), closePath(),
    ];
  }
  roundRect(x, top, w, h, r, color, opacity = 1) {
    const path = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    this.p.drawSvgPath(path, { x, y: this.H - top, color, opacity, borderWidth: 0 });
  }
  /** Imagen recortada (cover) dentro de una caja redondeada */
  async photo(src, x, top, w, h, r = 14) {
    const im = await this.img(src);
    if (!im) return;
    const s = Math.max(w / im.width, h / im.height);
    const iw = im.width * s, ih = im.height * s;
    this.p.pushOperators(pushGraphicsState(), ...this.roundPath(x, top, w, h, r), clip(), endPath());
    this.p.drawImage(im, { x: x + (w - iw) / 2, y: this.H - top - h + (h - ih) / 2, width: iw, height: ih });
    this.p.pushOperators(popGraphicsState());
  }
  /** Imagen completa (contain) */
  async contain(src, x, top, w, h, opacity = 1) {
    const im = await this.img(src);
    if (!im) return 0;
    const s = Math.min(w / im.width, h / im.height);
    const iw = im.width * s, ih = im.height * s;
    this.p.drawImage(im, { x: x + (w - iw) / 2, y: this.H - top - h + (h - ih) / 2, width: iw, height: ih, opacity });
    return iw;
  }
  safe(text, font) {
    // Sustituye caracteres que la fuente no tiene
    return String(text ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
      .split('').map((ch) => { try { font.encodeText(ch); return ch; } catch { return ''; } }).join('');
  }
  width(text, font, size) { return font.widthOfTextAtSize(this.safe(text, font), size); }
  text(text, x, top, { font = this.reg, size = 10, color = C.ink, align = 'left', w = 0 } = {}) {
    const t = this.safe(text, font);
    let xx = x;
    if (align === 'center') xx = x + (w - font.widthOfTextAtSize(t, size)) / 2;
    if (align === 'right') xx = x + w - font.widthOfTextAtSize(t, size);
    this.p.drawText(t, { x: xx, y: this.H - top - size * 0.8, size, font, color });
    return font.widthOfTextAtSize(t, size);
  }
  wrap(text, font, size, maxW) {
    const words = this.safe(text, font).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(t, size) <= maxW) cur = t;
      else {
        if (cur) lines.push(cur);
        if (font.widthOfTextAtSize(w, size) > maxW) {
          let part = '';
          for (const ch of w) { if (font.widthOfTextAtSize(part + ch, size) > maxW) { lines.push(part); part = ch; } else part += ch; }
          cur = part;
        } else cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  /** Párrafo con salto de línea. Devuelve la altura usada. */
  para(text, x, top, maxW, { font = this.reg, size = 10, color = C.ink, lh = 1.25, align = 'left', dry = false } = {}) {
    const lines = this.wrap(text, font, size, maxW);
    if (!dry) lines.forEach((l, i) => this.text(l, x, top + i * size * lh, { font, size, color, align, w: maxW }));
    return lines.length * size * lh;
  }
  bullets(items, x, top, maxW, opt = {}) {
    let h = 0;
    const size = opt.size || 10;
    for (const it of items.filter(Boolean)) {
      if (!opt.dry) this.text('•', x, top + h, { font: this.reg, size, color: opt.color });
      h += this.para(it, x + size * 0.9, top + h, maxW - size * 0.9, opt);
    }
    return h;
  }
  /** Tamaño de letra más grande (≤ size) con el que el texto cabe en maxW */
  fitSize(text, font, size, maxW, min = 7) {
    let s = size;
    while (s > min && this.width(text, font, s) > maxW) s -= 0.5;
    return s;
  }
  pill(text, cx, top, { bg = C.pill, color = C.ink, font = this.semi, size = 11, padX = 14, h = 22, maxW = 0 } = {}) {
    if (maxW) {
      padX = Math.min(padX, Math.max(8, (maxW - this.width(text, font, size)) / 2));
      size = this.fitSize(text, font, size, maxW - padX * 2, 7);
    }
    const w = this.width(text, font, size) + padX * 2;
    this.roundRect(cx - w / 2, top, w, h, h / 2, bg);
    this.text(text, cx - w / 2, top + (h - size) / 2 + 1, { font, size, color, align: 'center', w });
    return w;
  }
  async save(name) {
    const b = await this.pdf.save();
    const url = URL.createObjectURL(new Blob([b], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return b.length;
  }
}

/* =================== DIETA (A4 horizontal, como los planes de Keila) =================== */
const DW = 842, DH = 596;

async function loadProgress(memberId) {
  try {
    const s = await getDocs(query(collection(db, 'members', memberId, 'progress'), orderBy('date', 'asc')));
    return s.docs.map((d) => d.data());
  } catch { return []; }
}
async function loadPhotos(memberId) {
  try {
    const s = await getDocs(query(collection(db, 'members', memberId, 'photos'), orderBy('date', 'asc')));
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function datosIniciales(d, diet, person, progress) {
  d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
  d.pill(d.ig || '@lic.guerrero.k', 92, 26);
  await d.contain(`${PLAN_BASE}/deco/emoji-shy.png`, 740, 0, 70, 70);
  let x = 60;
  x += d.text('DATOS ', x, 60, { font: d.londrina, size: 46 });
  d.text('INICIALES', x, 60, { font: d.londrina, size: 46, color: C.green });
  if (diet.checkFrom && diet.checkTo) {
    const w = d.text('CHECK: ', 60, 112, { font: d.londrina, size: 24, color: C.lime });
    d.text(`DEL ${fmtDate(diet.checkFrom, { day: 'numeric', month: 'long' })} AL ${fmtDate(diet.checkTo, { day: 'numeric', month: 'long', year: 'numeric' })}`.toUpperCase(), 60 + w, 112, { font: d.londrina, size: 24 });
  }
  const age = ageFrom(person.birthDate);
  const parts = [[fullName(person) + '   ', d.light]];
  if (age != null) parts.push(['EDAD: ', d.bold], [`${age} años   `, d.light]);
  if (person.heightCm) parts.push(['TALLA: ', d.bold], [`${(Number(person.heightCm) / 100).toFixed(2)} mts`, d.light]);
  let ns = 14;
  while (ns > 8 && parts.reduce((s, [t, f]) => s + d.width(t, f, ns), 0) > DW - 120) ns -= 0.5;
  let lx = 60;
  for (const [t, f] of parts) lx += d.text(t, lx, 146, { font: f, size: ns });

  // Tabla de mediciones (como en el PDF original)
  const cols = [['date', 'FECHA'], ['weightKg', 'PESO (kg)'], ['bmi', 'IMC'], ['bodyFat', 'GRASA %'], ['visceralFat', 'NIVEL VISCE'], ['fatKg', 'GRASA (kg)'], ['muscleKg', 'MÚSCULO (kg)'], ['waistCm', 'CINTURA (cm)'], ['hipCm', 'CADERA (cm)']];
  const rows = progress.slice(-8).map((p) => ({ ...p, bmi: p.bmi ?? bmi(p.weightKg, p.heightCm || person.heightCm) }));
  const tx = 40, cw = (DW - 80) / cols.length;
  let top = 186;
  d.roundRect(tx - 6, top - 6, DW - 68, 30 + Math.max(1, rows.length) * 22, 10, C.white, 0.85);
  cols.forEach(([, l], i) => d.text(l, tx + i * cw, top, { font: d.bold, size: 8.5, color: C.lime, align: 'center', w: cw }));
  top += 22;
  if (!rows.length) d.text('Sin mediciones registradas todavía.', tx, top, { font: d.italic, size: 10, color: C.muted });
  rows.forEach((r) => {
    cols.forEach(([k], i) => {
      const v = String(k === 'date' ? fmtDate(r.date, { day: '2-digit', month: 'short', year: '2-digit' }) : r[k] ?? '—');
      d.text(v, tx + i * cw, top, { font: d.light, size: d.fitSize(v, d.light, 10, cw - 6, 6), align: 'center', w: cw });
    });
    top += 22;
  });
  await d.contain(`${PLAN_BASE}/deco/strawberry-slice.png`, 600, 380, 230, 230);
}

async function checkVisual(d, photos) {
  const dates = [...new Set(photos.map((p) => p.date))];
  if (!dates.length) return;
  const first = dates[0], last = dates.length > 1 ? dates[dates.length - 1] : null;
  d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
  d.pill(d.ig || '@lic.guerrero.k', 92, 26);
  let x = (DW - d.width('CHECK VISUAL', d.londrina, 40)) / 2;
  x += d.text('CHECK ', x, 30, { font: d.londrina, size: 40 });
  d.text('VISUAL', x, 30, { font: d.londrina, size: 40, color: C.green });
  const col = async (date, cx, label) => {
    d.text(label, cx - 150, 84, { font: d.semi, size: 13, align: "center", w: 300 });
    d.text(date ? fmtDate(date, { day: "2-digit", month: "long", year: "2-digit" }).toUpperCase() : "PRÓXIMA CONSULTA", cx - 150, 102, { font: d.light, size: 9, align: "center", w: 300 });
    const order = ["frente", "espalda", "perfil", "otra"];
    const set = date ? photos.filter((p) => p.date === date).sort((a, b) => order.indexOf(a.pose) - order.indexOf(b.pose)).slice(0, 2) : [];
    const pw = 150, ph = 420, gap = 10;
    for (let i = 0; i < 2; i++) {
      const px = cx - pw - gap / 2 + i * (pw + gap), pt = 124;
      const p = set[i];
      if (!p) { d.roundRect(px, pt, pw, ph, 10, hex("#e9f1f5"), 0.9); continue; }
      let full = null;
      try { full = await getFullPhoto(p.memberId, p.id); } catch { /* se usa la miniatura */ }
      await d.photo(full || p.thumb, px, pt, pw, ph, 10);
      d.text(POSES[p.pose] || "", px, pt + ph + 4, { font: d.light, size: 8, align: "center", w: pw, color: C.muted });
    }
  };
  await col(first, DW * 0.27, '1° CONSULTA');
  await col(last, DW * 0.73, last ? `${dates.length}° CONSULTA` : '2° CONSULTA');
}

/* ---------- Utilidades de acomodo (nada sale de la página) ---------- */
// Una "pieza" es un renglón o bloque indivisible:
// { h, keep (va pegada a la siguiente), after (espacio extra), group (comida o día), newCol (empieza columna), draw(x, top) }
function flowColumns(pieces, { top, bottom, ncol, contH = 0 }) {
  // Devuelve [{ page, col, top, piece, cont }] repartiendo las piezas en columnas y páginas
  const out = [];
  let page = 0, col = 0, t = top;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const need = p.h + (p.keep && pieces[i + 1] ? pieces[i + 1].h : 0);
    let cont = false;
    if ((i > 0 && p.newCol) || (t > top && t + need > bottom)) {
      col++; t = top;
      if (col >= ncol) { page++; col = 0; }
      if (contH && !p.newCol && i > 0 && pieces[i - 1].group === p.group) { cont = true; t += contH; }
    }
    out.push({ page, col, top: t, piece: p, cont });
    t += p.h + (p.after || 0);
  }
  return out;
}
const piecesHeight = (pieces) => pieces.reduce((s, p) => s + p.h + (p.after || 0), 0);

const SUPP_TOP = 150, SUPP_BOTTOM = DH - 34;

async function suplementos(d, diet) {
  const groups = {};
  for (const s of diet.supplements) (groups[s.when || 'Indicaciones'] ||= []).push(`${s.name}${s.dose ? ': ' + s.dose : ''}`);
  const entries = Object.entries(groups);
  const two = entries.length > 1;
  const colW = two ? 280 : 560;
  const water = diet.waterLiters ? `AGUA: ${diet.waterLiters} lts al día.` : '';
  const imgs = diet.supplements.map((s) => suppImg(s.key)).filter(Boolean);
  // Mide el panel con cada tamaño de letra y elige el mayor que deja espacio a las imágenes
  const measure = (size) => {
    const hs = entries.map(([when, items]) => d.para(`Consumir ${when.toLowerCase()}:`, 0, 0, colW, { font: d.reg, size: size + 0.5, dry: true }) + 4 + d.bullets(items, 0, 0, colW - 10, { font: d.light, size, dry: true }));
    const rows = [];
    for (let i = 0; i < hs.length; i += two ? 2 : 1) rows.push(Math.max(hs[i], hs[i + 1] || 0));
    return { hs, rows, h: rows.reduce((a, b) => a + b + 8, 0) + (water ? size * 1.6 + 6 : 0) };
  };
  const minImgH = imgs.length ? 90 : 0;
  let size = 10.5, m = measure(size);
  while (size > 7.5 && 32 + m.h > SUPP_BOTTOM - SUPP_TOP - minImgH - 20) { size -= 0.5; m = measure(size); }
  // Si aún no cabe, reparte los grupos en varias páginas
  const maxPanel = SUPP_BOTTOM - SUPP_TOP - (imgs.length ? minImgH + 20 : 0) - 32;
  const pages = [[]];
  let acc = 0;
  for (let r = 0; r < m.rows.length; r++) {
    if (acc > 0 && acc + m.rows[r] + 8 > maxPanel) { pages.push([]); acc = 0; }
    pages[pages.length - 1].push(r);
    acc += m.rows[r] + 8;
  }
  for (const [pi, rowIdx] of pages.entries()) {
    d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
    d.pill(d.ig || '@lic.guerrero.k', 110, 36);
    const title1 = 'SUPLEMENTOS ', title2 = pi ? 'SUGERIDOS (CONT.)' : 'SUGERIDOS';
    let x = (DW - d.width(title1 + title2, d.londrina, 34)) / 2;
    x += d.text(title1, x, 84, { font: d.londrina, size: 34 });
    d.text(title2, x, 84, { font: d.londrina, size: 34, color: C.orange });
    const last = pi === pages.length - 1;
    const contentH = rowIdx.reduce((a, r) => a + m.rows[r] + 8, 0) + (last && water ? size * 1.6 + 6 : 0);
    const panelH = Math.max(160, contentH + 32);
    await d.photo(`${PLAN_BASE}/kraft.jpg`, 110, SUPP_TOP, 622, panelH, 18);
    let ty = SUPP_TOP + 16;
    for (const r of rowIdx) {
      const cells = two ? [r * 2, r * 2 + 1] : [r];
      cells.forEach((gi, k) => {
        const e = entries[gi];
        if (!e) return;
        const xx = 135 + k * (colW + 20);
        const hh = d.para(`Consumir ${e[0].toLowerCase()}:`, xx, ty, colW, { font: d.reg, size: size + 0.5 }) + 4;
        d.bullets(e[1], xx + 8, ty + hh, colW - 10, { font: d.light, size });
      });
      ty += m.rows[r] + 8;
    }
    if (last && water) d.text(water, 135, ty, { font: d.reg, size: size + 0.5 });
    // Imágenes de los productos (en la última página, en una o dos filas)
    if (last && imgs.length) {
      const imgTop = SUPP_TOP + panelH + 20;
      const rowsN = imgs.length > 7 ? 2 : 1;
      const per = Math.ceil(imgs.length / rowsN);
      const rowH = Math.min(170, (SUPP_BOTTOM - imgTop) / rowsN - 6);
      if (rowH >= 40) {
        for (let rr = 0; rr < rowsN; rr++) {
          const row = imgs.slice(rr * per, rr * per + per);
          const slotW = Math.min(150, (DW - 140) / Math.max(1, row.length));
          let ix = (DW - slotW * row.length) / 2;
          for (const src of row) { await d.contain(src, ix + 6, imgTop + rr * (rowH + 6), slotW - 12, rowH); ix += slotW; }
        }
      }
    }
  }
}

const MEAL_GAP = 14;
/** Piezas de una comida (encabezado con foto + secciones renglón por renglón) */
function mealPieces(d, m, w, size) {
  const snack = isSnack(m.slot);
  const label = slotLabel(m);
  const titleH = m.title ? d.para(m.title, 0, 0, w, { font: d.boldItalic, size: size - 0.5, dry: true }) + 4 : 0;
  const photoH = m.photo ? 108 : 0;
  const labelSize = d.fitSize(label, d.bold, 14, w - (snack ? 20 : 0), 7);
  const head = {
    h: photoH + (snack ? 32 : 18) + titleH, keep: true,
    draw: async (x, top) => {
      let h = 0;
      if (m.photo) { await d.photo(foodPhoto(m.photo), x, top, w, 102, 14); h += 108; }
      if (snack) d.pill(label, x + w / 2, top + h, { bg: C.snack, color: C.white, font: d.bold, size: 14, h: 26, padX: 22, maxW: w });
      else d.text(label, x, top + h + (14 - labelSize) / 2, { font: d.bold, size: labelSize, align: 'center', w });
      h += snack ? 32 : 18;
      if (m.title) d.para(m.title, x, top + h, w, { font: d.boldItalic, size: size - 0.5, align: 'center' });
    },
  };
  const pieces = [head];
  for (const s of m.sections || []) {
    const items = (s.items || []).filter(Boolean);
    if (!items.length && !s.label) continue;
    if (s.label) {
      const txt = `${s.label}:`;
      pieces.push({ h: d.para(txt, 0, 0, w, { font: d.italic, size, dry: true }), keep: items.length > 0, draw: (x, top) => d.para(txt, x, top, w, { font: d.italic, size }) });
    }
    items.forEach((it, k) => pieces.push({
      h: d.bullets([it], 0, 0, w - 4, { font: d.reg, size, dry: true, lh: 1.18 }), after: k === items.length - 1 ? 4 : 0,
      draw: (x, top) => d.bullets([it], x + 4, top, w - 4, { font: d.reg, size, lh: 1.18 }),
    }));
  }
  pieces[pieces.length - 1].after = (pieces[pieces.length - 1].after || 0) + MEAL_GAP;
  pieces.forEach((p) => { p.group = m; });
  return pieces;
}

/** Banda kraft con el tip del día: crece o reduce la letra para que el texto nunca se salga */
async function tipBand(d, day, dailyTip, top) {
  const tip = day.tip?.text ? day.tip : dailyTip;
  if (!tip?.text) return top + 10;
  const label = day.tip?.text ? '' : 'Inicia tu día todos los días con: ';
  const maxW = DW - 220;
  const one = d.width(label, d.bold, 11) + d.width(tip.text, d.reg, 11);
  let band = 40, size = 11, lines = null;
  if (one > maxW) {
    for (size = 10; size > 7.5; size -= 0.5) { lines = d.wrap(label + tip.text, d.reg, size, maxW); if (lines.length <= 2) break; }
    lines = d.wrap(label + tip.text, d.reg, size, maxW);
    band = Math.max(40, lines.length * size * 1.25 + 14);
  }
  await d.photo(`${PLAN_BASE}/kraft.jpg`, 0, top, DW, band, 0);
  if (!lines) {
    let x = (DW - one) / 2;
    if (label) x += d.text(label, x, top + 14, { font: d.bold, size: 11 });
    d.text(tip.text, x, top + 14, { font: d.reg, size: 11 });
  } else {
    const th = lines.length * size * 1.25;
    lines.forEach((l, i) => d.text(l, 110, top + (band - th) / 2 + i * size * 1.25, { font: d.reg, size, align: 'center', w: maxW }));
  }
  if (tip.image) await d.contain(tipImg(tip.image), 30, top - 26, 60, band + 52);
  return top + band + 16;
}

async function diaPagina(d, day, dailyTip) {
  const main = day.meals.filter((m) => !isSnack(m.slot));
  const snacks = day.meals.filter((m) => isSnack(m.slot));
  const ncol = Math.max(3, Math.min(4, main.length));
  const gap = 24, colW = (DW - 48 - gap * (ncol - 1)) / ncol;
  const noteSize = day.note ? d.fitSize(day.note, d.bold, 10, (DW - 160) * 2, 8) : 10;
  const noteH = day.note ? d.para(day.note, 0, 0, DW - 160, { font: d.bold, size: noteSize, dry: true }) : 0;
  const bottom = DH - 38 - (noteH ? noteH + 6 : 0);

  const startPage = async (cont) => {
    d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
    await d.contain('/monogram.png', 250, 170, 340, 300, 0.07);
    const title = cont ? `${day.day} (CONT.)` : day.day;
    d.text(title, 30, 18, { font: d.londrina, size: d.fitSize(title, d.londrina, 46, DW - 60, 22), color: C.rust, align: 'center', w: DW - 60 });
    return tipBand(d, day, dailyTip, 74);
  };
  const endPage = (last) => {
    if (last && day.note) d.para(day.note, 80, DH - 38 - noteH, DW - 160, { font: d.bold, size: noteSize, align: 'center', color: C.rust });
    d.pill(d.ig || '@lic.guerrero.k', DW / 2, DH - 30, { size: 9, h: 18 });
  };

  // 1) Diseño original: una columna por comida principal, snacks bajo la 1ª y la última columna
  const cols = Array.from({ length: ncol }, (_, i) => [main[i]].filter(Boolean));
  snacks.forEach((s, i) => cols[!main.length ? i % ncol : i === 0 ? 0 : ncol - 1 - ((i - 1) % ncol)].push(s));
  main.slice(ncol).forEach((m, i) => cols[i % ncol].push(m));
  const top = await startPage(false);
  for (let size = 9.5; size >= 7.5; size -= 0.5) {
    const ok = cols.every((col) => piecesHeight(col.flatMap((m) => mealPieces(d, m, colW, size))) - MEAL_GAP <= bottom - top);
    if (!ok) continue;
    for (const [i, col] of cols.entries()) {
      let t = top;
      const x = 24 + i * (colW + gap);
      for (const p of col.flatMap((m) => mealPieces(d, m, colW, size))) { await p.draw(x, t); t += p.h + (p.after || 0); }
    }
    endPage(true);
    return;
  }

  // 2) No cabe: las comidas fluyen en columnas y continúan en otra página "(CONT.)"
  const size = 8.5;
  const pieces = [];
  for (const m of day.meals) {
    const mp = mealPieces(d, m, colW, size);
    // Si la comida completa cabe en una columna, que no se parta; si no, se reparte por renglones
    const total = piecesHeight(mp) - MEAL_GAP;
    if (total <= bottom - top) {
      pieces.push({ h: total, after: MEAL_GAP, group: m, draw: async (x, t0) => { let t = t0; for (const p of mp) { await p.draw(x, t); t += p.h + (p.after || 0); } } });
    } else pieces.push(...mp);
  }
  const contH = size * 1.3 + 4;
  const placed = flowColumns(pieces, { top, bottom, ncol, contH });
  let curPage = 0;
  for (const item of placed) {
    if (item.page !== curPage) { endPage(false); curPage = item.page; await startPage(true); }
    const x = 24 + item.col * (colW + gap);
    // Si una comida continúa en otra columna, "(cont.)" arriba de la columna nueva
    if (item.cont) {
      const lbl = `${slotLabel(item.piece.group)} (cont.)`;
      d.text(lbl, x, item.top - contH, { font: d.boldItalic, size: d.fitSize(lbl, d.boldItalic, size, colW, 6), color: C.muted, align: 'center', w: colW });
    }
    await item.piece.draw(x, item.top);
  }
  endPage(true);
}

/** Tabla de equivalentes en columnas (una o más páginas) */
async function equivalentes(d, diet) {
  const groups = (diet.equivalents || []).filter((g) => g.group || g.items?.length);
  if (!groups.length) return;
  const ncol = 4, gap = 16, colW = (DW - 60 - gap * (ncol - 1)) / ncol, top0 = 92, bottom = DH - 40, size = 8.5;
  const newPage = async () => {
    d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
    d.text('EQUIVALENTES', 0, 22, { font: d.londrina, size: 40, color: C.rust, align: 'center', w: DW });
    d.text('Cada renglón equivale a 1 porción: puedes intercambiar alimentos del mismo grupo.', 0, 68, { font: d.italic, size: 10, align: 'center', w: DW });
    d.pill(d.ig || '@lic.guerrero.k', DW / 2, DH - 30, { size: 9, h: 18 });
  };
  await newPage();
  let col = 0, t = top0;
  for (const g of groups) {
    const items = (g.items || []).filter(Boolean);
    const head = 22 + (g.portion ? 12 : 0);
    let k = 0;
    while (k < items.length || k === 0) {
      if (t + head + (items.length > 2 ? 36 : 12) > bottom) { col++; t = top0; if (col >= ncol) { await newPage(); col = 0; } }
      const x = 30 + col * (colW + gap);
      d.text(g.group + (k ? ' (cont.)' : ''), x, t, { font: d.londrina, size: 16, color: C.green });
      if (g.portion) d.text(g.portion, x, t + 19, { font: d.semi, size: 8.5 });
      t += head;
      while (k < items.length) {
        const h = d.bullets([items[k]], x, t, colW, { font: d.reg, size, dry: true, lh: 1.15 });
        if (t + h > bottom) break;
        d.bullets([items[k]], x, t, colW, { font: d.reg, size, lh: 1.15 });
        t += h; k++;
      }
      t += 10;
      if (!items.length) break;
    }
  }
}

async function recomendaciones(d, diet) {
  const recs = (diet.recommendations || []).filter(Boolean), avoid = (diet.avoid || []).filter(Boolean);
  if (!recs.length && !avoid.length && !diet.notes) return;
  const TOP = 120, BOTTOM = DH - 40;
  const LW = avoid.length ? 440 : 680, RW_ = 240;
  const leftPieces = (size) => [
    ...recs.map((r) => ({ h: d.bullets([r], 0, 0, LW, { font: d.reg, size, lh: 1.3, dry: true }), draw: (x, t) => d.bullets([r], x, t, LW, { font: d.reg, size, lh: 1.3 }) })),
    ...String(diet.notes || '').split('\n').filter((l) => l.trim()).map((l, i) => ({ h: d.para(l, 0, 0, LW, { font: d.italic, size: size - 0.5, dry: true }) + (i ? 0 : 12), draw: (x, t) => d.para(l, x, t + (i ? 0 : 12), LW, { font: d.italic, size: size - 0.5 }) })),
  ];
  const rightPieces = (size) => avoid.map((a) => ({ h: d.bullets([a], 0, 0, RW_, { font: d.reg, size, lh: 1.3, dry: true }), draw: (x, t) => d.bullets([a], x, t, RW_, { font: d.reg, size, lh: 1.3 }) }));
  let size = 11;
  while (size > 8.5 && (piecesHeight(leftPieces(size)) > BOTTOM - TOP || piecesHeight(rightPieces(size)) > BOTTOM - TOP)) size -= 0.5;
  const L = flowColumns(leftPieces(size), { top: TOP, bottom: BOTTOM, ncol: 1 });
  const R = flowColumns(rightPieces(size), { top: TOP, bottom: BOTTOM, ncol: 1 });
  const nPages = Math.max(1, ...L.map((p) => p.page + 1), ...R.map((p) => p.page + 1));
  for (let pg = 0; pg < nPages; pg++) {
    d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
    d.pill(d.ig || '@lic.guerrero.k', 92, 26);
    await d.contain(`${PLAN_BASE}/deco/emoji-think.png`, 740, 0, 70, 70);
    d.text(pg ? 'RECOMENDACIONES (CONT.)' : 'RECOMENDACIONES', 60, 64, { font: d.londrina, size: 34, color: C.green });
    let leftEnd = TOP;
    for (const it of L.filter((p) => p.page === pg)) { await it.piece.draw(64, it.top); leftEnd = it.top + it.piece.h; }
    const rItems = R.filter((p) => p.page === pg);
    if (rItems.length) {
      d.text(pg ? 'EVITAR (CONT.)' : 'EVITAR', 560, 64, { font: d.londrina, size: 34, color: C.orange });
      for (const it of rItems) await it.piece.draw(564, it.top);
    }
    // La fresa decorativa solo si no tapa el texto
    if (leftEnd < 410) await d.contain(`${PLAN_BASE}/deco/strawberry.png`, 0, 420, 160, 176);
  }
}

async function final(d, diet, contact) {
  d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
  d.text('¡MUCHO ÉXITO!', 0, 60, { font: d.londrina, size: 54, align: 'center', w: DW });
  await d.contain('/monogram.png', 60, 190, 190, 150);
  d.text('RECUERDA!', 90, 360, { font: d.bold, size: 14 });
  if (diet.nextChange) {
    const w = d.text('CAMBIO DE PLAN: ', 90, 386, { font: d.londrina, size: 22, color: C.rust });
    d.text(fmtDate(diet.nextChange, { day: '2-digit', month: 'long', year: '2-digit' }).toUpperCase(), 90 + w, 388, { font: d.reg, size: 15 });
  }
  d.text('NO OLVIDES SEGUIRNOS', 90, 440, { font: d.londrina, size: 22 });
  d.text('Y ETIQUETARNOS', 90, 466, { font: d.londrina, size: 22 });
  await d.contain(`${PLAN_BASE}/deco/heart.png`, 238, 464, 22, 22);
  d.pill(contact?.instagram || '@lic.guerrero.k', 160, 520, { size: 10, h: 22 });
  await d.contain(`${PLAN_BASE}/deco/fruit-bowl.png`, 470, 150, 340, 340);
}

export async function dietPdf(rawDiet, person, { contact } = {}) {
  const diet = normalizeDiet(rawDiet);
  const d = await Doc.create(DW, DH);
  d.ig = contact?.instagram || '';
  d.memberId = person.id;
  const [progress, photos] = person.id ? await Promise.all([loadProgress(person.id), loadPhotos(person.id)]) : [[], []];
  await d.staticPage(STATIC_PAGES.portada);
  await d.staticPage(STATIC_PAGES.requisitos);
  await datosIniciales(d, diet, person, progress);
  await checkVisual(d, photos.map((p) => ({ ...p, memberId: person.id })));
  await d.staticPage(STATIC_PAGES.instrucciones);
  if (diet.supplements?.length) await suplementos(d, diet);
  for (const day of diet.days) await diaPagina(d, day, diet.dailyTip);
  await equivalentes(d, diet);
  await recomendaciones(d, diet);
  await d.staticPage(STATIC_PAGES.marcas1);
  await d.staticPage(STATIC_PAGES.marcas2);
  await d.staticPage(STATIC_PAGES.necesitas);
  await d.staticPage(STATIC_PAGES.guiaVisual);
  await final(d, diet, contact);
  return d.save(`Plan de alimentación - ${fullName(person)}.pdf`);
}

/* =================== RUTINA (vertical, como el plan de entrenamiento de Keila) =================== */
const RW = 810, RH = 1440;

async function rutinaHeader(d, routine) {
  await d.bg(`${PLAN_BASE}/bg-paper.jpg`);
  await d.contain(`${PLAN_BASE}/deco/dumbbell.png`, 600, 6, 200, 180, 0.3);
  await d.contain('/monogram.png', 40, 38, 160, 110);
  d.text('PLAN DE', 260, 62, { font: d.semi, size: 44, color: C.dark });
  d.text('ENTRENAMIENTO', 260, 112, { font: d.semi, size: 44, color: C.dark });
  if (routine.schedule) d.text(routine.schedule, 520, 20, { font: d.reg, size: d.fitSize(routine.schedule, d.reg, 18, 260, 10), color: C.dark, align: 'right', w: 260 });
}
function rutinaFooter(d, contact) {
  d.p.drawRectangle({ x: 0, y: 0, width: RW, height: 46, color: hex('#111111') });
  d.text('¡Ponerte en contacto conmigo es el primer paso!', 0, RH - 44, { font: d.reg, size: 11, color: C.white, align: 'center', w: RW });
  const parts = [contact?.instagram || '@lic.guerrero.k', contact?.whatsapp || '8714176397', contact?.email || 'keilaguerrero774@gmail.com'];
  d.text(parts.join('     ·     '), 0, RH - 26, { font: d.reg, size: 13, color: C.white, align: 'center', w: RW });
}

const R_CARD_TOP = 290, R_T0 = 312, R_BOTTOM = RH - 70 - 26; // contenido dentro de la tarjeta blanca

function drawDayPill(d, name, x, w) {
  d.roundRect(x + 20, 210, w - 40, 58, 12, hex('#2f2e2c'));
  let ns = 26;
  while (ns > 15 && d.width(name, d.bold, ns) > w - 76) ns -= 1;
  if (d.width(name, d.bold, ns) <= w - 76) d.text(name, x + 20, 226 + (26 - ns) / 2, { font: d.bold, size: ns, color: C.white, align: 'center', w: w - 40 });
  else {
    let s = 15, lines = d.wrap(name, d.bold, s, w - 76);
    while (s > 9 && lines.length > 2) { s -= 0.5; lines = d.wrap(name, d.bold, s, w - 76); }
    const th = lines.length * s * 1.1;
    lines.slice(0, 3).forEach((l, i) => d.text(l, x + 38, 239 - th / 2 + i * s * 1.1, { font: d.bold, size: s, color: C.white, align: 'center', w: w - 76 }));
  }
}

/** Piezas (renglones) de un día de rutina para acomodarlas en columnas */
function dayPieces(d, day, w, size) {
  const pad = 22, iw = w - pad * 2;
  const P = [];
  const add = (h, draw, extra = {}) => P.push({ h, draw, group: day, ...extra });
  const para = (txt, font, opt = {}) => ({ h: d.para(txt, 0, 0, iw - (opt.ind || 0), { font, size: opt.size || size, color: C.dark, align: opt.align, dry: true }), draw: (x, t) => d.para(txt, x + pad + (opt.ind || 0), t, iw - (opt.ind || 0), { font, size: opt.size || size, color: C.dark, align: opt.align }) });
  const lines = (txt) => String(txt || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (day.warmup) { const p = para(day.warmup, d.reg, { align: 'center' }); add(p.h, p.draw, { after: 14 }); }
  for (const b of day.blocks || []) {
    if (b.title) { const p = para(b.title, d.bold, { size: size + 1, align: 'center' }); add(p.h + 6, (x, t) => p.draw(x, t + 4), { keep: true }); }
    const k = para(b.sets ? `${b.kind} (${b.sets} SERIES)` : b.kind, d.bold);
    add(k.h + 2, k.draw, { keep: true });
    for (const e of b.exercises || []) {
      const name = (e.name || EXERCISE_MAP[e.exerciseId]?.name || '').toUpperCase();
      const n = para(name, d.bold, { ind: 18 });
      const det = lines(e.detail).map((l) => para(l, d.light));
      const h = n.h + det.reduce((s, p) => s + p.h, 0) + 4;
      add(h, (x, t) => {
        d.text('•', x + pad + 4, t, { font: d.bold, size, color: C.dark });
        n.draw(x, t);
        let tt = t + n.h;
        for (const p of det) { p.draw(x, tt); tt += p.h; }
      });
    }
    for (const l of lines(b.note)) { const p = para(l, d.italic); add(p.h, p.draw); }
    P[P.length - 1].after = (P[P.length - 1].after || 0) + 10;
  }
  if (day.cardio) {
    const t = para('CARDIO', d.bold); add(t.h, t.draw, { keep: true });
    for (const l of lines(day.cardio)) { const p = para(l, d.light); add(p.h, p.draw); }
    P[P.length - 1].after = 8;
  }
  for (const ex of day.extras || []) {
    const items = (ex.items || []).filter(Boolean);
    if (ex.title) { const t = para(ex.title, d.bold, { size: size + 1 }); add(t.h + 2, t.draw, { keep: items.length > 0 }); }
    for (const it of items) add(d.bullets([it], 0, 0, iw - 4, { font: d.light, size, dry: true }), (x, t) => d.bullets([it], x + pad + 4, t, iw - 4, { font: d.light, size, color: C.dark }));
    if (P.length) P[P.length - 1].after = 10;
  }
  if (!P.length) add(0, () => {});
  P[0].newCol = true;
  return P;
}

export async function routinePdf(rawRoutine, person, { contact } = {}) {
  const routine = normalizeRoutine(rawRoutine);
  const d = await Doc.create(RW, RH);
  d.ig = contact?.instagram || '';
  const colW = RW / 2;
  const avail = R_BOTTOM - R_T0;
  // Tamaño más grande con el que cada día cabe en su columna (15 → 10)
  const fitDay = (day) => { for (let s = 15; s >= 10; s -= 0.5) if (piecesHeight(dayPieces(d, day, colW, s)) <= avail) return s; return null; };
  const sizes = routine.days.map(fitDay);
  const columns = []; // { day, cont, items: [{ top, piece }] }
  if (sizes.every((s) => s != null)) {
    // Diseño original: dos días por hoja, cada uno en su columna
    for (let i = 0; i < routine.days.length; i += 2) {
      const size = Math.min(...sizes.slice(i, i + 2));
      for (const day of routine.days.slice(i, i + 2)) {
        let t = R_T0;
        const items = dayPieces(d, day, colW, size).map((piece) => { const it = { top: t, piece }; t += piece.h + (piece.after || 0); return it; });
        columns.push({ day, cont: false, items });
      }
    }
  } else {
    // Algún día no cabe: los días continúan en la siguiente columna como "NOMBRE (CONT.)"
    const size = 11;
    const placed = flowColumns(routine.days.flatMap((day) => dayPieces(d, day, colW, size)), { top: R_T0, bottom: R_BOTTOM, ncol: 1 });
    for (const it of placed) {
      const last = columns[columns.length - 1];
      if (!last || last.idx !== it.page) columns.push({ idx: it.page, day: it.piece.group, cont: !it.piece.newCol, items: [] });
      columns[columns.length - 1].items.push({ top: it.top, piece: it.piece });
    }
  }
  for (let i = 0; i < columns.length; i += 2) {
    d.page();
    await rutinaHeader(d, routine);
    for (const [k, col] of columns.slice(i, i + 2).entries()) {
      const x = k * colW;
      const end = col.items.reduce((m, it) => Math.max(m, it.top + it.piece.h), R_T0);
      drawDayPill(d, col.cont ? `${col.day.name} (CONT.)` : col.day.name, x, colW);
      d.roundRect(x + 18, R_CARD_TOP, colW - 36, Math.min(end - R_CARD_TOP + 26, RH - 70 - R_CARD_TOP), 22, C.white, 0.95);
      for (const it of col.items) await it.piece.draw(x, it.top);
    }
    rutinaFooter(d, contact);
  }
  if (routine.notes) {
    // Indicaciones: letra de 18 hacia abajo; si aún no caben, continúan en otra hoja
    const NT = 340, NB = 230 + 1060 - 40, w = RW - 200;
    const paras = routine.notes.split('\n').map((l) => l.trim()).filter(Boolean);
    let size = 18;
    const piecesAt = (s) => paras.map((l) => ({ h: d.para(l, 0, 0, w, { font: d.reg, size: s, lh: 1.45, dry: true }) + s * 0.4, draw: (x, t) => d.para(l, x, t, w, { font: d.reg, size: s, color: C.dark, lh: 1.45 }) }));
    while (size > 11 && piecesHeight(piecesAt(size)) > NB - NT) size -= 1;
    const placed = flowColumns(piecesAt(size), { top: NT, bottom: NB, ncol: 1 });
    const pages = Math.max(1, ...placed.map((p) => p.page + 1));
    for (let pg = 0; pg < pages; pg++) {
      d.page(); await rutinaHeader(d, routine);
      d.roundRect(60, 230, RW - 120, 1060, 24, C.white, 0.95);
      d.text(pg ? 'INDICACIONES (CONT.)' : 'INDICACIONES', 60, 270, { font: d.bold, size: 30, color: C.dark, align: 'center', w: RW - 120 });
      for (const it of placed.filter((p) => p.page === pg)) await it.piece.draw(100, it.top);
      rutinaFooter(d, contact);
    }
  }
  await d.staticPage(STATIC_PAGES.rutinaIndicaciones);
  await d.staticPage(STATIC_PAGES.rutinaConceptos1);
  await d.staticPage(STATIC_PAGES.rutinaConceptos2);
  return d.save(`Plan de entrenamiento - ${fullName(person)}.pdf`);
}

export { SUPP_MAP };

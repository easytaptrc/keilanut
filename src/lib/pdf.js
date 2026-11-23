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
  pill(text, cx, top, { bg = C.pill, color = C.ink, font = this.semi, size = 11, padX = 14, h = 22 } = {}) {
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
  d.pill('@lic.guerrero.k', 92, 26);
  await d.contain(`${PLAN_BASE}/deco/emoji-shy.png`, 740, 0, 70, 70);
  let x = 60;
  x += d.text('DATOS ', x, 60, { font: d.londrina, size: 46 });
  d.text('INICIALES', x, 60, { font: d.londrina, size: 46, color: C.green });
  if (diet.checkFrom && diet.checkTo) {
    const w = d.text('CHECK: ', 60, 112, { font: d.londrina, size: 24, color: C.lime });
    d.text(`DEL ${fmtDate(diet.checkFrom, { day: 'numeric', month: 'long' })} AL ${fmtDate(diet.checkTo, { day: 'numeric', month: 'long', year: 'numeric' })}`.toUpperCase(), 60 + w, 112, { font: d.londrina, size: 24 });
  }
  const age = ageFrom(person.birthDate);
  let lx = 60;
  lx += d.text(fullName(person) + '   ', lx, 146, { font: d.light, size: 14 });
  if (age != null) { lx += d.text('EDAD: ', lx, 146, { font: d.bold, size: 14 }); lx += d.text(`${age} años   `, lx, 146, { font: d.light, size: 14 }); }
  if (person.heightCm) { lx += d.text('TALLA: ', lx, 146, { font: d.bold, size: 14 }); d.text(`${(Number(person.heightCm) / 100).toFixed(2)} mts`, lx, 146, { font: d.light, size: 14 }); }

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
      const v = k === 'date' ? fmtDate(r.date, { day: '2-digit', month: 'short', year: '2-digit' }) : r[k] ?? '—';
      d.text(String(v), tx + i * cw, top, { font: d.light, size: 10, align: 'center', w: cw });
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
  d.pill('@lic.guerrero.k', 92, 26);
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

async function suplementos(d, diet) {
  d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
  d.pill('@lic.guerrero.k', 110, 36);
  let x = (DW - d.width('SUPLEMENTOS SUGERIDOS', d.londrina, 34)) / 2;
  x += d.text('SUPLEMENTOS ', x, 84, { font: d.londrina, size: 34 });
  d.text('SUGERIDOS', x, 84, { font: d.londrina, size: 34, color: C.orange });
  // Panel kraft con las indicaciones
  await d.photo(`${PLAN_BASE}/kraft.jpg`, 110, 150, 622, 160, 18);
  const groups = {};
  for (const s of diet.supplements) (groups[s.when || 'Indicaciones'] ||= []).push(`${s.name}${s.dose ? ': ' + s.dose : ''}`);
  const entries = Object.entries(groups);
  const colW = entries.length > 1 ? 280 : 560;
  let cx = 135, ty = 166, maxH = 0;
  entries.forEach(([when, items], i) => {
    if (i === 2) { cx = 135; ty += maxH + 8; maxH = 0; }
    const xx = cx + (i % 2) * (colW + 20);
    d.text(`Consumir ${when.toLowerCase()}:`, xx, ty, { font: d.reg, size: 11 });
    const h = 16 + d.bullets(items, xx + 8, ty + 16, colW - 10, { font: d.light, size: 10.5 });
    maxH = Math.max(maxH, h);
  });
  if (diet.waterLiters) d.text(`AGUA: ${diet.waterLiters} lts al día.`, 470, 286, { font: d.reg, size: 11 });
  // Imágenes de los productos
  const imgs = diet.supplements.map((s) => suppImg(s.key)).filter(Boolean).slice(0, 7);
  const slotW = Math.min(150, (DW - 140) / Math.max(1, imgs.length));
  let ix = (DW - slotW * imgs.length) / 2;
  for (const src of imgs) { await d.contain(src, ix + 6, 330, slotW - 12, 170); ix += slotW; }
}

/** Dibuja una comida en una columna y devuelve la altura usada */
async function mealBlock(d, m, x, top, w, size, dry = false) {
  let h = 0;
  const snack = isSnack(m.slot);
  if (m.photo) { if (!dry) await d.photo(foodPhoto(m.photo), x, top, w, 102, 14); h += 108; }
  if (snack) { if (!dry) d.pill(slotLabel(m), x + w / 2, top + h, { bg: C.snack, color: C.white, font: d.bold, size: 14, h: 26, padX: 22 }); h += 32; }
  else { if (!dry) d.text(slotLabel(m), x, top + h, { font: d.bold, size: 14, align: 'center', w }); h += 18; }
  if (m.title) h += d.para(m.title, x, top + h, w, { font: d.boldItalic, size: size - 0.5, align: 'center', dry }) + 4;
  for (const s of m.sections || []) {
    const items = (s.items || []).filter(Boolean);
    if (!items.length && !s.label) continue;
    if (s.label) h += d.para(`${s.label}:`, x, top + h, w, { font: d.italic, size, dry });
    h += d.bullets(items, x + 4, top + h, w - 4, { font: d.reg, size, dry, lh: 1.18 }) + 4;
  }
  return h;
}

async function diaPagina(d, day, dailyTip) {
  d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
  await d.contain('/monogram.png', 250, 170, 340, 300, 0.07);
  d.text(day.day, 0, 18, { font: d.londrina, size: 46, color: C.rust, align: 'center', w: DW });
  const tip = day.tip?.text ? day.tip : dailyTip;
  let top = 74;
  if (tip?.text) {
    await d.photo(`${PLAN_BASE}/kraft.jpg`, 0, top, DW, 40, 0);
    const label = day.tip?.text ? '' : 'Inicia tu día todos los días con: ';
    const tw = d.width(label, d.bold, 11) + d.width(tip.text, d.reg, 11);
    const maxW = DW - 220;
    if (tw <= maxW) {
      let x = (DW - tw) / 2;
      if (label) x += d.text(label, x, top + 14, { font: d.bold, size: 11 });
      d.text(tip.text, x, top + 14, { font: d.reg, size: 11 });
    } else d.para(label + tip.text, 110, top + 6, maxW, { font: d.reg, size: 10, align: 'center' });
    if (tip.image) await d.contain(tipImg(tip.image), 30, top - 26, 60, 92);
    top += 56;
  } else top += 10;

  const main = day.meals.filter((m) => !isSnack(m.slot));
  const snacks = day.meals.filter((m) => isSnack(m.slot));
  const ncol = Math.max(3, Math.min(4, main.length));
  const gap = 24, colW = (DW - 48 - gap * (ncol - 1)) / ncol;
  // Asigna snacks a las columnas (1ª y última, como en el plan original)
  const cols = Array.from({ length: ncol }, (_, i) => [main[i]].filter(Boolean));
  snacks.forEach((s, i) => cols[!main.length ? i % ncol : i === 0 ? 0 : ncol - 1 - ((i - 1) % ncol)].push(s));
  main.slice(ncol).forEach((m, i) => cols[i % ncol].push(m));
  // Ajusta el tamaño de letra para que todo quepa en la página
  let size = 9.5;
  for (; size > 6.5; size -= 0.5) {
    let fits = true;
    for (const col of cols) {
      let h = 0;
      for (const m of col) h += (await mealBlock(d, m, 0, 0, colW, size, true)) + 14;
      if (top + h > DH - (day.note ? 54 : 34)) { fits = false; break; }
    }
    if (fits) break;
  }
  for (const [i, col] of cols.entries()) {
    let t = top;
    const x = 24 + i * (colW + gap);
    for (const m of col) t += (await mealBlock(d, m, x, t, colW, size)) + 14;
  }
  if (day.note) d.para(day.note, 80, DH - 50, DW - 160, { font: d.bold, size: 10, align: 'center', color: C.rust });
  d.pill('@lic.guerrero.k', DW / 2, DH - 30, { size: 9, h: 18 });
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
    d.pill('@lic.guerrero.k', DW / 2, DH - 30, { size: 9, h: 18 });
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
  d.page(); await d.bg(`${PLAN_BASE}/bg-marble.jpg`);
  d.pill('@lic.guerrero.k', 92, 26);
  await d.contain(`${PLAN_BASE}/deco/emoji-think.png`, 740, 0, 70, 70);
  d.text('RECOMENDACIONES', 60, 64, { font: d.londrina, size: 34, color: C.green });
  let h = d.bullets(recs, 64, 120, 440, { font: d.reg, size: 11, lh: 1.3 });
  if (diet.notes) h += 12 + d.para(diet.notes, 64, 120 + h + 12, 440, { font: d.italic, size: 10.5 });
  if (avoid.length) {
    d.text('EVITAR', 560, 64, { font: d.londrina, size: 34, color: C.orange });
    d.bullets(avoid, 564, 120, 240, { font: d.reg, size: 11, lh: 1.3 });
  }
  await d.contain(`${PLAN_BASE}/deco/strawberry.png`, 0, 420, 160, 176);
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
  if (routine.schedule) d.text(routine.schedule, 560, 20, { font: d.reg, size: 18, color: C.dark, align: 'right', w: 220 });
}
function rutinaFooter(d, contact) {
  d.p.drawRectangle({ x: 0, y: 0, width: RW, height: 46, color: hex('#111111') });
  d.text('¡Ponerte en contacto conmigo es el primer paso!', 0, RH - 44, { font: d.reg, size: 11, color: C.white, align: 'center', w: RW });
  const parts = [contact?.instagram || '@lic.guerrero.k', contact?.whatsapp || '8714176397', contact?.email || 'keilaguerrero774@gmail.com'];
  d.text(parts.join('     ·     '), 0, RH - 26, { font: d.reg, size: 13, color: C.white, align: 'center', w: RW });
}

function dayColumn(d, day, x, w, dry, size) {
  let h = 0;
  const top = 290;
  if (!dry) {
    d.roundRect(x + 20, 210, w - 40, 58, 12, hex('#2f2e2c'));
    d.text(day.name, x + 20, 226, { font: d.bold, size: 26, color: C.white, align: 'center', w: w - 40 });
  }
  const pad = 22, iw = w - pad * 2;
  const t0 = top + 22;
  if (day.warmup) h += d.para(day.warmup, x + pad, t0 + h, iw, { font: d.reg, size, color: C.dark, align: 'center', dry }) + 14;
  for (const b of day.blocks) {
    h += d.para(`${b.kind} (${b.sets} SERIES)`, x + pad, t0 + h, iw, { font: d.bold, size, color: C.dark, dry }) + 2;
    for (const e of b.exercises) {
      const name = (e.name || EXERCISE_MAP[e.exerciseId]?.name || '').toUpperCase();
      if (!dry) d.text('•', x + pad + 4, t0 + h, { font: d.bold, size, color: C.dark });
      h += d.para(name, x + pad + 18, t0 + h, iw - 18, { font: d.bold, size, color: C.dark, dry });
      if (e.detail) h += d.para(e.detail, x + pad, t0 + h, iw, { font: d.light, size, color: C.dark, dry });
      h += 4;
    }
    h += 10;
  }
  if (day.cardio) { h += d.para('CARDIO', x + pad, t0 + h, iw, { font: d.bold, size, color: C.dark, dry }); h += d.para(day.cardio, x + pad, t0 + h, iw, { font: d.light, size, color: C.dark, dry }); }
  return h + 40;
}

export async function routinePdf(rawRoutine, person, { contact } = {}) {
  const routine = normalizeRoutine(rawRoutine);
  const d = await Doc.create(RW, RH);
  for (let i = 0; i < routine.days.length; i += 2) {
    const pair = routine.days.slice(i, i + 2);
    d.page();
    await rutinaHeader(d, routine);
    const colW = RW / 2;
    let size = 15;
    for (; size > 9; size -= 0.5) if (pair.every((day) => 290 + dayColumn(d, day, 0, colW, true, size) < RH - 70)) break;
    for (const [k, day] of pair.entries()) {
      const x = k * colW;
      const h = dayColumn(d, day, x, colW, true, size);
      d.roundRect(x + 18, 290, colW - 36, Math.min(h, RH - 360), 22, C.white, 0.95);
      dayColumn(d, day, x, colW, false, size);
    }
    rutinaFooter(d, contact);
  }
  if (routine.notes) {
    d.page(); await rutinaHeader(d, routine);
    d.roundRect(60, 230, RW - 120, 900, 24, C.white, 0.95);
    d.text('INDICACIONES', 60, 270, { font: d.bold, size: 30, color: C.dark, align: 'center', w: RW - 120 });
    d.para(routine.notes, 100, 340, RW - 200, { font: d.reg, size: 18, color: C.dark, lh: 1.45 });
    rutinaFooter(d, contact);
  }
  await d.staticPage(STATIC_PAGES.rutinaIndicaciones);
  await d.staticPage(STATIC_PAGES.rutinaConceptos1);
  await d.staticPage(STATIC_PAGES.rutinaConceptos2);
  return d.save(`Plan de entrenamiento - ${fullName(person)}.pdf`);
}

export { SUPP_MAP };

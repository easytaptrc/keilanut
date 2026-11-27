// Cálculo energético de la consulta, con el método de los Excel de Keila (GET HOMBRES / GET MUJERES y cuadro
// dietosintético) más fórmulas alternativas. Todo es configurable desde Ajustes → Cálculo energético.
import { ACTIVITY, ageFrom, bmi } from './utils';

export const FORMULAS = {
  harris: 'Harris-Benedict (tu Excel)',
  mifflin: 'Mifflin-St Jeor',
  katch: 'Katch-McArdle (usa masa magra)',
  fao: 'FAO/OMS',
};
export const GET_METHODS = {
  eta_af: 'GEB + ETA + actividad (%)',
  mets: 'GEB + ETA + actividad por METs',
  factor: 'GEB × factor de actividad',
};

// Cuadro de equivalentes (SMAE), igual que en los Excel: energía, proteína, lípidos e hidratos por equivalente
export const DEFAULT_EXCHANGES = [
  { key: 'ver', group: 'Verduras', sub: '', kcal: 25, p: 2, f: 0, c: 4 },
  { key: 'fru', group: 'Frutas', sub: '', kcal: 60, p: 0, f: 0, c: 15 },
  { key: 'cer_sg', group: 'Cereales y tubérculos', sub: 'sin grasa', kcal: 70, p: 2, f: 0, c: 15 },
  { key: 'cer_cg', group: 'Cereales y tubérculos', sub: 'con grasa', kcal: 115, p: 2, f: 5, c: 15 },
  { key: 'leg', group: 'Leguminosas', sub: '', kcal: 120, p: 8, f: 1, c: 20 },
  { key: 'aoa_mb', group: 'Origen animal', sub: 'muy bajo aporte de grasa', kcal: 40, p: 7, f: 1, c: 0 },
  { key: 'aoa_b', group: 'Origen animal', sub: 'bajo aporte de grasa', kcal: 55, p: 7, f: 3, c: 0 },
  { key: 'aoa_m', group: 'Origen animal', sub: 'moderado aporte de grasa', kcal: 75, p: 7, f: 5, c: 0 },
  { key: 'aoa_a', group: 'Origen animal', sub: 'alto aporte de grasa', kcal: 100, p: 7, f: 8, c: 0 },
  { key: 'lec_d', group: 'Leche', sub: 'descremada', kcal: 95, p: 9, f: 2, c: 12 },
  { key: 'lec_s', group: 'Leche', sub: 'semidescremada', kcal: 110, p: 9, f: 4, c: 12 },
  { key: 'lec_e', group: 'Leche', sub: 'entera', kcal: 150, p: 9, f: 8, c: 12 },
  { key: 'lec_a', group: 'Leche', sub: 'con azúcar', kcal: 200, p: 8, f: 5, c: 30 },
  { key: 'ag_sp', group: 'Aceites y grasas', sub: 'sin proteína', kcal: 45, p: 0, f: 5, c: 0 },
  { key: 'ag_cp', group: 'Aceites y grasas', sub: 'con proteína', kcal: 70, p: 3, f: 5, c: 3 },
  { key: 'az_sg', group: 'Azúcares', sub: 'sin grasa', kcal: 40, p: 0, f: 0, c: 10 },
  { key: 'az_cg', group: 'Azúcares', sub: 'con grasa', kcal: 85, p: 0, f: 5, c: 10 },
];

export const DEFAULT_METS = [
  { name: 'Pesas / hipertrofia', met: 5 },
  { name: 'Caminata moderada', met: 3.5 },
  { name: 'Caminata rápida / inclinada', met: 5 },
  { name: 'Trote / correr (8 km/h)', met: 8.3 },
  { name: 'Elíptica', met: 5 },
  { name: 'Bicicleta estática moderada', met: 6.8 },
  { name: 'Spinning / HIIT', met: 8.5 },
  { name: 'CrossFit / funcional', met: 8 },
  { name: 'Natación', met: 6 },
  { name: 'Baile / zumba', met: 6.5 },
  { name: 'Fútbol', met: 7 },
  { name: 'Yoga / pilates', met: 3 },
];

export const DEFAULT_ENERGY = {
  formula: 'harris',
  method: 'eta_af',
  etaPct: 10,
  afPct: 10,
  // Ajuste de calorías según el objetivo (% sobre el GET)
  goalAdjust: { perder_grasa: -15, ganar_musculo: 10, recomposicion: -5, salud: 0, rendimiento: 5, habitos: 0, mantener: 0, embarazo: 0, otro: 0 },
  // Gramos por kg de peso (como la columna FACTOR del Excel); los lípidos son lo que resta
  macros: {
    perder_grasa: { p: 2, c: 2.5 }, ganar_musculo: { p: 2, c: 4.5 }, recomposicion: { p: 2.2, c: 3 }, salud: { p: 1.6, c: 3 },
    rendimiento: { p: 1.8, c: 5 }, habitos: { p: 1.6, c: 3 }, mantener: { p: 1.6, c: 3.5 }, embarazo: { p: 1.3, c: 3.5 }, otro: { p: 1.6, c: 3 },
  },
  waterMlPerKg: 35,
  // Con IMC desde este valor, los g/kg se calculan con peso ajustado (0 = usar siempre el peso real)
  adjustedWeightBmi: 30,
  minKcalWomen: 1200,
  minKcalMen: 1500,
  mets: DEFAULT_METS,
  exchanges: DEFAULT_EXCHANGES,
  meals: ['Desayuno', 'Colación mañana', 'Comida', 'Colación tarde', 'Cena'],
};
export function mergeEnergy(e) {
  const d = JSON.parse(JSON.stringify(DEFAULT_ENERGY));
  if (!e) return d;
  return {
    ...d, ...e,
    goalAdjust: { ...d.goalAdjust, ...(e.goalAdjust || {}) },
    macros: Object.fromEntries(Object.keys({ ...d.macros, ...(e.macros || {}) }).map((k) => [k, { ...(d.macros[k] || d.macros.otro), ...(e.macros?.[k] || {}) }])),
    mets: e.mets?.length ? e.mets : d.mets,
    exchanges: e.exchanges?.length ? e.exchanges : d.exchanges,
    meals: e.meals?.length ? e.meals : d.meals,
  };
}

const n = (v) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : null; };
/** Número que acepta coma decimal, negativos y cero; '' o inválido → valor por defecto */
const num = (v, d) => { if (v === '' || v == null) return d; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : d; };
const numZ = (v) => { if (v === '' || v == null) return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) && x >= 0 ? x : null; };
const r = (x, d = 0) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

/** Datos base de la persona (de la báscula si existen; si no, del expediente) */
export function personData(member = {}, clinical = null, overrides = {}) {
  const body = clinical?.body || {};
  const sex = overrides.sex || member.sex || '';
  return {
    sex,
    age: n(overrides.age) ?? ageFrom(member.birthDate),
    weight: n(overrides.weight) ?? n(body.weightKg) ?? n(member.weightKg),
    height: n(overrides.height) ?? n(body.heightCm) ?? n(member.heightCm),
    bodyFat: (() => { const b = n(overrides.bodyFat) ?? n(body.bodyFat); return b && b >= 3 && b <= 70 ? b : null; })(),
    fatKg: n(body.fatKg),
  };
}

/** Gasto energético basal con cada fórmula */
export function geb(formula, { sex, age, weight, height, bodyFat, fatKg }) {
  const male = sex === 'masculino';
  if (!weight) return null;
  // Sin sexo registrado no se calcula (evita aplicar la fórmula de mujeres por error)
  if (formula !== 'katch' && sex !== 'masculino' && sex !== 'femenino') return null;
  switch (formula) {
    case 'harris':
      if (!height || age == null) return null;
      return male ? 66.5 + 13.75 * weight + 5.003 * height - 6.775 * age : 655.1 + 9.563 * weight + 1.85 * height - 4.676 * age;
    case 'mifflin':
      if (!height || age == null) return null;
      return 10 * weight + 6.25 * height - 5 * age + (male ? 5 : -161);
    case 'katch': {
      const lean = bodyFat ? weight * (1 - bodyFat / 100) : fatKg && fatKg < weight * 0.7 ? weight - fatKg : null;
      return lean && lean > 15 ? 370 + 21.6 * lean : null;
    }
    case 'fao': {
      if (age == null) return null;
      const t = male
        ? [[3, 60.9, -54], [10, 22.7, 495], [18, 17.5, 651], [30, 15.3, 679], [60, 11.6, 879], [200, 13.5, 487]]
        : [[3, 61, -51], [10, 22.5, 499], [18, 12.2, 746], [30, 14.7, 496], [60, 8.7, 829], [200, 10.5, 596]];
      const [, a, b] = t.find(([max]) => age < max) || t[t.length - 1];
      return a * weight + b;
    }
    default: return null;
  }
}

/** kcal de una actividad por METs (igual que el Excel: MET × 0.0175 × peso × minutos) */
export const metKcal = (met, weight, minutes) => (n(met) && n(weight) && n(minutes) ? n(met) * 0.0175 * n(weight) * n(minutes) : 0);

/**
 * Cálculo completo.
 * input: { formula, method, etaPct, afPct, activityLevel, activities:[{met, minutes, days}], goal, adjustPct, vctOverride, pKg, cKg }
 */
export function computeEnergy(person, input, cfg = DEFAULT_ENERGY) {
  const all = Object.fromEntries(Object.keys(FORMULAS).map((k) => [k, r(geb(k, person))]));
  const base = geb(input.formula || cfg.formula, person);
  if (!base) return { ok: false, all, missing: missingData(person, input.formula || cfg.formula) };
  const eta = base * num(input.etaPct, num(cfg.etaPct, 10)) / 100;
  let af = 0, getTrain = null, getAvg = null;
  const method = input.method || cfg.method;
  if (method === 'factor') {
    const factor = ACTIVITY[input.activityLevel]?.factor || 1.375;
    getAvg = base * factor;
    af = getAvg - base - eta;
  } else if (method === 'mets') {
    const acts = (input.activities || []).map((a) => ({ ...a, kcal: metKcal(a.met, person.weight, a.minutes) }));
    const perSession = acts.reduce((s, a) => s + a.kcal, 0);
    const weekly = acts.reduce((s, a) => s + a.kcal * Math.min(7, num(a.days, 0)), 0);
    getTrain = base + eta + perSession;
    af = weekly / 7;
    getAvg = base + eta + af;
  } else {
    af = base * num(input.afPct, num(cfg.afPct, 10)) / 100;
    getAvg = base + eta + af;
  }
  const adjust = Math.max(-50, Math.min(50, num(input.adjustPct, num(cfg.goalAdjust[input.goal], 0))));
  const min = person.sex === 'masculino' ? cfg.minKcalMen : cfg.minKcalWomen;
  const suggested = Math.max(min, Math.round((getAvg * (1 + adjust / 100)) / 10) * 10);
  const vct = n(input.vctOverride) || suggested;
  // Macronutrientes: proteína e hidratos por g/kg, lípidos el resto (como el Excel)
  const m = cfg.macros[input.goal] || cfg.macros.otro;
  const pKg = numZ(input.pKg) ?? m.p, cKg = numZ(input.cKg) ?? m.c;
  // Peso para los g/kg: real, o ajustado en obesidad (ideal + 25% del exceso)
  const imc = bmi(person.weight, person.height);
  const useAdj = cfg.adjustedWeightBmi > 0 && imc && imc >= cfg.adjustedWeightBmi && input.useRealWeight !== true;
  const ideal = person.height ? 22 * (person.height / 100) ** 2 : null;
  const refW = useAdj && ideal ? ideal + 0.25 * (person.weight - ideal) : person.weight;
  const pG = pKg * refW, cG = cKg * refW;
  const fKcal = vct - pG * 4 - cG * 4;
  const fG = fKcal / 9;
  const macros = {
    p: { g: r(pG), kcal: r(pG * 4), pct: r((pG * 4 * 100) / vct, 1), gkg: r(pKg, 2) },
    c: { g: r(cG), kcal: r(cG * 4), pct: r((cG * 4 * 100) / vct, 1), gkg: r(cKg, 2) },
    f: { g: r(fG), kcal: r(fKcal), pct: r((fKcal * 100) / vct, 1), gkg: r(fG / refW, 2) },
  };
  const warnings = [];
  if (fKcal < 0) warnings.push('La proteína y los hidratos ya superan las calorías: baja los g/kg o sube las calorías.');
  else if (macros.f.pct < 20) warnings.push(`Los lípidos quedan en ${macros.f.pct}% (menos de 20%). Considera bajar hidratos o proteína.`);
  else if (macros.f.pct > 35) warnings.push(`Los lípidos quedan en ${macros.f.pct}% (más de 35%). Considera subir hidratos o proteína.`);
  if (adjust <= -25) warnings.push(`El déficit de ${Math.abs(adjust)}% es agresivo; vigila adherencia y masa muscular.`);
  if (suggested === min && getAvg * (1 + adjust / 100) < min) warnings.push(`Se aplicó el mínimo de ${min} kcal.`);
  return {
    ok: true, all, geb: r(base), eta: r(eta), af: r(af), get: r(getAvg), getTrain: r(getTrain), adjust, suggested, vct: r(vct), macros, warnings,
    water: r((person.weight * (cfg.waterMlPerKg || 35)) / 1000, 1),
    bmi: imc, refWeight: r(refW, 1), adjustedWeight: !!useAdj, idealWeight: r(ideal, 1),
  };
}

function missingData(p, formula) {
  const out = [];
  if (!p.weight) out.push('peso');
  if (formula !== 'katch' && !p.height) out.push('estatura');
  if (formula !== 'katch' && p.age == null) out.push('edad (fecha de nacimiento)');
  if (formula === 'katch' && !p.bodyFat && !p.fatKg) out.push('% de grasa');
  if (!p.sex) out.push('sexo');
  return out;
}

/** Cuadro dietosintético: totales de los equivalentes y % de adecuación contra la meta */
export function exchangeTotals(counts, exchanges, target) {
  const t = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const ex of exchanges) {
    const q = Number(counts?.[ex.key]) || 0;
    t.kcal += q * ex.kcal; t.p += q * ex.p; t.f += q * ex.f; t.c += q * ex.c;
  }
  const pct = (a, b) => (b > 0 ? r((a / b) * 100) : null);
  return { ...t, adequacy: target ? { kcal: pct(t.kcal, target.vct), p: pct(t.p, target.macros.p.g), f: pct(t.f, target.macros.f.g), c: pct(t.c, target.macros.c.g) } : null };
}
export const adequacyTone = (v) => (v == null ? '' : v >= 90 && v <= 110 ? 'ok' : v >= 80 && v <= 120 ? 'warn' : 'danger');

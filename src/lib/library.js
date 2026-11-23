// Biblioteca de planes base de Keila: los 8 planes incluidos en la app + los que ella guarde desde el panel.
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ageFrom } from './utils';
import { clinicalText } from '../data/clinical';
import { normalizeDiet } from './plans';

/** Planes incluidos (se cargan bajo demanda para no hacer pesada la app) */
export const loadBuiltInLibrary = () => import('../data/planLibrary').then((m) => m.PLAN_LIBRARY);

export const SEX_LABEL = { hombre: 'Hombre', mujer: 'Mujer' };
export const ACTIVITY_LABEL = { ligera: 'Actividad ligera', 'ligera-moderada': 'Actividad ligera-moderada', moderada: 'Actividad moderada', alta: 'Actividad alta' };
const ACT_ORDER = ['sedentaria', 'ligera', 'ligera-moderada', 'moderada', 'alta', 'muy_alta'];

const range = (min, max, unit = '') => (min != null && max != null ? `${min}–${max}${unit}` : min != null ? `${min}+${unit}` : max != null ? `hasta ${max}${unit}` : '');

/** Etiquetas legibles de un plan de la biblioteca */
export function libraryTags(t = {}) {
  return [
    SEX_LABEL[t.sex],
    range(t.ageMin, t.ageMax, ' años'),
    range(t.weightMin, t.weightMax, ' kg'),
    range(t.heightMin, t.heightMax, ' cm'),
    ACTIVITY_LABEL[t.activity],
    ...(t.conditions || []).map((c) => c[0].toUpperCase() + c.slice(1)),
    t.fasting && 'Ayuno 16 h',
    t.mealsPerDay && `${t.mealsPerDay} tiempos de comida`,
  ].filter(Boolean);
}

/** Qué tan bien se ajusta un plan base al paciente (más alto = mejor) y por qué */
export function matchScore(entry, member = {}, clinical = null) {
  const t = entry.tags || {};
  let score = 0;
  const why = [];
  const sex = member.sex === 'masculino' ? 'hombre' : member.sex === 'femenino' ? 'mujer' : '';
  if (sex && t.sex) { if (sex === t.sex) { score += 3; why.push(SEX_LABEL[t.sex]); } else score -= 6; }
  if (member.goal && t.goal) {
    if (member.goal === t.goal) { score += 4; why.push('mismo objetivo'); }
    else if (['perder_grasa', 'recomposicion'].includes(member.goal) && ['perder_grasa', 'recomposicion'].includes(t.goal)) score += 1.5;
  }
  const age = ageFrom(member.birthDate);
  if (age != null && (t.ageMin != null || t.ageMax != null)) {
    const lo = t.ageMin ?? 0, hi = t.ageMax ?? 120;
    if (age >= lo && age <= hi) { score += 2; why.push(`${age} años`); } else if (age >= lo - 5 && age <= hi + 5) score += 1; else score -= 1;
  }
  const w = Number(member.weightKg) || Number(clinical?.body?.weight) || null;
  if (w && (t.weightMin != null || t.weightMax != null)) {
    const lo = t.weightMin ?? 0, hi = t.weightMax ?? 400;
    if (w >= lo && w <= hi) { score += 2; why.push(`${w} kg`); } else if (w >= lo - 10 && w <= hi + 10) score += 0.5; else score -= 1;
  }
  const h = Number(member.heightCm) || Number(clinical?.body?.height) || null;
  if (h && (t.heightMin != null || t.heightMax != null)) {
    const lo = t.heightMin ?? 0, hi = t.heightMax ?? 250;
    if (h >= lo && h <= hi) { score += 1; why.push(`${h} cm`); }
  }
  const health = `${member.diseases || ''} ${member.reason || ''} ${clinicalText(clinical) || ''}`.toLowerCase();
  for (const c of t.conditions || []) {
    if (health.includes(c.toLowerCase())) { score += 5; why.push(c); } else score -= 1;
  }
  if (t.activity && member.activityLevel) {
    const a = ACT_ORDER.indexOf(member.activityLevel), b = ACT_ORDER.indexOf(t.activity);
    if (a >= 0 && b >= 0) score += Math.abs(a - b) <= 1 ? 1 : 0;
  }
  const meals = Number(member.mealsPerDay);
  if (meals && t.mealsPerDay) score += Math.abs(meals - t.mealsPerDay) <= 1 ? 1 : 0;
  if (t.fasting && meals && meals <= 3) { score += 1.5; why.push('pocas comidas'); }
  return { score, why };
}

export function rankLibrary(list, member, clinical) {
  return list.map((e) => ({ ...e, match: matchScore(e, member, clinical) })).sort((a, b) => b.match.score - a.match.score);
}

/** Copia del plan base lista para editar (sin fechas de check del original) */
export function planFromLibrary(entry) {
  const p = normalizeDiet(structuredClone(entry.plan));
  return { ...p, goal: p.goal && p.goal.length < 20 ? p.goal : entry.tags?.goal || '', checkFrom: '', checkTo: '', nextChange: '', baseId: entry.id, baseTitle: entry.title };
}

/** Guarda un plan como base reutilizable (colección privada de la administradora) */
export async function saveToLibrary({ title, description, tags, plan }) {
  const clean = { ...plan };
  delete clean.checkFrom; delete clean.checkTo; delete clean.nextChange;
  const ref = await addDoc(collection(db, 'planLibrary'), { title, description: description || '', tags: tags || {}, plan: clean, createdAt: serverTimestamp() });
  return ref.id;
}
export const deleteFromLibrary = (id) => deleteDoc(doc(db, 'planLibrary', id));

/** Etiquetas que describen a un paciente (para guardar su plan como base) */
export function tagsFromMember(m = {}) {
  const age = ageFrom(m.birthDate);
  return {
    goal: m.goal || '', sex: m.sex === 'masculino' ? 'hombre' : m.sex === 'femenino' ? 'mujer' : '',
    ageMin: age != null ? Math.max(15, age - 5) : null, ageMax: age != null ? age + 5 : null,
    weightMin: m.weightKg ? Math.round(m.weightKg - 8) : null, weightMax: m.weightKg ? Math.round(Number(m.weightKg) + 8) : null,
    heightMin: null, heightMax: null, activity: m.activityLevel || null, conditions: [], fasting: false,
    mealsPerDay: Number(m.mealsPerDay) || null, format: 'dias',
  };
}

/** Texto compacto de un plan base para dárselo a la IA como referencia */
export function libraryPlanText(entry) {
  const p = entry.plan || {};
  const out = [`PLAN BASE: ${entry.title}`, `Para: ${entry.description || ''}`, `Etiquetas: ${libraryTags(entry.tags).join(', ')}`];
  if (p.dailyTip?.text) out.push(`Inicia tu día con: ${p.dailyTip.text}`);
  if (p.supplements?.length) out.push('Suplementos: ' + p.supplements.map((s) => `${s.name} (${s.when}; ${s.dose})`).join(' | '));
  if (p.waterLiters) out.push(`Agua: ${p.waterLiters} L`);
  for (const d of p.days || []) {
    out.push(`\n== ${d.day} ==${d.tip?.text ? `\nTip: ${d.tip.text}` : ''}`);
    for (const m of d.meals || []) {
      out.push(`${m.slot}${m.time ? ' ' + m.time : ''} — ${m.title || ''}${m.photo ? ` [foto: ${m.photo}]` : ''}`);
      for (const s of m.sections || []) out.push(`  ${s.label}: ${(s.items || []).join('; ')}`);
    }
    if (d.note) out.push(`Nota: ${d.note}`);
  }
  if (p.equivalents?.length) out.push('\nEQUIVALENTES: ' + p.equivalents.map((g) => `${g.group} (${g.portion}): ${(g.items || []).join(', ')}`).join(' || '));
  if (p.instructions?.length) out.push('\nInstrucciones: ' + p.instructions.join(' | '));
  if (p.recommendations?.length) out.push('Recomendaciones: ' + p.recommendations.join(' | '));
  if (p.notes) out.push('Notas: ' + p.notes);
  return out.join('\n');
}

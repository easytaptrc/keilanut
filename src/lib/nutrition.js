// Cálculos nutricionales de referencia (Mifflin-St Jeor). Los borradores están en lib/plans.js.
import { ACTIVITY, ageFrom, bmi } from './utils';

export function energy(p) {
  const w = Number(p.weightKg), h = Number(p.heightCm), a = ageFrom(p.birthDate) || 30;
  if (!w || !h) return null;
  const male = p.sex === 'masculino';
  const bmr = 10 * w + 6.25 * h - 5 * a + (male ? 5 : -161);
  const factor = ACTIVITY[p.activityLevel]?.factor || 1.375;
  const tdee = bmr * factor;
  const adj = {
    perder_grasa: -0.2, ganar_musculo: 0.1, recomposicion: -0.1, mantener: 0, rendimiento: 0.05,
    salud: (bmi(w, h) || 0) > 27 ? -0.15 : 0, embarazo: 0.12,
  }[p.goal] ?? 0;
  let kcal = Math.round((tdee * (1 + adj)) / 10) * 10;
  kcal = Math.max(kcal, male ? 1500 : 1200);
  const protPerKg = { perder_grasa: 1.9, ganar_musculo: 1.9, recomposicion: 2.0, rendimiento: 1.7, embarazo: 1.3 }[p.goal] || 1.5;
  // Para obesidad usamos peso ajustado para la proteína
  const refW = (bmi(w, h) || 0) > 30 ? (22 * (h / 100) ** 2 + 0.25 * (w - 22 * (h / 100) ** 2)) : w;
  const protein = Math.round(refW * protPerKg);
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(50, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const water = Math.round((w * 0.035 + (['alta', 'muy_alta', 'moderada'].includes(p.activityLevel) ? 0.5 : 0)) * 10) / 10;
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, carbs, fat, water };
}

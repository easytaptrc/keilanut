// Cálculos nutricionales y generadores de borradores (sin IA). La IA (lib/ai.js) los mejora.
import { ACTIVITY, ageFrom, bmi } from './utils';
import { EXERCISES } from '../data/exercises';

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

// --- Banco de alimentos (porciones de referencia, cocina mexicana) ---
const F = (food, qty, tags = []) => ({ food, qty, tags });
const BANK = {
  desayuno: [
    [F('Huevo entero a la mexicana', '2 piezas', ['huevo']), F('Claras de huevo', '3 piezas', ['huevo']), F('Tortilla de maíz', '2 piezas'), F('Frijoles de la olla', '1/2 taza'), F('Papaya picada', '1 taza')],
    [F('Avena en hojuelas', '1/2 taza', ['gluten']), F('Leche descremada o vegetal', '1 taza', ['lacteo']), F('Proteína en polvo o yogur griego', '1 scoop / 150 g', ['lacteo']), F('Plátano', '1/2 pieza'), F('Crema de cacahuate', '1 cda', ['nuez'])],
    [F('Pan integral', '2 rebanadas', ['gluten']), F('Pechuga de pavo', '3 rebanadas'), F('Queso panela', '40 g', ['lacteo']), F('Aguacate', '1/4 pieza'), F('Fresas', '1 taza')],
  ],
  colacion: [
    [F('Yogur griego natural', '150 g', ['lacteo']), F('Frutos rojos', '1/2 taza'), F('Almendras', '10 piezas', ['nuez'])],
    [F('Manzana', '1 pieza'), F('Queso cottage', '1/2 taza', ['lacteo'])],
    [F('Jícama, pepino y zanahoria con limón', '1 taza'), F('Atún en agua', '1/2 lata', ['pescado']), F('Tostadas horneadas', '2 piezas')],
    [F('Pera', '1 pieza'), F('Nueces', '5 mitades', ['nuez'])],
  ],
  comida: [
    [F('Pechuga de pollo a la plancha', '150 g'), F('Arroz integral', '1/2 taza cocido'), F('Ensalada de verduras', '2 tazas'), F('Aceite de oliva', '1 cdita'), F('Agua de jamaica sin azúcar', '1 vaso')],
    [F('Filete de pescado al ajillo', '170 g', ['pescado']), F('Papa cocida', '1 pieza mediana'), F('Verduras al vapor', '1.5 tazas'), F('Aguacate', '1/4 pieza')],
    [F('Bistec de res magro', '140 g'), F('Frijoles', '1/2 taza'), F('Tortilla de maíz', '2 piezas'), F('Nopales asados', '1 taza'), F('Pico de gallo', 'al gusto')],
  ],
  cena: [
    [F('Tacos de pollo deshebrado en tortilla de maíz', '2 piezas'), F('Lechuga, jitomate y cebolla', '1 taza'), F('Salsa verde', 'al gusto')],
    [F('Omelette de claras con espinaca y champiñones', '4 claras', ['huevo']), F('Pan integral', '1 rebanada', ['gluten']), F('Aguacate', '1/4 pieza')],
    [F('Ensalada con atún', '1 lata', ['pescado']), F('Galletas habaneras integrales', '4 piezas', ['gluten']), F('Pepino y jitomate', '1 taza')],
  ],
};

const ALLERGY_KEYS = {
  huevo: ['huevo'], lacteo: ['leche', 'lácteo', 'lacteo', 'lactosa', 'queso', 'yogur'], gluten: ['gluten', 'trigo', 'celiac', 'celíac'],
  nuez: ['nuez', 'nueces', 'cacahuate', 'maní', 'almendra', 'frutos secos'], pescado: ['pescado', 'marisco', 'atún', 'atun', 'camarón'],
};

function blockedTags(p) {
  const txt = `${p.allergies || ''} ${p.intolerances || ''} ${p.foodDislikes || ''}`.toLowerCase();
  return Object.entries(ALLERGY_KEYS).filter(([, ks]) => ks.some((k) => txt.includes(k))).map(([t]) => t);
}

function pickOption(list, blocked, seed) {
  const ok = list.filter((opt) => opt.every((i) => !i.tags.some((t) => blocked.includes(t))));
  const pool = ok.length ? ok : list.map((opt) => opt.filter((i) => !i.tags.some((t) => blocked.includes(t))));
  return pool[seed % pool.length].map(({ food, qty }) => ({ food, qty }));
}

const MEAL_LAYOUT = {
  3: [['Desayuno', 'desayuno', '08:00'], ['Comida', 'comida', '14:00'], ['Cena', 'cena', '20:00']],
  4: [['Desayuno', 'desayuno', '08:00'], ['Colación', 'colacion', '11:30'], ['Comida', 'comida', '14:30'], ['Cena', 'cena', '20:00']],
  5: [['Desayuno', 'desayuno', '07:30'], ['Colación AM', 'colacion', '10:30'], ['Comida', 'comida', '14:00'], ['Colación PM', 'colacion', '17:30'], ['Cena', 'cena', '20:30']],
  6: [['Desayuno', 'desayuno', '07:00'], ['Colación 1', 'colacion', '10:00'], ['Comida', 'comida', '13:30'], ['Colación 2', 'colacion', '16:30'], ['Cena', 'cena', '19:30'], ['Colación nocturna', 'colacion', '21:30']],
};

export function draftDiet(p) {
  const e = energy(p) || { kcal: 1800, protein: 120, carbs: 190, fat: 55, water: 2.5 };
  const n = Math.min(6, Math.max(3, Number(p.mealsPerDay) || 4));
  const blocked = blockedTags(p);
  const meals = MEAL_LAYOUT[n].map(([name, type, time], i) => ({
    name, time, items: pickOption(BANK[type], blocked, i + (p.firstName?.length || 0)),
    notes: type === 'comida' ? 'Puedes intercambiar la proteína por otra magra en la misma cantidad.' : '',
  }));
  const recs = [
    `Toma ${e.water} L de agua al día.`,
    'Come verduras en al menos 2 comidas al día.',
    'Evita bebidas azucaradas y alimentos ultraprocesados.',
    'Respeta tus horarios de comida lo más posible.',
  ];
  if (p.diseases && /diabet/i.test(p.diseases)) recs.push('Prioriza carbohidratos integrales y combínalos siempre con proteína y fibra.');
  if (p.diseases && /hipertens|presi/i.test(p.diseases)) recs.push('Reduce la sal: evita embutidos, enlatados y consomés en polvo.');
  return {
    title: 'Plan de alimentación personalizado',
    goal: p.goal || 'mantener',
    calories: e.kcal,
    macros: { protein: e.protein, carbs: e.carbs, fat: e.fat },
    waterLiters: e.water,
    meals,
    recommendations: recs,
    avoid: [p.allergies, p.intolerances].filter(Boolean),
    notes: 'Borrador generado automáticamente. Revísalo y ajústalo antes de publicarlo.',
  };
}

// --- Rutinas ---
const byGroup = (g) => EXERCISES.filter((e) => e.group === g);
const pickN = (g, n, seed = 0) => {
  const l = byGroup(g);
  return Array.from({ length: Math.min(n, l.length) }, (_, i) => l[(i * 2 + seed) % l.length]);
};

const SPLITS = {
  2: [['Cuerpo completo A', [['piernas', 2], ['pecho', 1], ['espalda', 2], ['hombros', 1], ['abdomen', 1]]],
      ['Cuerpo completo B', [['gluteos', 2], ['femoral', 1], ['pecho', 1], ['espalda', 1], ['triceps', 1], ['biceps', 1]]]],
  3: [['Cuerpo completo A', [['piernas', 2], ['pecho', 1], ['espalda', 1], ['hombros', 1], ['abdomen', 1]]],
      ['Cuerpo completo B', [['gluteos', 2], ['femoral', 1], ['espalda', 1], ['biceps', 1], ['abdomen', 1]]],
      ['Cuerpo completo C', [['piernas', 1], ['pecho', 1], ['hombros', 2], ['triceps', 1], ['pantorrilla', 1]]]],
  4: [['Tren superior A', [['pecho', 2], ['espalda', 2], ['hombros', 1], ['triceps', 1]]],
      ['Tren inferior A', [['piernas', 3], ['femoral', 1], ['pantorrilla', 1], ['abdomen', 1]]],
      ['Tren superior B', [['espalda', 2], ['hombros', 2], ['biceps', 1], ['pecho', 1]]],
      ['Tren inferior B (glúteo)', [['gluteos', 3], ['femoral', 2], ['abdomen', 1]]]],
  5: [['Pecho y tríceps', [['pecho', 4], ['triceps', 2]]],
      ['Espalda y bíceps', [['espalda', 4], ['biceps', 2]]],
      ['Piernas', [['piernas', 4], ['pantorrilla', 1], ['abdomen', 1]]],
      ['Hombros y abdomen', [['hombros', 4], ['abdomen', 2]]],
      ['Glúteos y femoral', [['gluteos', 3], ['femoral', 2]]]],
  6: [['Empuje A', [['pecho', 3], ['hombros', 2], ['triceps', 1]]],
      ['Jalón A', [['espalda', 4], ['biceps', 2]]],
      ['Pierna A', [['piernas', 4], ['pantorrilla', 1]]],
      ['Empuje B', [['hombros', 2], ['pecho', 2], ['triceps', 2]]],
      ['Jalón B', [['espalda', 3], ['biceps', 2], ['abdomen', 1]]],
      ['Pierna B (glúteo)', [['gluteos', 3], ['femoral', 2], ['abdomen', 1]]]],
};

export function draftRoutine(p) {
  const days = Math.min(6, Math.max(2, Number(p.trainingDays) || 4));
  const lose = ['perder_grasa', 'salud'].includes(p.goal);
  const gain = ['ganar_musculo', 'rendimiento'].includes(p.goal);
  const beginner = !p.trainingExperience || p.trainingExperience === 'principiante';
  const scheme = gain ? { sets: beginner ? 3 : 4, reps: '8-10', rest: '90 s' }
    : lose ? { sets: 3, reps: '12-15', rest: '45-60 s' } : { sets: 3, reps: '10-12', rest: '60 s' };
  return {
    title: 'Rutina personalizada',
    goal: p.goal || 'mantener',
    daysPerWeek: days,
    level: p.trainingExperience || 'principiante',
    warmup: '5–10 min de cardio ligero + movilidad articular.',
    cooldown: '5 min de estiramientos de los músculos trabajados.',
    days: SPLITS[days].map(([name, parts], di) => ({
      name: `Día ${di + 1} · ${name}`,
      focus: name,
      exercises: parts.flatMap(([g, n]) => pickN(g, n, di)).map((e) => ({
        exerciseId: e.id, name: e.name, sets: scheme.sets, reps: e.group === 'abdomen' && e.id.match(/Plank|Side_Bridge/) ? '30-45 s' : scheme.reps, rest: scheme.rest, notes: '',
      })),
      cardio: lose ? '20–30 min de cardio moderado al final (caminata inclinada o elíptica).' : '',
    })),
    notes: 'Borrador generado automáticamente. Ajusta cargas según técnica y sensaciones (RPE 7–8).',
  };
}

export const emptyDiet = () => ({ title: 'Plan de alimentación', goal: '', calories: '', macros: { protein: '', carbs: '', fat: '' }, waterLiters: '', meals: [], recommendations: [], avoid: [], notes: '' });
export const emptyRoutine = () => ({ title: 'Rutina', goal: '', daysPerWeek: 3, level: 'principiante', warmup: '', cooldown: '', days: [], notes: '' });

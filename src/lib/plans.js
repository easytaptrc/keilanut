// Modelo de planes (v2) con la misma estructura que los PDF de Keila, y borradores automáticos.
import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import { MAIN_SLOTS, WEEK_DAYS } from '../data/planAssets';
import { energy } from './nutrition';

const S = (label, items) => ({ label, items });

export const emptyDiet = () => ({
  version: 2, title: 'Plan de alimentación', goal: '', calories: '', macros: { protein: '', carbs: '', fat: '' }, waterLiters: '',
  checkFrom: '', checkTo: '', nextChange: '',
  dailyTip: { text: '', image: '' }, supplements: [], days: [], recommendations: [], avoid: [], notes: '',
});

export const emptyRoutine = () => ({
  version: 2, title: 'Plan de entrenamiento', goal: '', level: 'principiante', daysPerWeek: 4, schedule: '', notes: '', days: [],
});

/** Convierte planes antiguos (v1) al formato actual sin perder información. */
export function normalizeDiet(d) {
  if (!d) return null;
  if (d.version === 2) return { ...emptyDiet(), ...d };
  const out = { ...emptyDiet(), title: d.title || 'Plan de alimentación', goal: d.goal || '', calories: d.calories || '', macros: d.macros || emptyDiet().macros,
    waterLiters: d.waterLiters || '', recommendations: d.recommendations || [], avoid: d.avoid || [], notes: d.notes || '' };
  if (d.meals?.length) {
    out.days = [{ day: 'TODOS LOS DÍAS', tip: { text: '', image: '' }, meals: d.meals.map((m) => ({
      slot: String(m.name || '').toUpperCase(), title: '', photo: '', time: m.time || '',
      sections: [S('Utilizar', (m.items || []).map((i) => `${i.qty ? i.qty + ' de ' : ''}${i.food}`)), ...(m.notes ? [S('Notas', [m.notes])] : [])],
    })) }];
  }
  return out;
}

export function normalizeRoutine(r) {
  if (!r) return null;
  if (r.version === 2) return { ...emptyRoutine(), ...r };
  return {
    ...emptyRoutine(), title: r.title || 'Plan de entrenamiento', goal: r.goal || '', level: r.level || 'principiante', daysPerWeek: r.daysPerWeek || r.days?.length || 3,
    notes: [r.warmup && `Calentamiento: ${r.warmup}`, r.cooldown && `Enfriamiento: ${r.cooldown}`, r.notes].filter(Boolean).join('\n'),
    days: (r.days || []).map((d) => ({
      name: d.focus || d.name || 'Día', warmup: 'Estiramiento y calentamiento dinámico en la parte a trabajar.', cardio: d.cardio || '',
      blocks: (d.exercises || []).map((x) => ({
        kind: 'EJERCICIO SENCILLO', sets: Number(x.sets) || 3,
        exercises: [{ exerciseId: x.exerciseId || '', name: EXERCISE_MAP[x.exerciseId]?.name || x.name || '', detail: [x.reps && `${x.reps} repeticiones`, x.rest && `descanso ${x.rest}`, x.notes].filter(Boolean).join('. ') }],
      })),
    })),
  };
}

// ---------- Borrador automático de dieta (estilo de Keila) ----------
const DISHES = {
  ALMUERZO: [
    { title: 'HUEVO CON ESPINACAS', photo: 'huevo-espinacas', tags: ['huevo'], sections: [S('Utilizar', ['2 pzas de huevo entero revuelto con espinacas y cebollita al gusto']), S('Elige solo una opción para acompañar', ['Opción 1: 1 reb de pan integral tostado', 'Opción 2: 120 g de frijoles de la olla (1/4 tza)']), S('Toppings', ['1/3 pza de aguacate (30 g) y salpimentar un poco'])] },
    { title: 'HOT CAKES DE AVENA', photo: 'hotcakes-avena', tags: ['huevo', 'gluten', 'lacteo'], sections: [S('Licuar', ['1/4 tza de avena en hojuelas', '2 pzas de huevo entero', '2 cdas de queso cottage', '1/2 pza de plátano', 'Canela, vainilla y stevia al gusto', '1 cdita de polvo para hornear']), S('Toppings', ['1 cda de miel maple sin azúcar'])] },
    { title: 'TOSTADAS RANCHERAS CON HUEVO', photo: 'huevos-rancheros', tags: ['huevo'], sections: [S('Utilizar', ['2 pzas de huevo entero (revuelto o estrellado)', '2 tostadas horneadas', 'Salsa roja casera al gusto']), S('Toppings', ['1/3 pza de aguacate (30 g)'])] },
    { title: 'PAN CON AGUACATE Y HUEVO', photo: 'huevo-aguacate', tags: ['huevo', 'gluten'], sections: [S('Utilizar', ['1 reb de pan de hogaza tostado', '1/3 pza de aguacate (30 g)', '1 pza de huevo estrellado con aceite en aerosol']), S('Acompañar con', ['1 tza de papaya picada'])] },
    { title: 'OMELETTE CON FRIJOLES', photo: 'omelette-frijoles', tags: ['huevo'], sections: [S('Utilizar', ['2 pzas de huevo + 2 claras con espinaca', '1/4 tza de frijoles de la olla', '1/3 pza de aguacate (30 g)'])] },
  ],
  COMIDA: [
    { title: 'RAJAS POBLANAS CON POLLO', photo: 'rajas-pollo', tags: ['lacteo'], sections: [S('Utilizar', ['120 g de pechuga de pollo hervida y desmenuzada']), S('Para las rajas utilizar', ['1 pza de chile poblano en rajas', '1/4 de cebolla fileteada', '1/4 tza de elote desgranado', '30 g de queso oaxaca rallado']), S('Acompañar con', ['1 paquete de galletas saladas integrales'])] },
    { title: 'TACOS DE CARNE', photo: 'tacos-carne', tags: [], sections: [S('Utilizar', ['120 g de carne de res magra asada con cebolla fileteada', 'Verduras: pico de gallo']), S('Acompañar con', ['2 pzas de tortilla de maíz', '1/3 pza de aguacate (30 g)'])] },
    { title: 'CALDO DE POLLO CON VERDURAS', photo: 'caldo-pollo', tags: [], sections: [S('Utilizar', ['120 g de pechuga de pollo hervida', 'Verduras cocidas: zanahoria, calabacita, chayote y ejotes']), S('Elige solo una opción para acompañar', ['Opción 1: 1/2 tza de arroz', 'Opción 2: 2 pzas de tortilla de maíz'])] },
    { title: 'TACOS DE PESCADO', photo: 'tacos-pescado', tags: ['pescado'], sections: [S('Utilizar', ['150 g de filete de pescado a la plancha', 'Repollo, pico de gallo y limón']), S('Acompañar con', ['2 pzas de tortilla de maíz', '1/3 pza de aguacate (30 g)'])] },
    { title: 'BISTEC CON ARROZ Y VERDURAS', photo: 'bistec-arroz', tags: [], sections: [S('Utilizar', ['120 g de bistec de res a la plancha', '1/2 tza de arroz cocido', 'Verduras salteadas al gusto'])] },
  ],
  CENA: [
    { title: 'AVENA COCIDA CON MANZANA Y CANELA', photo: 'avena-manzana', tags: ['gluten', 'lacteo', 'nuez'], sections: [S('Cocer', ['40 g de avena en hojuelas', '3/4 tza de agua', 'Canela y stevia al gusto']), S('Dejar enfriar un poco y agregar al final', ['1 pza de manzana picada', '10 g de nueces', '1/2 tza de yogurt griego sin azúcar'])] },
    { title: 'PAN TOSTADO CON QUESO COTTAGE', photo: 'pan-cottage', tags: ['gluten', 'lacteo', 'nuez'], sections: [S('Utilizar', ['2 reb de pan integral tostado', '2 cdas de queso cottage c/u']), S('Agregar por encima', ['50 g de fresas', '10 g de nueces', '1 cdita de maple sin azúcar'])] },
    { title: 'ENSALADA DE POLLO', photo: 'ensalada-pollo', tags: [], sections: [S('Utilizar', ['100 g de pechuga de pollo a la plancha', 'Mix de lechugas, pepino y jitomate', '1/3 pza de aguacate (30 g)']), S('Acompañar con', ['1 paquete de galletas saladas integrales'])] },
    { title: 'ATÚN CON ZANAHORIA Y PEPINO', photo: 'atun-verduras', tags: ['pescado'], sections: [S('Utilizar', ['1 lata de atún en agua drenada', '1/4 tza de zanahoria rallada', '1/2 tza de pepino picado', 'Limón y sal al gusto']), S('Acompañar con', ['2 tostadas horneadas'])] },
  ],
  'SNACK OPCIONAL': [
    { title: 'FRUTA CON NUECES', photo: '', tags: ['nuez'], sections: [S('Utilizar', ['1 pza de naranja con tajín', '5 pzas de almendras'])] },
    { title: 'YOGURT CON FRUTOS ROJOS', photo: '', tags: ['lacteo'], sections: [S('Utilizar', ['1/2 tza de yogurt griego sin azúcar', '1/2 tza de frutos rojos'])] },
  ],
  'SNACK MEDIA TARDE': [
    { title: 'GELATINA CON FRUTA', photo: '', tags: [], sections: [S('Utilizar', ['1 tza de gelatina sin azúcar del sabor que quieras', '1/2 tza de fruta picada'])] },
    { title: 'JÍCAMA Y PEPINO', photo: '', tags: [], sections: [S('Utilizar', ['1 tza de jícama y pepino con limón y chile en polvo'])] },
  ],
};

const ALLERGY_KEYS = {
  huevo: ['huevo'], lacteo: ['leche', 'lácteo', 'lacteo', 'lactosa', 'queso', 'yogur'], gluten: ['gluten', 'trigo', 'celiac', 'celíac'],
  nuez: ['nuez', 'nueces', 'cacahuate', 'maní', 'almendra', 'frutos secos'], pescado: ['pescado', 'marisco', 'atún', 'atun', 'camarón'],
};
function blocked(p) {
  const txt = `${p.allergies || ''} ${p.intolerances || ''} ${p.foodDislikes || ''} ${p.clinical?.nutrition?.allergies || ''} ${p.clinical?.nutrition?.intolerances || ''}`.toLowerCase();
  return Object.entries(ALLERGY_KEYS).filter(([, ks]) => ks.some((k) => txt.includes(k))).map(([t]) => t);
}

export function slotsForMeals(n) {
  const c = Math.min(6, Math.max(3, Number(n) || 4));
  if (c === 3) return MAIN_SLOTS;
  if (c === 4) return ['ALMUERZO', 'COMIDA', 'SNACK MEDIA TARDE', 'CENA'];
  return ['ALMUERZO', 'SNACK OPCIONAL', 'COMIDA', 'SNACK MEDIA TARDE', 'CENA'];
}

export function draftDiet(p) {
  const e = energy(p) || { kcal: 1700, protein: 120, carbs: 170, fat: 55, water: 2.5 };
  const bl = blocked(p);
  const ok = (list) => { const f = list.filter((d) => !d.tags.some((t) => bl.includes(t))); return f.length ? f : list; };
  const slots = slotsForMeals(p.mealsPerDay);
  const days = WEEK_DAYS.map((day, i) => ({
    day, tip: { text: i === 3 ? 'Permitido solo 2 tazas de café de grano a la semana.' : '', image: i === 3 ? 'cafe' : '' },
    meals: slots.map((slot) => { const pool = ok(DISHES[slot]); const d = pool[i % pool.length]; return { slot, title: d.title, photo: d.photo, sections: structuredClone(d.sections) }; }),
  }));
  return {
    ...emptyDiet(),
    goal: p.goal || '', calories: e.kcal, macros: { protein: e.protein, carbs: e.carbs, fat: e.fat }, waterLiters: e.water,
    dailyTip: { text: 'Un shot de kéfir en ayunas (o una tableta de probióticos).', image: 'kefir' },
    supplements: [
      { key: 'kefir', name: 'Kéfir', when: 'En ayunas', dose: '1 vaso de agua + shot de kéfir' },
      { key: 'vitamina-d', name: 'Vitamina D3', when: 'Después del desayuno', dose: '1 tableta' },
      { key: 'omega3', name: 'Omega 3', when: 'Después del desayuno', dose: '1 cápsula' },
    ],
    days,
    recommendations: [
      'Cocina tus alimentos solo con aceite en aerosol.', `Toma de ${Math.max(2, e.water - 0.5)} a ${e.water + 0.5} litros de agua al día.`,
      'Acompaña tus comidas con salsas caseras; evita cremas, mayonesa y aderezos.', 'En fin de semana puedes repetir el día que más te haya gustado, respetando las porciones.',
    ],
    avoid: [p.allergies, p.intolerances].filter(Boolean),
    notes: 'Borrador automático: revísalo y ajústalo antes de publicarlo.',
  };
}

// ---------- Borrador automático de rutina ----------
const byGroup = (g) => EXERCISES.filter((e) => e.group === g);
const SPLITS = {
  2: [['CUERPO COMPLETO A', ['piernas', 'espalda', 'pecho', 'hombros', 'gluteos', 'abdomen']], ['CUERPO COMPLETO B', ['gluteos', 'femoral', 'espalda', 'pecho', 'triceps', 'biceps']]],
  3: [['TREN INFERIOR', ['piernas', 'piernas', 'femoral', 'gluteos', 'pantorrilla', 'abdomen']], ['PUSH / TRÍCEPS', ['pecho', 'pecho', 'hombros', 'hombros', 'triceps', 'triceps']], ['PULL / BÍCEPS', ['espalda', 'espalda', 'espalda', 'hombros', 'biceps', 'biceps']]],
  4: [['CUADRÍCEPS', ['piernas', 'piernas', 'piernas', 'piernas', 'pantorrilla', 'abdomen']], ['PULL / BÍCEPS', ['espalda', 'espalda', 'espalda', 'hombros', 'biceps', 'biceps']], ['GLÚTEO', ['gluteos', 'gluteos', 'gluteos', 'femoral', 'gluteos', 'abdomen']], ['PUSH / TRÍCEPS', ['pecho', 'pecho', 'hombros', 'hombros', 'triceps', 'triceps']]],
  5: [['CUADRÍCEPS', ['piernas', 'piernas', 'piernas', 'piernas', 'pantorrilla', 'abdomen']], ['PULL / BÍCEPS', ['espalda', 'espalda', 'espalda', 'hombros', 'biceps', 'biceps']], ['GLÚTEO', ['gluteos', 'gluteos', 'gluteos', 'gluteos', 'abdomen', 'abdomen']], ['PUSH / TRÍCEPS', ['pecho', 'pecho', 'hombros', 'hombros', 'triceps', 'triceps']], ['FEMORAL', ['femoral', 'femoral', 'femoral', 'gluteos', 'pantorrilla', 'abdomen']]],
  6: [['CUADRÍCEPS', ['piernas', 'piernas', 'piernas', 'piernas', 'pantorrilla', 'abdomen']], ['PULL / BÍCEPS', ['espalda', 'espalda', 'espalda', 'hombros', 'biceps', 'biceps']], ['GLÚTEO', ['gluteos', 'gluteos', 'gluteos', 'gluteos', 'abdomen', 'abdomen']], ['PUSH / TRÍCEPS', ['pecho', 'pecho', 'hombros', 'hombros', 'triceps', 'triceps']], ['FEMORAL', ['femoral', 'femoral', 'femoral', 'gluteos', 'pantorrilla', 'abdomen']], ['HOMBRO Y ABDOMEN', ['hombros', 'hombros', 'hombros', 'hombros', 'abdomen', 'abdomen']]],
};

export function draftRoutine(p) {
  const days = Math.min(6, Math.max(2, Number(p.trainingDays) || 4));
  const lose = ['perder_grasa', 'salud'].includes(p.goal);
  const used = {};
  const pick = (g) => { const l = byGroup(g); used[g] = (used[g] || 0) + 1; return l[(used[g] - 1) % l.length]; };
  const detail = (first) => first ? 'La primera serie es de aproximación (poco peso) 20 rep. Enfócate de 12 a 15 rep en 3 series exigentes.' : (lose ? 'Realiza 15 rep controladas.' : 'Realiza de 10 a 12 rep exigentes.');
  return {
    ...emptyRoutine(), goal: p.goal || '', level: p.trainingExperience || 'principiante', daysPerWeek: days,
    schedule: p.trainingSchedule || '',
    notes: 'Antes de iniciar cualquier ejercicio estira y realiza series de aproximación. El peso es de acuerdo a tu capacidad, cuidando siempre el rango de movimiento.',
    days: SPLITS[days].map(([name, groups]) => {
      const ex = groups.map(pick);
      const blocks = [];
      for (let i = 0; i < ex.length; i += 2) {
        const pair = ex.slice(i, i + 2);
        blocks.push({ kind: pair.length === 2 ? 'BI SERIE' : 'EJERCICIO SENCILLO', sets: i === 0 ? 4 : 3, exercises: pair.map((e, k) => ({ exerciseId: e.id, name: e.name, detail: detail(i === 0 && k === 0) })) });
      }
      return { name, warmup: 'Estiramiento y calentamiento dinámico en la parte a trabajar.', blocks, cardio: lose ? '20 a 30 min de caminadora inclinada o elíptica (FC 120 a 150).' : '' };
    }),
  };
}

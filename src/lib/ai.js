// Generación de dietas y rutinas con Claude (API de Anthropic), con el formato y estilo de los planes de Keila.
// La llave de API se guarda en Firestore (settings/admin), visible solo para la administradora.
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { readFileBase64 } from './files';
import { ACTIVITY, DEFAULT_MODEL, GOALS, ageFrom, bmi, bmiLabel } from './utils';
import { energy } from './nutrition';
import { EXERCISES } from '../data/exercises';
import { FOOD_PHOTOS, MEAL_SLOTS, SUPPLEMENTS, TIP_IMAGES, BLOCK_KINDS } from '../data/planAssets';
import { BODY_FIELDS, clinicalText } from '../data/clinical';
import { DIET_EXAMPLE, ROUTINE_EXAMPLE } from '../data/styleExamples';

export { DEFAULT_MODEL };

const str = { type: 'string' };
const num = { type: 'number' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const arr = (items) => ({ type: 'array', items });
const oneOf = (values) => ({ type: 'string', enum: values });

const DIET_SCHEMA = obj({
  title: str, goal: oneOf(Object.keys(GOALS)), calories: num,
  macros: obj({ protein: num, carbs: num, fat: num }),
  waterLiters: num,
  dailyTip: obj({ text: str, image: oneOf(['', ...TIP_IMAGES.map((t) => t.key)]) }),
  supplements: arr(obj({ key: oneOf(SUPPLEMENTS.map((s) => s.key)), name: str, when: str, dose: str })),
  days: arr(obj({
    day: str,
    tip: obj({ text: str, image: oneOf(['', ...TIP_IMAGES.map((t) => t.key)]) }),
    meals: arr(obj({ slot: oneOf(MEAL_SLOTS), time: str, title: str, photo: oneOf(['', ...FOOD_PHOTOS.map((p) => p.key)]), sections: arr(obj({ label: str, items: arr(str) })) })),
    note: str,
  })),
  equivalents: arr(obj({ group: str, portion: str, items: arr(str) })),
  instructions: arr(str), recommendations: arr(str), avoid: arr(str), notes: str, rationale: str,
});

const ROUTINE_SCHEMA = obj({
  title: str, goal: oneOf(Object.keys(GOALS)), level: oneOf(['principiante', 'intermedio', 'avanzado']), daysPerWeek: num, schedule: str, notes: str, rationale: str,
  days: arr(obj({
    name: str, warmup: str, cardio: str,
    blocks: arr(obj({ title: str, kind: oneOf(BLOCK_KINDS), sets: num, note: str, exercises: arr(obj({ exerciseId: oneOf([...EXERCISES.map((e) => e.id), 'custom']), name: str, detail: str })) })),
    extras: arr(obj({ title: str, items: arr(str) })),
  })),
});

const yn = (flag, detail) => (flag === 'si' ? `Sí: ${detail || 'sin detalle'}` : flag === 'no' ? 'No' : detail || 'no indicado');

export function profileSummary(p, { progress = [], clinical = null } = {}) {
  const e = energy(p);
  const age = ageFrom(p.birthDate);
  const b = bmi(p.weightKg, p.heightCm);
  const lines = [
    `Nombre: ${p.firstName || ''} (no uses el nombre completo en el plan)`,
    `Sexo: ${p.sex || 'no indicado'} · Edad: ${age ?? 'no indicada'} años`,
    `Estatura: ${p.heightCm || '?'} cm · Peso: ${p.weightKg || '?'} kg · IMC: ${b ?? '?'} (${bmiLabel(b)})`,
    p.goalWeight && `Peso meta: ${p.goalWeight} kg`,
    `Objetivo: ${GOALS[p.goal] || p.goal || 'no indicado'}${p.goalOther ? ` (${p.goalOther})` : ''}`,
    p.reason && `Motivo de consulta: ${p.reason}`,
    p.prevNutritionist && `¿Ha ido antes con nutriólogo?: ${p.prevNutritionist === 'si' ? 'Sí' : 'No'}`,
    `Actividad física diaria: ${ACTIVITY[p.activityLevel]?.label || 'no indicada'}`,
    `Enfermedades: ${yn(p.hasDisease, p.diseases)} · Medicamentos: ${yn(p.takesMeds, p.medications)}`,
    `Alergias/intolerancias: ${yn(p.hasAllergy, p.allergies)} · Lesiones/condiciones: ${yn(p.hasInjury, p.injuries)}`,
    p.mealsPerDay && `Comidas al día que mejor se adaptan: ${p.mealsPerDay}`,
    ...[...(p.extra || []), ...(p.bookingExtra || [])].filter((x) => x?.label && x?.value).map((x) => `${x.label}: ${x.value}`),
    p.trainingDays && `Días de entrenamiento por semana: ${p.trainingDays} · Experiencia: ${p.trainingExperience || '?'}`,
    e && `Referencia calculada (Mifflin-St Jeor): TMB ${e.bmr} kcal, GET ${e.tdee} kcal, sugerido ${e.kcal} kcal (P ${e.protein} g, C ${e.carbs} g, G ${e.fat} g), agua ${e.water} L`,
  ].filter(Boolean);
  if (clinical?.body) {
    const custom = clinical._bodyLabels || {};
    const fields = [...BODY_FIELDS, ...Object.keys(custom).filter((k) => !BODY_FIELDS.some((f) => f.key === k)).map((k) => { const [label, unit] = custom[k].split('|'); return { key: k, label, unit }; })]
      .map((f) => (custom[f.key] ? { ...f, label: custom[f.key].split('|')[0], unit: custom[f.key].split('|')[1] ?? f.unit } : f));
    const m = fields.filter((f) => clinical.body[f.key] != null && clinical.body[f.key] !== '').map((f) => `${f.label} ${clinical.body[f.key]}${f.unit ? ' ' + f.unit : ''}`);
    if (m.length) lines.push(`Báscula y medidas (${clinical.body.date || 'última consulta'}): ${m.join(', ')}`);
  }
  if (progress.length) {
    lines.push('Progreso reciente: ' + progress.slice(0, 6).map((x) => `${x.date}: ${x.weightKg ?? '?'} kg${x.bodyFat ? `, grasa ${x.bodyFat}%` : ''}${x.waistCm ? `, cintura ${x.waistCm} cm` : ''}`).join(' | '));
  }
  const ct = clinicalText(clinical);
  if (ct) lines.push('\nHISTORIAL CLÍNICO NUTRICIONAL (capturado por la nutrióloga):\n' + ct);
  return lines.join('\n');
}

const SYSTEM = `Eres el asistente clínico de la Lic. en Nutrición Keila Guerrero (México). Elaboras BORRADORES de planes que ella revisará y firmará.
Reglas:
- Respeta estrictamente alergias, intolerancias, diagnósticos, medicamentos, embarazo/lactancia, lesiones y trastornos de la conducta alimentaria. Si algo requiere supervisión médica, indícalo en "notes".
- Usa EXACTAMENTE el estilo de los planes de Keila: mismo tipo de platillos mexicanos caseros, porciones en piezas/tazas/cucharadas/gramos ("2pzas de huevo", "120gr de pechuga", "1/4tza", "1cdita"), secciones "Utilizar", "Elige solo una opción para acompañar" (Opción 1/Opción 2), "Toppings", "Acompañar con", nombres de platillo en MAYÚSCULAS, y tips del día (bebidas como agua de jamaica, café permitido, kéfir).
- PLANES BASE: si recibes documentos "Plan base de Keila", son planes reales suyos. Elige el que mejor se ajuste a la persona (o el que Keila indique) y úsalo como punto de partida: conserva su estructura (OPCIÓN 1/2/3, días o porciones), horarios ("time"), platillos, fotos, suplementos, instrucciones, recomendaciones y tabla de equivalentes; ajusta porciones, alimentos y suplementos a esta persona (peso, objetivo, alergias, condiciones, horarios, comidas al día). Puedes combinar platillos de varios planes base.
- Dieta (si no hay plan base que indique otra cosa): el número de días indicado en LÍMITES, nombrados LUNES, MARTES, MIÉRCOLES…; en fin de semana se repite el día favorito. Cada día lleva ALMUERZO, COMIDA y CENA, más snacks ("SNACK OPCIONAL", "SNACK MEDIA TARDE") según las comidas que tolera la persona. Varía los platillos entre días. Elige "photo" del catálogo que más se parezca al platillo (o "" si ninguno). Ajusta porciones a las calorías y macros objetivo.
- Suplementos: sugiere solo los del catálogo y solo si están indicados para la persona (sin contraindicaciones con sus medicamentos o condiciones).
- RUTINAS BASE: si recibes documentos "Rutina base de Keila", elige la que mejor se ajuste (o la que Keila indique) y conserva su estructura: días por grupo muscular, secciones dentro del día ("title" del bloque: HOMBRO, TRÍCEPS, PANTORRILLA (NEUTRO)…), tipo de bloque, series, nota del bloque, indicaciones de cada ejercicio con su estilo (aproximación, drop, repeticiones cortas/completas, pesos orientativos) y secciones de texto del día en "extras" (CARDIO, HIPOPRESIVOS, INTERVALOS). Ajusta a esta persona: nivel, días disponibles, lugar (casa o gimnasio), lesiones y objetivo. Usa el mismo exerciseId que trae la rutina base cuando uses ese ejercicio.
- Rutina: días nombrados por grupo muscular (ej. "CUADRÍCEPS", "PULL / BÍCEPS", "GLÚTEO", "PUSH / TRÍCEPS", "FEMORAL"); bloques "EJERCICIO SENCILLO", "BI SERIE" o "TRI SERIE" con número de series; cada ejercicio con indicaciones al estilo de Keila (serie de aproximación, rango de repeticiones, cadencia). Usa exerciseId del catálogo; "custom" solo si es indispensable. Respeta lesiones y ejercicios que prefiere evitar.
- En "rationale" explica a Keila en 3–5 líneas por qué elegiste ese enfoque.`;

/** Límites configurables (Ajustes → IA) para que el plan quepa en la plantilla y no traiga demasiadas opciones */
export function aiLimits(cfg = {}) {
  const n = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) && x >= lo ? Math.min(hi, Math.round(x)) : d; };
  return {
    days: n(cfg.days, 5, 1, 7),
    maxOptions: n(cfg.maxOptions, 2, 1, 6),
    maxSectionsPerMeal: n(cfg.maxSectionsPerMeal, 4, 1, 8),
    extraInstructions: String(cfg.extraInstructions || '').trim().slice(0, 4000),
  };
}

function systemPrompt(kind, lim) {
  const rules = kind === 'diet' ? `
LÍMITES OBLIGATORIOS (para que el plan quepa en la plantilla PDF de Keila):
- En cada sección de elección ("Elige solo una opción…", "Opción 1/2…", "HC, elige una opción…", "Grasas, elige…") pon como MÁXIMO ${lim.maxOptions} opciones.
- Máximo ${lim.maxSectionsPerMeal} secciones por comida y máximo 5 renglones por sección.
- Cada renglón es UNA línea corta como en sus PDF (máx. ~60 caracteres): "120gr de pechuga de pollo", "Opción 1: 2pzas de tortilla". Nada de párrafos ni explicaciones dentro de las comidas.
- Tip del día: una sola frase (máx. 120 caracteres). Recomendaciones: máximo 8, de una línea cada una. "avoid": máximo 8.
- Si no hay plan base con OPCIÓN 1/2/3 o porciones, haz exactamente ${lim.days} día(s).` : `
LÍMITES OBLIGATORIOS (para que la rutina quepa en la plantilla PDF de Keila):
- Máximo 7 bloques por día y 3 ejercicios por bloque.
- Indicaciones de cada ejercicio en 1 a 3 renglones cortos (máx. ~60 caracteres cada uno), separados con salto de línea.`;
  return SYSTEM + '\n' + rules + (lim.extraInstructions ? `\n\nINDICACIONES PERMANENTES DE KEILA (síguelas siempre):\n${lim.extraInstructions}` : '');
}

const OPTION_LABEL = /opci[oó]n|elige/i;
/** Aplica los límites al resultado por si la IA se pasa */
export function applyLimits(data, kind, lim, keepDays) {
  if (kind !== 'diet') return data;
  if (!keepDays && Array.isArray(data.days) && data.days.length > lim.days) data.days = data.days.slice(0, lim.days);
  for (const d of data.days || []) {
    for (const m of d.meals || []) {
      let secs = (m.sections || []).filter((s) => s && ((s.items || []).some(Boolean) || s.label));
      secs = secs.map((s) => {
        const items = (s.items || []).map((x) => String(x || '').trim()).filter(Boolean);
        if (OPTION_LABEL.test(s.label || '')) return { ...s, items: items.slice(0, lim.maxOptions) };
        // Secciones sin etiqueta de elección cuyos renglones son "Opción N: ..."
        const opts = items.filter((x) => /^opci[oó]n\s*\d/i.test(x));
        if (opts.length > lim.maxOptions) { let k = 0; return { ...s, items: items.filter((x) => !/^opci[oó]n\s*\d/i.test(x) || ++k <= lim.maxOptions) }; }
        return { ...s, items };
      });
      m.sections = secs.slice(0, lim.maxSectionsPerMeal);
    }
  }
  return data;
}

function buildContent(kind, profile, ctx, templates, instructions, library = []) {
  const content = [];
  for (const b of library) {
    content.push({ type: 'document', source: { type: 'text', media_type: 'text/plain', data: b.text.slice(0, 60000) }, title: `${kind === 'routine' ? 'Rutina base' : 'Plan base'} de Keila: ${b.title}`, context: kind === 'routine' ? `Rutina real de Keila para: ${b.description || b.title}. Úsala como referencia principal de estructura, ejercicios, series e indicaciones.` : `Plan real de Keila para: ${b.description || b.title}. Úsalo como referencia principal de estructura, platillos, porciones y suplementos.` });
  }
  for (const t of templates) {
    if (t.base64) {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: t.base64 }, title: t.title, context: `Plantilla de Keila. Para qué es: ${t.purpose || 'no especificado'}. ${t.notes || ''}` });
    } else if (t.text) {
      content.push({ type: 'document', source: { type: 'text', media_type: 'text/plain', data: t.text.slice(0, 120000) }, title: t.title, context: `Plantilla de Keila. Para qué es: ${t.purpose || 'no especificado'}. ${t.notes || ''}` });
    }
  }
  content.push({ type: 'document', source: { type: 'text', media_type: 'text/plain', data: kind === 'diet' ? DIET_EXAMPLE : ROUTINE_EXAMPLE }, title: 'Ejemplo de estilo de Keila', context: 'Texto de planes reales de Keila (anonimizados). Imita su formato, redacción y porciones.' });
  const catalog = kind === 'routine'
    ? '\n\nCatálogo de ejercicios (exerciseId → nombre, grupo):\n' + EXERCISES.map((e) => `${e.id} → ${e.name} (${e.group})`).join('\n')
    : '\n\nCatálogo de fotos de platillos (photo → descripción):\n' + FOOD_PHOTOS.map((f) => `${f.key} → ${f.label}`).join('\n') + '\n\nSuplementos disponibles (key → nombre, dosis típica):\n' + SUPPLEMENTS.map((s) => `${s.key} → ${s.name}, ${s.dose}`).join('\n') + '\n\nImágenes de tip (image): ' + TIP_IMAGES.map((t) => `${t.key} (${t.label})`).join(', ');
  content.push({
    type: 'text',
    text: `Elabora un borrador de ${kind === 'diet' ? 'PLAN DE ALIMENTACIÓN' : 'PLAN DE ENTRENAMIENTO'} para esta persona.\n\nExpediente:\n${profileSummary(profile, ctx)}\n\nIndicaciones de Keila: ${instructions || 'ninguna adicional'}${catalog}`,
  });
  return content;
}

export async function generateWithAI({ kind, profile, progress = [], clinical = null, templates = [], library = [], instructions = '', aiConfig = {}, model, onStatus }) {
  const lim = aiLimits(aiConfig);
  onStatus?.('Leyendo plantillas…');
  const loaded = [];
  for (const t of templates) {
    if (t.text) { loaded.push(t); continue; }
    if (!t.fileId) continue;
    try { const { base64 } = await readFileBase64(t.fileId); loaded.push({ ...t, base64 }); } catch (e) { console.warn('No se pudo leer plantilla', t.title, e); }
  }
  const params = {
    model: model || DEFAULT_MODEL,
    max_tokens: 48000,
    system: systemPrompt(kind, lim),
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: kind === 'diet' ? DIET_SCHEMA : ROUTINE_SCHEMA } },
    messages: [{ role: 'user', content: buildContent(kind, profile, { progress, clinical }, loaded, instructions, library) }],
  };
  onStatus?.('La IA está elaborando el borrador… (puede tardar 1–3 minutos)');
  // La llamada a Claude se hace en el servidor (función generatePlan): la llave nunca está en el navegador
  let msg;
  try {
    const call = httpsCallable(functions, 'generatePlan', { timeout: 560000 });
    msg = (await call({ params })).data;
  } catch (e) {
    if (e.code === 'functions/deadline-exceeded') throw new Error('La IA tardó demasiado. Inténtalo de nuevo o pide un plan más breve.');
    if (e.code === 'functions/unavailable' || e.code === 'functions/internal' && /fetch|network/i.test(e.message)) throw new Error('No hay conexión con el servicio de IA. Revisa tu internet.');
    throw new Error(e.message || 'La IA no respondió. Inténtalo de nuevo.');
  }
  if (msg.stop_reason === 'refusal') throw new Error('La IA no pudo generar este plan. Ajusta las indicaciones e inténtalo de nuevo.');
  if (msg.stop_reason === 'max_tokens') throw new Error('La respuesta fue demasiado larga. Pide un plan más breve.');
  const text = msg.text || '';
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('La IA devolvió un formato inesperado. Inténtalo de nuevo.'); }
  data.version = 2;
  applyLimits(data, kind, lim, library.some((b) => ['opciones', 'porciones'].includes(b.format)));
  if (kind === 'routine') {
    for (const d of data.days || []) for (const b of d.blocks || []) for (const x of b.exercises || []) if (x.exerciseId === 'custom') x.exerciseId = '';
  }
  return data;
}

// Generación de dietas y rutinas con Claude (API de Anthropic) usando las plantillas PDF de Keila.
// La llave de API se guarda en Firestore (settings/admin), visible solo para la administradora.
import Anthropic from '@anthropic-ai/sdk';
import { readFileBase64 } from './files';
import { ACTIVITY, GOALS, ageFrom, bmi, bmiLabel } from './utils';
import { energy } from './nutrition';
import { EXERCISES } from '../data/exercises';

export { DEFAULT_MODEL } from './utils';
import { DEFAULT_MODEL } from './utils';

const str = { type: 'string' };
const num = { type: 'number' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const arr = (items) => ({ type: 'array', items });

const DIET_SCHEMA = obj({
  title: str, goal: str, calories: num,
  macros: obj({ protein: num, carbs: num, fat: num }),
  waterLiters: num,
  meals: arr(obj({ name: str, time: str, items: arr(obj({ food: str, qty: str })), notes: str })),
  recommendations: arr(str), avoid: arr(str), notes: str, rationale: str,
});

const ROUTINE_SCHEMA = obj({
  title: str, goal: str, daysPerWeek: num, level: str, warmup: str, cooldown: str,
  days: arr(obj({
    name: str, focus: str, cardio: str,
    exercises: arr(obj({ exerciseId: { type: 'string', enum: [...EXERCISES.map((e) => e.id), 'custom'] }, name: str, sets: num, reps: str, rest: str, notes: str })),
  })),
  notes: str, rationale: str,
});

export function profileSummary(p, progress = []) {
  const e = energy(p);
  const age = ageFrom(p.birthDate);
  const b = bmi(p.weightKg, p.heightCm);
  const lines = [
    `Nombre: ${p.firstName || ''} ${p.lastName || ''}`,
    `Sexo: ${p.sex || 'no indicado'} · Edad: ${age ?? 'no indicada'} años`,
    `Estatura: ${p.heightCm || '?'} cm · Peso: ${p.weightKg || '?'} kg · IMC: ${b ?? '?'} (${bmiLabel(b)})`,
    p.goalWeight && `Peso meta: ${p.goalWeight} kg`,
    p.waistCm && `Cintura: ${p.waistCm} cm`,
    p.bodyType && `Complexión / somatotipo: ${p.bodyType}`,
    `Objetivo: ${GOALS[p.goal] || p.goal || 'no indicado'}`,
    `Actividad física diaria: ${ACTIVITY[p.activityLevel]?.label || p.activityLevel || 'no indicada'}`,
    p.occupation && `Ocupación: ${p.occupation}`,
    `Experiencia entrenando: ${p.trainingExperience || 'no indicada'} · Días de entrenamiento/semana: ${p.trainingDays || '?'}`,
    `Horario de entrenamiento: ${p.trainingSchedule || 'no indicado'} · Lugar: ${p.trainingPlace || 'no indicado'}`,
    `Comidas que tolera al día: ${p.mealsPerDay || '?'}`,
    `Horario habitual: despierta ${p.wakeTime || '?'} · duerme ${p.sleepTime || '?'} · horas de sueño ${p.sleepHours || '?'}`,
    `Enfermedades / diagnósticos: ${p.diseases || 'ninguna referida'}`,
    `Medicamentos / suplementos: ${p.medications || 'ninguno'}`,
    p.surgeries && `Cirugías / lesiones: ${p.surgeries}`,
    p.injuries && `Lesiones o limitaciones físicas: ${p.injuries}`,
    p.familyHistory && `Antecedentes familiares: ${p.familyHistory}`,
    p.digestive && `Síntomas digestivos: ${p.digestive}`,
    p.femaleHealth && `Salud femenina (ciclo, embarazo, lactancia): ${p.femaleHealth}`,
    `Alergias alimentarias: ${p.allergies || 'ninguna'}`,
    p.intolerances && `Intolerancias: ${p.intolerances}`,
    p.foodDislikes && `Alimentos que no le gustan: ${p.foodDislikes}`,
    p.foodPreferences && `Preferencias / tipo de dieta: ${p.foodPreferences}`,
    p.budget && `Presupuesto para alimentos: ${p.budget}`,
    p.cooking && `Quién cocina / tiempo para cocinar: ${p.cooking}`,
    `Agua al día: ${p.waterLiters || '?'} L · Alcohol: ${p.alcohol || '?'} · Tabaco: ${p.smoking || '?'} · Estrés: ${p.stress || '?'}`,
    p.notes && `Notas del paciente: ${p.notes}`,
    e && `Referencia calculada (Mifflin-St Jeor): TMB ${e.bmr} kcal, GET ${e.tdee} kcal, sugerido ${e.kcal} kcal (P ${e.protein} g, C ${e.carbs} g, G ${e.fat} g), agua ${e.water} L`,
  ].filter(Boolean);
  if (progress.length) {
    lines.push('Progreso reciente: ' + progress.slice(0, 6).map((x) => `${x.date}: ${x.weightKg ?? '?'} kg${x.waistCm ? `, cintura ${x.waistCm}` : ''}`).join(' | '));
  }
  return lines.join('\n');
}

const SYSTEM = `Eres el asistente clínico de la Lic. en Nutrición Keila Guerrero (México). Elaboras BORRADORES de planes que ella revisará antes de entregarlos.
Reglas:
- Respeta estrictamente alergias, intolerancias, enfermedades y medicamentos. Si algo requiere supervisión médica, indícalo en "notes".
- Usa alimentos accesibles en México, porciones caseras claras (tazas, piezas, gramos) y lenguaje cercano en español.
- Imita el estilo, estructura, porciones y criterios de las plantillas PDF de Keila cuando se adjunten; elige la que mejor encaje con el objetivo y adáptala a la persona.
- El número de comidas debe coincidir con las que la persona tolera al día. Ajusta horarios a su rutina y horario de entrenamiento.
- En rutinas usa los ejercicios del catálogo (exerciseId); usa "custom" solo si es indispensable. Considera lesiones, nivel y lugar de entrenamiento.
- En "rationale" explica en 3–5 líneas, para Keila, por qué elegiste ese enfoque.`;

function buildContent(kind, profile, progress, templates, instructions) {
  const content = [];
  for (const t of templates) {
    if (!t.base64) continue;
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: t.base64 },
      title: t.title,
      context: `Plantilla de ${kind === 'diet' ? 'dieta' : 'rutina'} de Keila. Para qué es: ${t.purpose || 'no especificado'}. ${t.notes || ''}`,
    });
  }
  const catalog = kind === 'routine'
    ? '\n\nCatálogo de ejercicios disponibles (exerciseId → nombre, grupo):\n' + EXERCISES.map((e) => `${e.id} → ${e.name} (${e.group})`).join('\n')
    : '';
  content.push({
    type: 'text',
    text: `Elabora un borrador de ${kind === 'diet' ? 'PLAN DE ALIMENTACIÓN' : 'RUTINA DE ENTRENAMIENTO'} para esta persona.\n\nExpediente:\n${profileSummary(profile, progress)}\n\nIndicaciones de Keila: ${instructions || 'ninguna adicional'}${catalog}`,
  });
  return content;
}

export async function generateWithAI({ kind, profile, progress = [], templates = [], instructions = '', apiKey, model, onStatus }) {
  if (!apiKey) throw new Error('Configura tu llave de API de Claude en Ajustes para usar la IA.');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  onStatus?.('Leyendo plantillas…');
  const loaded = [];
  for (const t of templates) {
    try {
      const { base64 } = await readFileBase64(t.fileId);
      loaded.push({ ...t, base64 });
    } catch (e) {
      console.warn('No se pudo leer plantilla', t.title, e);
    }
  }
  const params = {
    model: model || DEFAULT_MODEL,
    max_tokens: 32000,
    system: SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: kind === 'diet' ? DIET_SCHEMA : ROUTINE_SCHEMA } },
    messages: [{ role: 'user', content: buildContent(kind, profile, progress, loaded, instructions) }],
  };
  onStatus?.('La IA está elaborando el borrador…');
  let msg;
  try {
    msg = await client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }).finalMessage();
  } catch (e) {
    // Si la cuenta no admite el parámetro de respaldo, reintentamos sin él
    if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
      msg = await client.messages.stream(params).finalMessage();
    } else if (e instanceof Anthropic.AuthenticationError) {
      throw new Error('La llave de API no es válida. Revísala en Ajustes.');
    } else if (e instanceof Anthropic.RateLimitError) {
      throw new Error('Se alcanzó el límite de uso de la API. Intenta en unos minutos.');
    } else if (e instanceof Anthropic.APIConnectionError) {
      throw new Error('No hay conexión con el servicio de IA. Revisa tu internet.');
    } else throw e;
  }
  if (msg.stop_reason === 'refusal') throw new Error('La IA no pudo generar este plan. Ajusta las indicaciones e inténtalo de nuevo.');
  if (msg.stop_reason === 'max_tokens') throw new Error('La respuesta fue demasiado larga. Pide un plan más breve.');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    const data = JSON.parse(text);
    if (kind === 'routine') {
      for (const d of data.days || []) for (const x of d.exercises || []) if (x.exerciseId === 'custom') x.exerciseId = '';
    }
    return data;
  } catch {
    throw new Error('La IA devolvió un formato inesperado. Inténtalo de nuevo.');
  }
}

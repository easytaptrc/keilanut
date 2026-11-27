// Sugerencias personalizadas a partir de la báscula, el historial clínico, el progreso y el cálculo energético.
// level: 'alerta' (requiere atención), 'atencion' (mejorable), 'bien' (va bien), 'tip' (recomendación general)
import { ageFrom } from './utils';

const has = (v, ...words) => {
  const s = (Array.isArray(v) ? v.join(' ') : String(v ?? '')).toLowerCase();
  return words.some((w) => s.includes(w));
};
const yes = (v) => /^s[ií]|frecuent|ocasional/i.test(String(v ?? ''));
const meaningful = (v) => v != null && String(v).trim() !== '' && !/^(no|nada|ninguno|ninguna|0)$/i.test(String(v).trim());

export function patientSuggestions({ member = {}, clinical = null, calc = null, progress = [] }) {
  const out = [];
  const add = (level, title, text, area = 'general') => out.push({ level, title, text, area });
  const c = clinical || {};
  const body = c.body || {};
  const sa = c.salud || {}, nu = c.nutricion || {}, ha = c.habitos || {}, ac = c.actividad || {};
  const male = member.sex === 'masculino';
  const age = ageFrom(member.birthDate);
  const w = Number(body.weightKg || member.weightKg) || null;
  const h = Number(body.heightCm || member.heightCm) || null;
  const imc = calc?.bmi ?? (w && h ? Math.round((w / (h / 100) ** 2) * 10) / 10 : null);
  const health = `${member.diseases || ''} ${[].concat(sa.diagnoses || []).join(' ')} ${sa.diagnosesOther || ''}`.toLowerCase();

  // ---- Composición corporal ----
  if (imc) {
    if (imc < 18.5) add('alerta', `IMC ${imc}: bajo peso`, 'Prioriza un superávit moderado, proteína suficiente y entrenamiento de fuerza. Descarta causas médicas si la pérdida fue reciente.', 'cuerpo');
    else if (imc < 25) add('bien', `IMC ${imc}: rango normal`, 'Enfoca el plan en composición corporal (más músculo, menos grasa) más que en el peso de la báscula.', 'cuerpo');
    else if (imc < 30) add('atencion', `IMC ${imc}: sobrepeso`, 'Un déficit moderado (10–20%) con proteína alta ayuda a perder grasa sin perder músculo.', 'cuerpo');
    else add('alerta', `IMC ${imc}: obesidad${imc >= 40 ? ' grado III' : imc >= 35 ? ' grado II' : ' grado I'}`, 'Déficit sostenible, seguimiento cercano y evaluación de comorbilidades (glucosa, presión, lípidos). Los g/kg se calculan con peso ajustado.', 'cuerpo');
  }
  const waist = Number(body.waistCm) || null, hip = Number(body.hipCm) || null;
  if (waist) {
    const [hi, mid] = male ? [102, 94] : [88, 80];
    if (waist > hi) add('alerta', `Cintura ${waist} cm: riesgo cardiometabólico alto`, `Por arriba de ${hi} cm. Reducir grasa abdominal es prioridad: déficit, menos azúcares y alcohol, más actividad diaria.`, 'cuerpo');
    else if (waist > mid) add('atencion', `Cintura ${waist} cm: riesgo aumentado`, `Por arriba de ${mid} cm. Vigilar en cada revisión.`, 'cuerpo');
    if (hip) {
      const icc = Math.round((waist / hip) * 100) / 100;
      if (icc > (male ? 0.9 : 0.85)) add('atencion', `Índice cintura-cadera ${icc}`, 'Distribución de grasa central; se asocia a mayor riesgo metabólico.', 'cuerpo');
    }
    if (h && waist / h > 0.5) add('atencion', `Cintura/estatura ${Math.round((waist / h) * 100) / 100}`, 'Mayor a 0.5: conviene reducir perímetro de cintura.', 'cuerpo');
  }
  const bf = Number(body.bodyFat) || null;
  if (bf) {
    const [lo, ok, high] = male ? [8, 24, 25] : [21, 31, 32];
    if (bf >= high) add('atencion', `Grasa corporal ${bf}%: elevada`, `Meta saludable: ${male ? '14–24' : '21–31'}%. Combinar déficit moderado con fuerza 3–4 días.`, 'cuerpo');
    else if (bf < lo) add('alerta', `Grasa corporal ${bf}%: muy baja`, 'Riesgo hormonal y de rendimiento. Evitar déficit; asegurar grasas saludables.', 'cuerpo');
    else if (bf <= ok) add('bien', `Grasa corporal ${bf}%: en rango`, 'Mantener o recomponer según el objetivo.', 'cuerpo');
  }
  const visc = Number(body.visceralFat) || null;
  if (visc) {
    if (visc >= 13) add('alerta', `Grasa visceral nivel ${visc}: alta`, 'Prioridad: actividad aeróbica diaria, reducir azúcares, harinas refinadas y alcohol.', 'cuerpo');
    else if (visc >= 10) add('atencion', `Grasa visceral nivel ${visc}: límite`, 'Vigilar; incluir caminata o cardio suave la mayoría de los días.', 'cuerpo');
  }
  const waterPct = Number(body.waterPct) || null;
  if (waterPct && waterPct < (male ? 50 : 45)) add('atencion', `Agua corporal ${waterPct}%: baja`, `Aumentar agua natural a ${calc?.water || '2.5–3'} L al día y revisar consumo de sodio.`, 'cuerpo');
  const metAge = Number(body.metabolicAge) || null;
  if (metAge && age && metAge > age + 2) add('atencion', `Edad metabólica ${metAge} (edad real ${age})`, 'Mejorar masa muscular con fuerza y proteína suficiente ayuda a bajarla.', 'cuerpo');

  // ---- Peso meta y progreso ----
  const goalW = Number(member.goalWeight) || null;
  if (goalW && w && Math.abs(goalW - w) >= 1) {
    const diff = Math.round((w - goalW) * 10) / 10;
    const weekly = Math.max(0.25, Math.round(w * 0.007 * 10) / 10);
    add('tip', `Meta: ${goalW} kg (${diff > 0 ? `faltan ${diff}` : `subir ${Math.abs(diff)}`} kg)`, `A un ritmo saludable de ~${weekly} kg por semana serían unas ${Math.ceil(Math.abs(diff) / weekly)} semanas.`, 'progreso');
  }
  const prog = [...progress].filter((p) => p.weightKg).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (prog.length >= 2) {
    const first = prog[0], last = prog[prog.length - 1];
    const delta = Math.round((last.weightKg - first.weightKg) * 10) / 10;
    const lose = ['perder_grasa', 'recomposicion'].includes(member.goal);
    if (lose && delta > 0.5) add('atencion', `Subió ${delta} kg desde ${first.date}`, 'Revisar adherencia, porciones y fines de semana; considerar ajustar calorías 5–10%.', 'progreso');
    else if (lose && delta < 0) add('bien', `Bajó ${Math.abs(delta)} kg desde ${first.date}`, 'Va en buen camino; reforzar lo que está funcionando.', 'progreso');
    else if (member.goal === 'ganar_musculo' && delta <= 0) add('atencion', 'Sin aumento de peso', 'Para ganar músculo suele requerirse un superávit pequeño (5–10%).', 'progreso');
  }

  // ---- Cálculo energético ----
  if (calc?.ok) {
    for (const t of calc.warnings || []) add('atencion', 'Cálculo energético', t, 'calculo');
    add('tip', `Hidratación: ${calc.water} L de agua al día`, 'Calculado por kg de peso. Agregar 0.5 L en días de entrenamiento intenso.', 'nutricion');
    add('tip', `Proteína: ${calc.macros.p.g} g al día`, `Repartir en ${member.mealsPerDay || nu.mealsPerDay || 4} tiempos (≈${Math.round(calc.macros.p.g / (Number(member.mealsPerDay || nu.mealsPerDay) || 4))} g por comida).`, 'nutricion');
  }

  // ---- Salud ----
  if (has(health, 'resistencia a la insulina', 'prediabetes', 'diabetes')) add('alerta', 'Glucosa / insulina', 'Hidratos de bajo índice glucémico, siempre acompañados de proteína y fibra; evitar bebidas azucaradas; repartir los hidratos en el día. Coordinar con su médico si usa medicamento.', 'salud');
  if (has(health, 'hipertensi')) add('alerta', 'Presión arterial', 'Sodio menor a 2 g al día: evitar embutidos, enlatados y sopas instantáneas; más verduras, frutas y potasio.', 'salud');
  if (has(health, 'colesterol', 'triglic')) add('alerta', 'Lípidos en sangre', 'Priorizar grasas insaturadas (aguacate, nueces, aceite de oliva, pescado) y fibra soluble (avena, leguminosas); limitar fritos y alcohol.', 'salud');
  if (has(health, 'hipotiroid')) add('atencion', 'Hipotiroidismo', 'Tomar levotiroxina en ayunas, separada 30–60 min de alimentos, café y suplementos de calcio o hierro.', 'salud');
  if (/\bsop\b|ovario poliqu/.test(health)) add('atencion', 'SOP', 'Enfoque en sensibilidad a la insulina: hidratos de bajo índice glucémico, fuerza y buen descanso.', 'salud');
  if (has(health, 'anemia')) add('alerta', 'Anemia', 'Incluir hierro (carnes rojas magras, hígado, leguminosas) con vitamina C en la misma comida; evitar café o té con las comidas.', 'salud');
  if (has(sa.digestive, 'gastritis', 'reflujo')) add('atencion', 'Gastritis / reflujo', 'Comidas pequeñas, evitar irritantes (picante, café en ayunas, alcohol) y no acostarse justo después de cenar.', 'salud');
  if (has(sa.digestive, 'estreñimiento')) add('atencion', 'Estreñimiento', 'Aumentar fibra (verduras, fruta con cáscara, avena, chía) y agua de forma gradual.', 'salud');
  if (has(sa.digestive, 'inflamaci', 'colitis')) add('atencion', 'Inflamación / colitis', 'Identificar detonantes (lácteos, leguminosas, crucíferas) e introducirlos poco a poco.', 'salud');
  if (/^s[ií]/i.test(sa.pregnancy || '')) add('alerta', 'Embarazo o lactancia', 'No usar déficit agresivo. Requerimiento extra aproximado: +340 kcal (2º trimestre), +450 kcal (3º) o +330–400 kcal en lactancia. Coordinar con su médico.', 'salud');
  if ([].concat(sa.eatingDisorders || []).filter((x) => x && !/ninguno|prefiere no/i.test(x)).length) add('alerta', 'Antecedente de TCA', 'Evitar conteo estricto y déficit agresivo; enfoque en hábitos y valorar acompañamiento psicológico.', 'salud');
  if (sa.diagnosesControlled === 'No') add('alerta', 'Diagnósticos no controlados', 'Sugerir valoración médica antes de cambios grandes en la alimentación o el ejercicio.', 'salud');
  if (/^s[ií]/i.test(ac.injuries || '') || meaningful(member.injuries)) add('atencion', 'Lesión', `Adaptar la rutina a la lesión${ac.injuryType ? ` (${ac.injuryType})` : ''}; evitar ejercicios que causen dolor.`, 'actividad');

  // ---- Hábitos ----
  if (['3 a 4 horas', '5 a 6 horas'].includes(ha.sleepHours)) add('atencion', `Duerme ${ha.sleepHours}`, 'Dormir 7–8 horas mejora el hambre, la recuperación y la pérdida de grasa. Rutina de sueño y cenar 2 h antes de dormir.', 'habitos');
  if (Number(ha.stress) >= 4) add('atencion', `Estrés alto (${ha.stress}/5)`, 'Planear colaciones para evitar comer por ansiedad; caminatas, respiración o actividades que disfrute.', 'habitos');
  if (['3 a 4 veces por semana', '5 a 7 veces por semana'].includes(ha.eatingOut)) add('atencion', 'Come fuera seguido', 'Darle una guía de elecciones en restaurante: asados o a la plancha, salsas aparte, bebida sin azúcar.', 'habitos');
  if (yes(ha.nightWork)) add('tip', 'Turnos nocturnos / desvelos', 'Ajustar los horarios de comida a su turno y llevar colaciones preparadas.', 'habitos');
  if (meaningful(nu.alcohol)) add('atencion', 'Consumo de alcohol', `Reportó: “${String(nu.alcohol).slice(0, 80)}”. Limitarlo ayuda a la pérdida de grasa y al descanso; preferir destilados con agua mineral.`, 'habitos');
  if (/^s[ií]|ocasional/i.test(nu.tobacco || '')) add('atencion', 'Tabaco o vapeador', 'Recomendar disminuirlo; afecta la recuperación y la salud cardiovascular.', 'habitos');
  if (meaningful(nu.sugaryDrinks)) add('atencion', 'Bebidas azucaradas', `Reportó: “${String(nu.sugaryDrinks).slice(0, 80)}”. Cambiarlas por agua natural, de sabor con stevia o mineral.`, 'nutricion');
  if (yes(nu.nightHunger)) add('atencion', 'Hambre nocturna', 'Asegurar proteína y fibra en la cena, y una colación nocturna planeada si hace falta.', 'nutricion');
  if (has(nu.foodRelationship, 'ansiedad', 'estrés')) add('atencion', 'Come por ansiedad o estrés', 'Identificar detonantes, tener colaciones planeadas y no saltarse comidas.', 'nutricion');
  if (has(nu.foodRelationship, 'salta')) add('atencion', 'Se salta comidas', 'Estructurar horarios fijos; saltarse comidas suele aumentar el hambre y los antojos más tarde.', 'nutricion');
  if (has(nu.foodRelationship, 'culpa')) add('atencion', 'Culpa al comer', 'Enfoque flexible, sin alimentos “prohibidos”; valorar apoyo psicológico.', 'nutricion');
  if (/^s[ií]|no est/i.test(nu.lactose || '')) add('tip', 'Lactosa', 'Usar lácteos deslactosados o alternativas vegetales fortificadas.', 'nutricion');
  if (meaningful(nu.allergies) || meaningful(member.allergies)) add('alerta', 'Alergias alimentarias', `Excluir: ${nu.allergies || member.allergies}.`, 'nutricion');

  // ---- Actividad ----
  if (['0 a 1'].includes(ac.days)) add('atencion', 'Poca actividad física', 'Meta mínima: 150 minutos por semana de actividad moderada más 2 días de fuerza. Empezar con caminatas de 20–30 min.', 'actividad');
  if (ac.days && ['4 a 5', '6 a 7'].includes(ac.days) && ['perder_grasa'].includes(member.goal)) add('tip', 'Entrena seguido', 'Cuidar no hacer un déficit tan grande para no perder rendimiento ni masa muscular.', 'actividad');

  const order = { alerta: 0, atencion: 1, tip: 2, bien: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

export const LEVEL_UI = {
  alerta: { label: 'Atender', tone: 'danger' },
  atencion: { label: 'Mejorar', tone: 'warn' },
  tip: { label: 'Sugerencia', tone: 'info' },
  bien: { label: 'Bien', tone: 'ok' },
};

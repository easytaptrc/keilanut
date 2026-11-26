// Historial clínico nutricional (uso exclusivo de la nutrióloga). Nada es obligatorio.
// Tipos: multi (varias opciones + "Otros"), single (una opción), text, area, date.
const NINGUNO = 'Ninguno';
const CONTROL = ['Sí', 'No', 'Parcialmente', 'No aplica'];

export const CLINICAL_SECTIONS = [
  {
    key: 'salud', title: 'Salud y antecedentes', fields: [
      { key: 'familyHistory', label: 'Antecedentes familiares', type: 'multi', options: ['Diabetes', 'Hipertensión', 'Enfermedades del corazón', 'Cáncer', 'Obesidad', NINGUNO], other: true },
      { key: 'diagnoses', label: 'Diagnósticos médicos actuales', type: 'multi', options: ['Colesterol alto', 'Triglicéridos altos', 'Resistencia a la insulina', 'Diabetes tipo 1', 'Diabetes tipo 2', 'Hipertensión', 'Enfermedades del corazón', 'Síndrome de ovario poliquístico (SOP)', 'Hipertiroidismo', 'Hipotiroidismo', 'Cáncer', NINGUNO], other: true },
      { key: 'diagnosesControlled', label: '¿Los diagnósticos están controlados?', type: 'single', options: CONTROL },
      { key: 'digestive', label: 'Síntomas digestivos actuales', type: 'multi', options: ['Gastritis', 'Colitis', 'Reflujo', 'Inflamación frecuente', 'Estreñimiento', 'Diarrea', NINGUNO], other: true },
      { key: 'digestiveControlled', label: '¿Los síntomas están controlados?', type: 'single', options: CONTROL },
      { key: 'recentSymptoms', label: 'Síntomas recientes sin diagnóstico confirmado', type: 'multi', options: ['Fatiga persistente', 'Cambios de peso sin causa aparente', 'Sed o hambre excesivas', 'Mareos o palpitaciones', 'Cambios o ausencia del ciclo menstrual', 'Problemas digestivos frecuentes', NINGUNO], other: true },
      { key: 'medications', label: 'Medicamentos actuales (nombre, dosis, frecuencia y motivo)', type: 'area' },
      { key: 'supplements', label: 'Suplementos actuales (nombre, dosis y frecuencia)', type: 'area' },
      { key: 'ergogenics', label: 'Uso de ayudas ergogénicas (cuáles y desde cuándo)', type: 'area' },
      { key: 'surgeries', label: 'Cirugías previas (tipo y fecha)', type: 'area' },
      { key: 'pregnancy', label: 'Embarazo o lactancia actual', type: 'single', options: ['Sí', 'No', 'No aplica'] },
      { key: 'eatingDisorders', label: 'Antecedentes o sospecha de trastornos de la conducta alimentaria', type: 'multi', options: ['Anorexia', 'Bulimia', 'Vigorexia', 'Otros', NINGUNO, 'Prefiere no responder'] },
      { key: 'menstrualCycle', label: 'Ciclo menstrual (cuando corresponda)', type: 'single', options: ['Regular', 'Irregular', 'Ausencia de menstruación', 'No aplica'] },
      { key: 'clinicalNotes', label: 'Observaciones clínicas relevantes', type: 'area' },
    ],
  },
  {
    key: 'nutricion', title: 'Historial nutricional', fields: [
      { key: 'pattern', label: 'Patrón alimenticio actual', type: 'single', options: ['Omnívoro', 'Vegetariano', 'Vegano', 'Otro'], other: true, hint: 'Vegetariano: excluye carne y pescado; puede consumir huevos y lácteos. Vegano: excluye todo producto de origen animal.' },
      { key: 'allergies', label: 'Alergias alimentarias', type: 'area' },
      { key: 'intolerances', label: 'Intolerancias alimentarias', type: 'area' },
      { key: 'dislikes', label: 'Alimentos que no le gustan, le causan molestias o evita por motivos personales, culturales o religiosos', type: 'area' },
      { key: 'lactose', label: '¿Presenta intolerancia a la lactosa?', type: 'single', options: ['Sí', 'No', 'No está seguro'] },
      { key: 'previousDiets', label: '¿Ha seguido dietas o planes nutricionales anteriormente?', type: 'single', options: ['Sí', 'No'] },
      { key: 'previousDietsDetail', label: 'Si respondió sí, ¿cuáles y cómo fue su experiencia?', type: 'area', showIf: ['previousDiets', 'Sí'] },
      { key: 'water', label: 'Consumo diario de agua', type: 'text' },
      { key: 'caffeine', label: 'Consumo de café o bebidas con cafeína', type: 'text' },
      { key: 'alcohol', label: 'Consumo de alcohol y frecuencia', type: 'text' },
      { key: 'tobacco', label: 'Consumo de tabaco o vapeadores', type: 'single', options: ['Sí', 'No', 'Ocasionalmente'] },
      { key: 'sugaryDrinks', label: 'Consumo de refrescos y bebidas azucaradas (cantidad y frecuencia)', type: 'text' },
      { key: 'foodRelationship', label: 'Relación con la comida', type: 'multi', options: ['Come por ansiedad o estrés', 'Come en exceso por la noche', 'Presenta antojos frecuentes o intensos', 'Se salta comidas', 'Siente culpa al comer', 'Ninguna'], other: true },
      { key: 'typicalDay', label: 'Descripción de la alimentación habitual de un día (horarios, alimentos y porciones)', type: 'area' },
      { key: 'hungerSatiety', label: 'Percepción de hambre y saciedad', type: 'area' },
      { key: 'nightHunger', label: '¿Presenta hambre nocturna después de cenar?', type: 'single', options: ['Sí', 'No', 'Frecuentemente'] },
      { key: 'difficulties', label: 'Principales dificultades para seguir planes nutricionales anteriores', type: 'multi', options: ['Horarios', 'Hambre', 'Falta de variedad', 'Preparaciones complicadas', 'Costos', 'Eventos sociales', 'Viajes', 'Restricción excesiva', 'Ansiedad o pérdida de control', 'Falta de resultados', 'Poca comunicación con el profesional', 'Plan incompatible con la familia'], other: true },
      { key: 'mealsPerDay', label: 'Número de comidas que mejor se adapta a su rutina', type: 'single', options: ['3', '4', '5', '6'] },
    ],
  },
  {
    key: 'habitos', title: 'Hábitos y estilo de vida', fields: [
      { key: 'typicalDay', label: 'Descripción de un día típico (despertar, comidas, trabajo, entrenamiento y descanso)', type: 'area' },
      { key: 'sleepHours', label: 'Horas de sueño', type: 'single', options: ['3 a 4 horas', '5 a 6 horas', '7 a 8 horas', 'Más de 8 horas'] },
      { key: 'bedtime', label: 'Hora habitual de dormir', type: 'text' },
      { key: 'stress', label: 'Nivel de estrés (1 = bajo, 5 = muy alto)', type: 'single', options: ['1', '2', '3', '4', '5'] },
      { key: 'mealTimes', label: 'Horarios habituales de las comidas', type: 'text' },
      { key: 'eatingOut', label: 'Frecuencia de comidas fuera de casa', type: 'single', options: ['1 vez por semana o menos', '2 veces por semana', '3 a 4 veces por semana', '5 a 7 veces por semana'] },
      { key: 'whoCooks', label: '¿Quién prepara habitualmente los alimentos?', type: 'text' },
      { key: 'nightWork', label: '¿Trabaja de noche o se desvela frecuentemente?', type: 'single', options: ['Sí', 'No', 'Ocasionalmente'] },
    ],
  },
  {
    key: 'actividad', title: 'Actividad física', fields: [
      { key: 'trainingType', label: 'Tipo de entrenamiento', type: 'multi', options: ['Pesas / hipertrofia', 'Entrenamiento híbrido (fuerza y resistencia)', 'Caminata', 'Cardio', 'CrossFit'], other: true },
      { key: 'days', label: 'Días de entrenamiento por semana', type: 'single', options: ['0 a 1', '2 a 3', '4 a 5', '6 a 7'] },
      { key: 'duration', label: 'Duración habitual por sesión', type: 'single', options: ['30 minutos o menos', '60 minutos', '90 minutos', '2 horas o más'] },
      { key: 'experience', label: 'Experiencia entrenando', type: 'single', options: ['Principiante: semanas de experiencia', 'Aproximadamente 3 meses', 'Aproximadamente 6 meses', 'Más de 1 año'] },
      { key: 'performanceGoals', label: 'Metas de rendimiento deportivo', type: 'area' },
      { key: 'weeklyRoutine', label: 'Rutina semanal actual (días de entrenamiento, músculos trabajados y descansos)', type: 'area' },
      { key: 'bestExercises', label: 'Ejercicios en los que presenta mejor progreso', type: 'area' },
      { key: 'avoidExercises', label: 'Ejercicios que le incomodan o prefiere evitar', type: 'area' },
      { key: 'discomfort', label: 'Molestias durante el ejercicio (movimiento, zona y descripción)', type: 'area' },
      { key: 'injuries', label: '¿Ha tenido lesiones previas o actuales?', type: 'single', options: ['Sí', 'No'] },
      { key: 'injuryType', label: 'Tipo de lesión y zona afectada', type: 'area', showIf: ['injuries', 'Sí'] },
      { key: 'injuryWhen', label: '¿Hace cuánto ocurrió o cuánto tiempo lleva con la lesión?', type: 'text', showIf: ['injuries', 'Sí'] },
      { key: 'injuryHow', label: '¿Cómo ocurrió y qué síntomas presentó?', type: 'area', showIf: ['injuries', 'Sí'] },
      { key: 'heaviestDay', label: 'Día más pesado de entrenamiento', type: 'single', options: ['Inicio de semana', 'Mitad de semana', 'Fin de semana'] },
      { key: 'lightestDay', label: 'Día más ligero de entrenamiento', type: 'single', options: ['Inicio de semana', 'Mitad de semana', 'Fin de semana'] },
    ],
  },
  {
    key: 'objetivos', title: 'Objetivos y expectativas', fields: [
      { key: 'goal', label: 'Objetivo principal', type: 'single', options: ['Pérdida de grasa', 'Ganancia de masa muscular', 'Recomposición corporal', 'Mejora de la salud', 'Rendimiento deportivo', 'Mejora de hábitos alimenticios', 'Otro'], other: true },
      { key: 'timeframe', label: '¿En cuánto tiempo desea alcanzar su objetivo?', type: 'text' },
      { key: 'whyNow', label: '¿Por qué desea lograrlo ahora?', type: 'area' },
      { key: 'shortTerm', label: 'Metas a corto plazo (3 a 8 meses)', type: 'area' },
      { key: 'longTerm', label: 'Metas a largo plazo (1 a 2 años)', type: 'area' },
      { key: 'obstacles', label: 'Principales dificultades identificadas', type: 'multi', options: ['Falta de tiempo', 'Horarios de trabajo', 'Antojos', 'Comer fuera de casa', 'Presupuesto', 'Motivación', 'Lesiones'], other: true },
    ],
  },
  {
    key: 'evaluacion', title: 'Evaluación profesional', fields: [
      { key: 'anthropometry', label: 'Medidas antropométricas pertinentes', type: 'area', hint: 'Las medidas de la báscula se capturan en el paso “Báscula y medidas”.' },
      { key: 'nutritionalStatus', label: 'Evaluación del estado nutricional', type: 'area' },
      { key: 'findings', label: 'Hallazgos y observaciones profesionales', type: 'area' },
      { key: 'agreedGoals', label: 'Objetivos nutricionales acordados con el paciente', type: 'area' },
      { key: 'initialRecommendations', label: 'Recomendaciones iniciales', type: 'area' },
      { key: 'followUpPlan', label: 'Plan de seguimiento', type: 'area' },
    ],
  },
  {
    key: 'acuerdos', title: 'Acuerdos y seguimiento', fields: [
      { key: 'agreements', label: 'Puntos explicados al paciente', type: 'multi', options: [
        'Su programa se entrega en un plazo de 4 a 7 días y recibirá una notificación por WhatsApp cuando esté listo.',
        'Se compromete a completar su reporte semanal en la aplicación para facilitar la evaluación del progreso.',
        'Los ajustes se realizan con base en su evolución; el plan no necesariamente se rehace cada semana.',
        'Los cambios se realizarán durante cada revisión cuando sean necesarios.',
        'La asesoría es personalizada y revisada por Keila Guerrero Arreola.',
        'Horario de atención: lunes a viernes, de 9:00 a. m. a 7:00 p. m.',
        'Se explicó el aviso de privacidad y el tratamiento de los datos personales y de salud.',
        'Se registra la aceptación de las condiciones del servicio y el consentimiento correspondiente.',
      ] },
      { key: 'extraNotes', label: 'Observaciones adicionales', type: 'area' },
      { key: 'consultDate', label: 'Fecha de consulta', type: 'date' },
      { key: 'nextReview', label: 'Fecha de próxima revisión', type: 'date', hint: 'Si la dejas vacía, se calcula a 3 semanas de la consulta.' },
      { key: 'status', label: 'Estado de la historia clínica', type: 'single', options: ['Pendiente', 'En proceso', 'Completada', 'Revisada por la nutrióloga'] },
    ],
  },
];

/** Medidas de la báscula / evaluación corporal (paso 2 de la consulta). */
export const BODY_FIELDS = [
  { key: 'weightKg', label: 'Peso', unit: 'kg' },
  { key: 'heightCm', label: 'Estatura', unit: 'cm' },
  { key: 'bodyFat', label: 'Grasa corporal', unit: '%' },
  { key: 'fatKg', label: 'Grasa', unit: 'kg' },
  { key: 'muscleKg', label: 'Masa muscular', unit: 'kg' },
  { key: 'visceralFat', label: 'Grasa visceral (nivel)', unit: '' },
  { key: 'waterPct', label: 'Agua corporal', unit: '%' },
  { key: 'boneKg', label: 'Masa ósea', unit: 'kg' },
  { key: 'bmrKcal', label: 'Metabolismo basal (báscula)', unit: 'kcal' },
  { key: 'metabolicAge', label: 'Edad metabólica', unit: 'años' },
  { key: 'waistCm', label: 'Cintura', unit: 'cm' },
  { key: 'hipCm', label: 'Cadera', unit: 'cm' },
  { key: 'chestCm', label: 'Pecho', unit: 'cm' },
  { key: 'armRCm', label: 'Brazo derecho', unit: 'cm' },
  { key: 'armLCm', label: 'Brazo izquierdo', unit: 'cm' },
  { key: 'thighRCm', label: 'Pierna derecha', unit: 'cm' },
  { key: 'thighLCm', label: 'Pierna izquierda', unit: 'cm' },
  { key: 'calfCm', label: 'Pantorrilla', unit: 'cm' },
];

/** Texto legible de todo el historial para la IA (incluye preguntas personalizadas guardadas con su etiqueta). */
export function clinicalText(c, sections = CLINICAL_SECTIONS) {
  if (!c) return '';
  const labels = c._labels || {};
  const known = new Set(sections.map((s) => s.key));
  const extra = Object.keys(c).filter((k) => !known.has(k) && !k.startsWith('_') && k !== 'body' && k !== 'updatedAt'
    && c[k] && typeof c[k] === 'object' && !Array.isArray(c[k]) && typeof c[k].toDate !== 'function');
  const all = [...sections, ...extra.map((k) => ({ key: k, title: labels[k]?.title || k, fields: [] }))];
  const lines = [];
  for (const s of all) {
    const data = c[s.key] || {};
    const order = [...s.fields.map((f) => f.key), ...Object.keys(data).filter((k) => !k.endsWith('Other') && !s.fields.some((f) => f.key === k))];
    const parts = [];
    for (const key of order) {
      const f = s.fields.find((x) => x.key === key);
      let v = data[key];
      if (Array.isArray(v)) v = v.join(', ');
      const other = data[key + 'Other'];
      if (other) v = [v, `Otro: ${other}`].filter(Boolean).join(', ');
      const label = f?.label || labels[s.key]?.fields?.[key] || key;
      if (v != null && String(v).trim()) parts.push(`- ${label}: ${String(v).trim()}`);
    }
    if (parts.length) lines.push(`${(labels[s.key]?.title || s.title).toUpperCase()}\n${parts.join('\n')}`);
  }
  return lines.join('\n\n');
}

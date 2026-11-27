# Keila Guerrero · Nutrición — App web (PWA)

**Sitio:** https://kg-nutricion.com (GitHub Pages) · respaldo en https://egogym-39e45.web.app (Firebase Hosting)

| Sección | URL | Para quién |
|---|---|---|
| Sitio y reservaciones | `/` y `/reservar` | Público (sin precios) |
| Team | `/team` | Pacientes aceptados (ID + contraseña o Google) |
| Panel administrativo | `/admin` | Solo Keila |

## Pendientes de configuración

1. **Acceso con Google:** Firebase Console → proyecto *keilanut* → Authentication → Sign-in method → **Google** →
   Habilitar → correo de soporte → Guardar. Después, en Authentication → Settings → **Authorized domains**,
   agrega `kg-nutricion.com`.
2. **IA (Claude):** panel → Ajustes → pega tu llave de API de Anthropic (console.anthropic.com → API Keys).
3. **Ajustes:** precios (solo tú los ves), turnos de citas, WhatsApp, Instagram y dirección.

## Ajustes (todo configurable desde el panel)
Panel → **Ajustes**, por secciones:
- **Sitio y contacto:** WhatsApp, Instagram, correo, dirección; todos los textos de la página de inicio y de la
  reservación; sección “Sobre mí” con tu foto (colección pública `siteImages`).
- **Servicios y precios:** agregar, apagar, ordenar y editar servicios (nombre, descripción, lo que incluye, ícono, foto);
  precio privado de cada uno.
- **Horario de citas:** días, turnos, duración, anticipación y días bloqueados.
- **Preguntas de reservación:** cambiar textos, apagar, hacer obligatoria, ordenar, agregar preguntas (texto, número,
  fecha, una o varias opciones, Sí/No, Sí/No + ¿cuál?, casilla) y secciones. Las respuestas nuevas se guardan en
  `extra` de la reservación y del expediente, y la IA las lee.
- **Historial clínico:** lo mismo para las preguntas de la Consulta y las medidas de la báscula (agregar medidas).
- **App del paciente:** encender o apagar Dieta, Comidas, Rutina, Progreso, Fotos y Reservar; revisión cada N semanas,
  días de aviso antes, recordatorios automáticos y mensaje de bienvenida.
- **Inteligencia artificial:** llave, modelo, días de la dieta, opciones por comida, secciones por platillo y tus
  propias reglas para la IA.
- **Cuenta y respaldo:** cambiar contraseña y descargar un respaldo completo de los datos (JSON).

## Cálculo energético (expediente → pestaña **Cálculo**)
Con los datos de la báscula y el perfil (peso, estatura, edad, sexo, % grasa):
- **GEB** con Harris-Benedict (el de tus Excel), Mifflin-St Jeor, Katch-McArdle (masa magra) y FAO/OMS, lado a lado.
- **GET** como en tu Excel (GEB + ETA 10% + actividad %), por **METs** (MET × 0.0175 × peso × minutos, con días por
  semana) o con factor de actividad.
- **Calorías a consumir** según el objetivo (déficit/superávit), **macros** en g/kg (proteína e hidratos; lípidos lo
  que resta), agua, peso ajustado en obesidad y avisos (lípidos < 20%, déficit agresivo…).
- **Cuadro dietosintético** con equivalentes SMAE por tiempo de comida y % de adecuación.
- **Sugerencias personalizadas** (IMC, cintura, grasa visceral, sueño, estrés, diagnósticos, progreso…) que puedes
  enviar al paciente como aviso.
- “Guardar cálculo” lo deja en el expediente; en la Dieta, “Usar mi cálculo” llena calorías y macros, y la IA lo usa.
- Todo se configura en **Ajustes → Cálculo energético**.

## Cómo funciona

### Reservación (público)
- Calendario: solo aparecen los días que atiendes; al elegir un día se ven las horas libres de la **mañana**
  (7:00 y 8:00) y la **tarde** (17:30 y 18:30). Citas de 1 hora. Una hora reservada desaparece al instante.
- Preguntas: nombre, fecha de nacimiento, teléfono/WhatsApp, correo, motivo de consulta, objetivo principal,
  si ya fue con nutriólogo, **estatura y peso**, salud básica (enfermedad, medicamentos, alergias/intolerancias,
  lesiones: Sí/No + ¿cuál?), aceptación del aviso de privacidad y de las condiciones del servicio.
- Los turnos, días bloqueados (vacaciones) y anticipación se cambian en **Ajustes → Horario de citas**.

### Consulta (panel → Team → paciente → pestaña **Consulta**)
Pasos (nada es obligatorio, “Siguiente” guarda): **Perfil** → **Báscula y medidas** (peso, estatura, IMC
automático, % grasa, músculo, visceral, agua, medidas) + **fotos** → 7 secciones del **historial clínico
nutricional** (salud, nutrición, hábitos, actividad física, objetivos, evaluación profesional, acuerdos).
Al terminar se programa la **próxima revisión a 3 semanas** (o la fecha que pongas).
El historial clínico solo lo ve la nutrióloga.

### Planes base (biblioteca)
Panel → **Planes y plantillas → Planes base**: 8 planes reales de Keila convertidos a la app (déficit, anemia,
recomposición con 3 menús, ayuno 16 h, porciones con tabla de equivalentes) con sus fotos, horarios, suplementos,
instrucciones y recomendaciones. En el expediente (pestaña **Dieta → Mis planes base**) se ordenan según el
paciente (sexo, edad, peso, estatura, objetivo, anemia, comidas al día); “Usar este plan” lo carga en el editor
para ajustarlo y publicarlo. “Guardar como plan base” agrega cualquier plan a la biblioteca (colección
`planLibrary`, solo administradora). La IA recibe los 3 planes base más parecidos (o el que elijas) como punto de
partida.

### Rutinas base
Panel → **Planes y plantillas → Planes base → Rutinas de entrenamiento**: 4 rutinas reales de Keila (pierna 3 días +
superior 2, en casa sin material, 4 días por grupo muscular, pierna/push/pull + hipopresivos). Cada ejercicio está ligado
a su animación (113 ejercicios en el catálogo), con secciones por músculo, notas de bloque y secciones de texto
(cardio, hipopresivos, intervalos). En el expediente: **Rutina → Mis rutinas base** (ordenadas por sexo, objetivo,
nivel, días disponibles y si entrena en casa). La IA recibe las rutinas base más parecidas como punto de partida.

### Planes con el diseño de Keila
- **Dieta:** 5 días (Lunes a Viernes) con Almuerzo, Comida, Cena y snacks; foto de cada platillo, tip del día,
  suplementos con su imagen, recomendaciones. **Rutina:** días por grupo muscular con bloques (ejercicio sencillo,
  bi serie, tri serie) y animación de cada ejercicio.
- **Borrador automático** o **Generar con IA**: la IA lee la reservación, la báscula, el historial clínico, el
  progreso, tus plantillas PDF (Panel → Plantillas IA; se extrae el texto, aceptan PDFs grandes) y ejemplos
  anonimizados de tus planes, y arma el plan con tu estilo y porciones.
- **PDF con mi diseño:** portada, requisitos, datos iniciales (tabla de medidas), check visual (fotos de la
  1ª y última consulta), instrucciones, suplementos, un día por página, recomendaciones, marcas recomendadas,
  lo que necesitas, guía visual y “¡Mucho éxito! / cambio de plan”. La rutina sale vertical, 2 días por hoja.

### Team (paciente)
Inicio (aviso de revisión), Dieta (con productos recomendados), **Comidas** (contador tipo FatSecret:
315 alimentos mexicanos con calorías y macros, productos empacados vía Open Food Facts y alimentos
personalizados; compara contra las metas de su dieta), Rutina + biblioteca de ejercicios, Progreso (gráficas y
**fotos** de progreso con comparación antes/después), Perfil, Reservar y Avisos.

### Notificaciones
- Push al paciente cuando publicas un plan, confirmas una cita o le escribes (`pushMemberNotification`).
- Push a ti por cada reservación nueva (`pushNewBooking`).
- **Recordatorio de revisión** (`reviewReminders`, diario 9:00 hora de Monterrey): 3 días antes de cumplir
  3 semanas y el día que le toca, solo si aún no ha reservado.

## Seguridad
- Visitantes: solo crean reservaciones válidas ligadas a un horario libre; no leen datos de nadie.
- Pacientes: solo leen lo suyo; pueden subir sus fotos, registrar comidas y progreso. No ven historial clínico,
  borradores, plantillas, precios ni notas privadas (viven en `bookingAdmin`, solo administradora).
- Administradora única (alta bloqueada por reglas). Dependencias sin vulnerabilidades conocidas (`npm audit`).
- Respaldo del proyecto antes de esta versión: carpeta `respaldos/`.

## Desarrollo
```bash
npm install
npm run emulators      # en otra terminal
npm run dev:emu        # pruebas locales sin tocar datos reales
npm run build && firebase deploy --only hosting,firestore:rules,functions --project egogym-39e45
npm run assets         # íconos desde IMG_0646.PNG + imágenes de ejercicios
```
GitHub Pages compila solo con `.github/workflows/deploy.yml` al subir cambios a `main`.

Créditos: ejercicios de [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense);
tipografías Londrina Solid y Poppins (SIL Open Font License, en `static/plan/fonts`); imágenes de los planes
propiedad de Keila Guerrero.

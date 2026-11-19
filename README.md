# Keila Guerrero · Nutrición — App web (PWA)

**Sitio en vivo:** https://egogym-39e45.web.app

| Sección | URL | Para quién |
|---|---|---|
| Sitio y reservaciones | `/` y `/reservar` | Público (sin precios) |
| Team | `/team` | Pacientes aceptados (ID + contraseña o Google) |
| Panel administrativo | `/admin` | Solo Keila |

## Primeros pasos (una sola vez)

1. **Crear la cuenta de administradora.** Entra a https://egogym-39e45.web.app/admin. La primera vez aparece
   “Crea tu cuenta de administradora”: escribe tu correo y una contraseña (mín. 8). Esa será tu cuenta.
   Después de crearla, nadie más puede registrarse como administradora (lo impiden las reglas de seguridad).
   Hazlo pronto: hasta que la crees, cualquiera que llegue a `/admin` vería ese formulario.
2. **Activar el acceso con Google** (para el Team), un solo clic:
   Firebase Console → proyecto *keilanut* → Authentication → Sign-in method → **Google** → Habilitar →
   elige el correo de soporte → Guardar. (No lo activé yo porque Google pide publicar un correo de soporte
   en la pantalla de acceso, y eso lo decides tú.)
3. **IA (Claude):** en el panel → Ajustes → pega tu llave de API de Anthropic (console.anthropic.com → API Keys).
   Solo tu cuenta de administradora puede leerla.
4. **Ajustes:** precios por servicio (solo tú los ves), días y horario de citas, WhatsApp, Instagram y dirección.
5. **Plantillas IA:** sube tus dietas y rutinas modelo en PDF y explica para qué es cada una.

## Cómo funciona

- **Reservar (público):** servicio (online o presencial), fecha y hora libres, datos personales, medidas,
  historial médico (enfermedades, medicamentos, cirugías, lesiones, antecedentes, digestivo, salud femenina,
  laboratorios), alimentación (alergias, intolerancias, gustos, comidas al día, agua, sueño, estrés, alcohol,
  tabaco, presupuesto) y actividad (nivel, experiencia, días, horario, lugar, objetivo y motivación).
  Un horario ocupado ya no se puede volver a reservar.
- **Panel → Reservaciones:** ves el expediente completo (edad, IMC, historial…), el precio y si ya pagó.
  **Aceptar y dar ID de Team** crea el ID (`KG-0001`, `KG-0002`…) y una contraseña, y te da un botón para
  mandárselos por WhatsApp. Si el correo ya pertenece a un miembro, la cita se vincula a su expediente.
- **Panel → Team → paciente:** pestañas Expediente, Dieta, Rutina, Progreso, Citas, Notificar y Acceso.
  - *Dieta / Rutina:* “Borrador automático” (cálculo Mifflin‑St Jeor + alergias + número de comidas) o
    “Generar con IA” (lee el expediente y tus plantillas PDF). Editas, ves la “vista del paciente”, adjuntas
    un PDF si quieres, exportas a PDF y **Publicar al paciente** (le llega notificación).
  - *Acceso:* generar nueva contraseña, desactivar o reactivar.
- **Panel → Notificaciones:** mensajes a todo el Team o a quienes elijas.
- **Team (paciente):** inicio, dieta, rutina con animación de cada ejercicio, biblioteca de ejercicios
  por grupo muscular (pecho, espalda, hombros, bíceps, tríceps, piernas, femoral, glúteos, pantorrilla,
  abdomen, cardio), progreso con gráficas, foto de perfil, reservar de nuevo, avisos y PDF descargable.

## Notificaciones push

- La paciente instala la app (Android/PC: botón “Instalar”; iPhone: Compartir → *Agregar a inicio*, requisito
  de Apple) y toca **Activar** en la tarjeta de notificaciones.
- Dos Cloud Functions (ya desplegadas) envían el push: `pushMemberNotification` (cada aviso, plan publicado
  o cita confirmada) y `pushNewBooking` (te avisa a ti de cada reservación nueva; actívalo en tu Inicio del panel).

## Seguridad (auditoría)

Reglas de Firestore probadas en emulador:
- Visitantes: solo pueden crear reservaciones válidas (con su horario) y leer horarios ocupados y contacto público.
  No pueden leer reservaciones, expedientes, precios ni la llave de IA, ni reservar a nombre de un miembro.
- Pacientes: solo leen su propio expediente, planes, progreso, avisos, citas y PDFs. Solo pueden cambiar su
  foto, sus dispositivos de notificación y su progreso. No pueden ver borradores, plantillas, precios ni a otros pacientes.
- Administradora: acceso total. Solo puede existir una cuenta de administradora (alta única).

## Desarrollo

```bash
npm install
npm run dev            # contra Firebase real
npm run emulators      # en otra terminal; luego:
npm run dev:emu        # pruebas locales sin tocar datos reales
npm run build && firebase deploy --only hosting,firestore:rules,functions --project egogym-39e45
npm run assets         # regenera íconos desde IMG_0646.PNG y descarga imágenes de ejercicios (en static/)
```

Imágenes de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (The Unlicense, dominio público).

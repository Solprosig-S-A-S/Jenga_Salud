# Salas de Jenga por turnos

El HTML incluye dos modos: grupo en un dispositivo sin internet y sala compartida mediante Supabase. Ya incluye la URL y la clave pública del proyecto `twemynxvrjlpgmrodopb`. El SQL está instalado: el 23 de octubre de 2026 se verificaron en el proyecto real la creación de sala, la incorporación de otro participante, la respuesta obligatoria y el avance sincronizado de turno. La sala técnica se cerró al terminar. El juego está publicado en [GitHub Pages](https://solprosig-s-a-s.github.io/Jenga_Salud/) y el código está en [Solprosig-S-A-S/Jenga_Salud](https://github.com/Solprosig-S-A-S/Jenga_Salud).

## Conectar Supabase

1. Abre tu proyecto de Supabase y entra a **SQL Editor**.
2. Pega y ejecuta completo [jenga.sql](jenga.sql). Crea dos tablas y la función `jenga_room`. Puede ejecutarse de nuevo sin borrar las partidas.
3. En **Connect** o **Project Settings → API**, copia la URL del proyecto y la clave **publishable** (preferida) o **anon**. No uses `service_role`, `sb_secret_…` ni la contraseña de PostgreSQL.
4. Publica el HTML en un alojamiento estático con HTTPS. El archivo es autónomo: no necesita subir `.jenga-build`, la copia `.bak` ni el SQL. Abrir el HTML localmente permite probarlo, pero una ruta `file://` no sirve como enlace para otros celulares.
5. Abre el juego y continúa hasta Jenga. La URL y la clave pública ya están cargadas; solo cambia **Conectar proyecto de Supabase** si vas a usar otro proyecto.
6. Escribe un alias y pulsa **Crear sala**. Pulsa **Copiar invitación** y comparte el enlace. Incluye la configuración pública y el código; no incluye el token privado del participante ni datos de salud.
7. Cada participante abre el enlace, escribe su propio alias y pulsa **Unirme a la sala**. El facilitador también ocupa un turno. Cuando estén todos, pulsa **Iniciar con este orden**.

Las claves públicas están diseñadas para usarse en el navegador. La protección está en las operaciones permitidas por la base de datos: [documentación de claves](https://supabase.com/docs/guides/getting-started/api-keys), [funciones](https://supabase.com/docs/guides/database/functions).

## Flujo obligatorio

- Solo el participante activo puede sortear o elegir una pieza. Después de elegirla, queda bloqueada durante ese turno.
- Cada pieza conserva su pregunta. El participante responde oralmente y pulsa **Ya respondí en voz alta**. El juego registra esta confirmación; no evalúa si la respuesta oral fue correcta.
- Después puede revelar la respuesta para todos y confirmar que retiró y colocó la pieza arriba. La confirmación de respuesta es obligatoria; consultar la guía es opcional.
- Supabase avanza al siguiente participante y vuelve al primero al terminar la lista. Cada operación bloquea la fila de la sala y comprueba su revisión para impedir doble movimiento o acciones fuera de turno.
- Si cae la torre real, el facilitador pulsa **La torre real cayó · terminar ronda**. Solo el facilitador puede reconstruir y volver a abrir la ronda. No se permite saltar participantes.
- Las incorporaciones se cierran al iniciar. Si falta alguien o una persona abandona definitivamente, el facilitador puede abrir otra sala con el grupo disponible.

## Sincronización y privacidad

El cliente consulta el estado cada 2 segundos, también al recuperar conexión o volver a la pestaña. Durante una desconexión se bloquean las acciones; al reconectar se recupera el estado del servidor. La animación puede llegar con ese pequeño retraso. Se comparte el registro de piezas y la posición lógica de la torre; los fotogramas de física son una aproximación visual local y vuelven a las posiciones comunes tras cada movimiento.

Los indicadores del formulario de salud nunca se incluyen en las solicitudes a Supabase. Se almacenan en el proyecto únicamente alias, orden de participantes, hashes de los tokens de sesión y estado de la partida. El navegador conserva la configuración pública y el token privado de esa sala en `sessionStorage`; al recargar recupera el mismo puesto. Cada persona debe usar una pestaña propia. No compartas la sesión del navegador.

Las salas dejan de aceptar operaciones después de 24 horas. El vencimiento no borra las filas: el propietario del proyecto debe definir la retención o limpieza según su uso. Las tablas tienen RLS activa y acceso directo revocado a `anon` y `authenticated`; las operaciones se realizan por la función que valida el token y el turno. Los tokens no se devuelven en las respuestas públicas.

## Verificación de desarrollo

Desde la raíz del proyecto, con las dependencias de `.jenga-build` instaladas:

```powershell
python .jenga-build/integrate.py
node .jenga-build/check-supabase.cjs
node .jenga-build/check-rooms.cjs
node .jenga-build/check-local-turns.cjs
```

Las pruebas de base de datos usan PostgreSQL mediante PGlite. La prueba de dos navegadores intercepta las solicitudes HTTP y ejecuta el SQL localmente; no crea salas ni modifica datos en tu proyecto real. Después de ejecutar el SQL en Supabase, comprueba la conexión real con dos dispositivos antes de la actividad.

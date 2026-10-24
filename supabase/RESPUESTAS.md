# Guardar y descargar respuestas

El código está preparado y probado localmente. Esta actualización requiere ejecutar los SQL siguientes en el proyecto real antes de publicar el juego. Las respuestas anteriores, que solo se dijeron en voz alta o se borraron del navegador, no se pueden recuperar.

## Activación en Supabase

1. En el proyecto `twemynxvrjlpgmrodopb`, abre **SQL Editor** y ejecuta completo [jenga.sql](jenga.sql). Actualiza las salas y crea el catálogo de preguntas, el historial de respuestas y el envío de respuestas locales. Conserva las partidas existentes.
2. Ejecuta completo [admin.sql](admin.sql). Activa la consulta exclusiva para administradores. Si vuelves a aplicar `jenga.sql`, aplica después `admin.sql` para restablecer el permiso de lectura de los administradores.
3. En **Authentication → Users**, crea las cuentas del equipo con correo y contraseña. Cada persona debe tener su propia cuenta. Si ya existen, reutilízalas. Esta página no permite registrarse ni autorizarse a sí mismo.
4. Copia el **User UID** de cada cuenta autorizada y ejecuta, sustituyendo los valores:

```sql
insert into public.jenga_admins(user_id)
values ('UUID-DE-LA-PRIMERA-CUENTA'), ('UUID-DE-LA-SEGUNDA-CUENTA')
on conflict do nothing;
```

5. Ejecuta `python .jenga-build/package-site.py` y publica mediante el flujo existente de GitHub Pages. Se publican el juego y `admin.html`.
6. Abre `https://solprosig-s-a-s.github.io/Jenga_Salud/admin.html`. Ingresa con una cuenta autorizada, consulta las respuestas y pulsa **Descargar Excel (.xlsx)**. Los filtros por fecha usan UTC e incluyen ambos días completos. El alias es una coincidencia exacta.

Para retirar acceso, elimina su UID de la lista:

```sql
delete from public.jenga_admins where user_id='UUID-DE-LA-CUENTA';
```

La URL de administración puede abrirse públicamente; los datos requieren autenticación y autorización en la base de datos. Ocultar el enlace o conocer la URL no concede acceso. La sesión de administración permanece en memoria y se pierde al recargar o cerrar la página. Las contraseñas y los tokens de administración no se guardan en el almacenamiento del navegador. Usa **Cerrar sesión** al terminar.

## Qué se guarda

Cada respuesta incluye alias, texto, pregunta, número de pieza, modo, sala o sesión local, ronda, turno y fecha de recepción en la base de datos (UTC). Las preguntas se obtienen del catálogo del servidor. Las piezas 31–54 repiten las preguntas 1–24. El archivo Excel conserva los textos como texto, incluso si comienzan por `=`.

La persona debe escribir entre 1 y 500 caracteres y pulsar **Guardar respuesta** antes de avanzar. En una sala, el servidor obtiene el alias del participante activo y guarda la respuesta junto con la confirmación del turno en una sola transacción. El texto escrito no se comparte con los demás jugadores.

En modo local se usan los alias introducidos por el facilitador. La respuesta se guarda primero en este navegador y se envía al proyecto configurado en `.jenga-build/supabase-config.json`. Si falla el envío, se conserva hasta que la página vuelva a abrirse con conexión; los reintentos no duplican registros. No borres el almacenamiento del navegador ni uses navegación privada si necesitas conservar respuestas pendientes. La fecha guardada es la de recepción, que puede ser posterior al turno si se jugó sin conexión. Los alias locales son declarados por el facilitador y no verifican identidad.

Los indicadores del formulario inicial (peso, talla, etc.) siguen fuera de las solicitudes. Las respuestas son texto libre: el juego avisa que no se incluyan datos personales. El historial de respuestas se conserva aunque venza o se elimine la sala. El propietario del proyecto administra su retención desde Supabase.

## Comprobación antes de la actividad

Prueba una sala con dos dispositivos, escribe una respuesta y revisa que aparezca con el alias y la pregunta correctos en administración. Descarga el Excel y ábrelo. Comprueba también que una cuenta fuera de `jenga_admins` no pueda consultar. Prueba el modo local sin conexión y vuelve a conectar con la página abierta hasta que indique que las respuestas están en la base de datos.

Las pruebas automáticas interceptan las solicitudes y usan PostgreSQL local (PGlite), sin modificar Supabase real:

```powershell
python .jenga-build/package-site.py
node .jenga-build/check-supabase.cjs
node .jenga-build/check-rooms.cjs
node .jenga-build/check-local-turns.cjs
node .jenga-build/check-mobile.cjs
node .jenga-build/check-answers.cjs
```

El acceso sigue el modelo de [Supabase Auth](https://supabase.com/docs/guides/auth) y [seguridad por filas](https://supabase.com/docs/guides/database/postgres/row-level-security). Solo las cuentas listadas pueden leer el historial; los jugadores no pueden consultarlo ni modificar respuestas guardadas.

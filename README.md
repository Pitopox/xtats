# XTATS

**Sonríe. Sobrevive al algoritmo.**
Sátira jugable sobre vivir bajo calificaciones sociales. React 18 + Tailwind CSS 3 + Vite 5. Español, inglés y portugués.

## Probarlo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # versión de producción en dist/ (incluye el service worker)
npm run preview    # sirve dist/ para probar la instalación como app
```

Para instalarla en un celular: publica `dist/` en un hosting con HTTPS (Vercel, Netlify, Cloudflare Pages), ábrela en el teléfono y elige **Agregar a pantalla de inicio**.

## Qué hay en la app

| Pestaña | Qué hace |
|---|---|
| **Hoy** | Reto diario (la misma situación para todo el mundo cada día), resultado en emojis para compartir, ranking de amigos del día, resumen semanal con tarjeta y métricas del embudo de compartir. |
| **Jugar** | El simulador completo con cuatro modos: Libre, Speedrun a la cárcel, Contrarreloj 4.5 (llegar a 4.5 en 2 minutos) y Supervivencia. Guarda récords. |
| **Filtro** | Cámara frontal o foto subida, con la estética sobreexpuesta y tu puntaje flotando sobre la cabeza. Genera una imagen 9:16. |
| **Amigos** | Código de invitación, récords del grupo por modo, reto de hoy y lista de bloqueados. |

Además:
- **Modo Sincero:** al llegar a 0.1 se desbloquea un espacio sin filtro y sin puntaje.
- **Tarjetas para compartir:** imágenes 1080×1920 para Stories, Reels y TikTok, con compartir nativo, descarga o texto para copiar.
- **Seguridad:** edad mínima de 13 años, aviso de sátira, moderación de insultos y opciones para reportar y bloquear.
- **Experiencia móvil:** pantalla completa en celulares, vibración en Android y sonidos sintetizados.

## Estructura

```
src/App.jsx     lógica y UI (comentado por secciones)
src/backend.js  conexión con Supabase (login, amigos, récords, reto diario)
supabase/       esquema SQL con permisos
src/i18n.js     todos los textos en es / en / pt
src/main.jsx    arranque + registro del service worker
public/         manifest, service worker, íconos, imagen de vista previa
```

## Publicar y conectar con Supabase

Sin configuración, la app corre en **modo demo**: todo queda en el dispositivo y los amigos son simulados. Al agregar las dos variables de Supabase se activan el login con Google y Meta, los amigos por código, los récords del grupo y el reto diario compartido. No hay que tocar el código.

### Paso 1 · Crear el proyecto en Supabase (10 min)

1. Entra a supabase.com, crea una cuenta y luego **New project**. Elige la región más cercana a tus jugadores, por ejemplo São Paulo para Sudamérica.
2. Ve a **SQL Editor → New query**, pega todo `supabase/schema.sql` y presiona **Run**. Esto crea las tablas, los permisos y las funciones de amigos y récords.
3. Ve a **Project Settings → API** y copia:
   - la **Project URL**
   - la **Publishable key** (empieza con `sb_publishable_`). Nunca uses la *secret key* en la app.
4. En el proyecto, copia `.env.example` como `.env.local` y pega ambos valores.
5. Ejecuta `npm install` y `npm run dev`. Debajo de "Entrar como invitado" ya aparecen los botones de Google y Meta, aunque todavía falta configurarlos (pasos 2 y 3).

### Paso 2 · Login con Google

1. En console.cloud.google.com, crea un proyecto y abre **APIs y servicios → Pantalla de consentimiento de OAuth**. Completa el nombre de la app y el correo de soporte.
2. En **Credenciales → Crear credenciales → ID de cliente de OAuth**, elige **Aplicación web**.
3. En **URI de redireccionamiento autorizados** pega la URL de callback que muestra Supabase en **Authentication → Sign In / Providers → Google**. Tiene la forma `https://TU-PROYECTO.supabase.co/auth/v1/callback`.
4. Copia el Client ID y el Client Secret en ese mismo panel de Supabase, activa Google y guarda.

### Paso 3 · Login con Meta (Facebook)

1. En developers.facebook.com, entra a **My Apps → Create App** y agrega el producto **Facebook Login**.
2. En **Facebook Login → Settings → Valid OAuth Redirect URIs**, pega la misma URL de callback de Supabase.
3. En **Use Cases → Authentication and Account Creation**, confirma que `public_profile` y `email` estén listos.
4. En **Settings → Basic**, copia el App ID y el App Secret. Pégalos en Supabase, en **Authentication → Sign In / Providers → Facebook**, y activa el proveedor.
5. Mientras la app de Meta esté en modo desarrollo, solo pueden entrar las personas con un rol en ella (admins, developers o testers). Para abrirla al público, completa ícono, URL de política de privacidad y dominio, y envíala a revisión.

### Paso 4 · Publicar en internet (Vercel)

1. Sube la carpeta del proyecto a un repositorio de GitHub. El archivo `.gitignore` ya excluye `.env.local`.
2. En vercel.com/new, importa el repositorio. Vercel detecta Vite solo.
3. En **Environment Variables**, agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` y presiona **Deploy**.
4. Copia tu dirección final (por ejemplo `https://xtats.vercel.app`) y en Supabase, **Authentication → URL Configuration**:
   - **Site URL:** tu dirección de Vercel
   - **Redirect URLs:** tu dirección de Vercel y `http://localhost:5173`
5. En `index.html`, cambia `https://xtats.app` por tu dirección en las etiquetas `og:` para que la vista previa de los enlaces funcione.

Netlify y Cloudflare Pages funcionan igual: comando de build `npm run build` y carpeta `dist`.

### Cómo funciona la conexión

| Archivo | Qué hace |
|---|---|
| `supabase/schema.sql` | Tablas `profiles`, `friendships`, `records`, `daily_results` y `reports`, con Row Level Security. Cada persona ve solo su perfil y el de sus amigos. |
| `add_friend(code)` | Agrega un amigo con su código de invitación, en ambos sentidos. |
| `submit_record(mode, ms)` | Guarda una marca conservando siempre la mejor, para que no se pueda empeorar ni inventar un récord. |
| `src/backend.js` | El cliente de Supabase y todas las consultas. Sin variables de entorno, `remote.enabled` es `false` y la app usa los datos de demo. |

No se guarda la fecha de nacimiento: solo que la persona confirmó tener 13 años o más.

### 3. Filtro oficial en TikTok

El filtro de la pestaña **Filtro** funciona dentro de la app. Para un efecto de TikTok hay que construirlo en **TikTok Effect House**, que es un editor de escritorio, y enviarlo a revisión con una cuenta de creador. La estética y el globo con el puntaje de la app sirven como referencia de diseño.

### 4. Tiendas de apps

- **Android:** empaqueta la PWA con Bubblewrap (Trusted Web Activity) o con Capacitor.
- **iOS:** usa Capacitor.

Apple y Google exigen, para apps con contenido de usuarios, filtrar contenido ofensivo, reportar, bloquear y tener un contacto de soporte. Lo primero ya está implementado; falta el contacto de soporte.

## Antes de lanzar

- **Política de privacidad y términos:** son obligatorios en ambas tiendas y para el login con Google y Meta.
- **Edad mínima de 13 años (COPPA):** la verificación actual usa solo el año de nacimiento. Con servidor, guarda el bloqueo en la cuenta y no solo en el dispositivo.
- **Moderación:** amplía la lista `INSULTS` o usa un servicio de moderación cuando haya publicaciones visibles entre usuarios reales.
- **El juego solo puntúa personajes y partidas.** No agregues calificaciones a personas reales: es la diferencia entre una sátira y una app de acoso.

# OilLog — Contexto del proyecto

PWA de registro operacional para pozos de captación y plantas de petróleo.
Stack: HTML/CSS/JS vanilla + Firebase (Auth + Firestore). Modularización completa.

- **Repo:** https://github.com/dany9515/registro-plantas (rama `main`)
- **Producción:** https://oillog.operlog.com.ar (GitHub Pages + dominio propio, CDN Cloudflare)
- **Firebase proyecto:** `registroplantas-7dc06`
- **Credenciales Firebase:** `assets/firebase-config.js` (commiteado — son públicas por diseño en apps web)

---

## Arquitectura general

- Login con Firebase Auth (email/password)
- Al autenticar, lee `usuarios/{uid}` en Firestore para obtener `nombre` y `rol`
- Roles: `recorredor` (acceso completo) y `supervisor` (solo novedades)
- Registros guardados en colección `registros`, partes nocturnos en `partes`
- Sin backend propio — todo directo a Firestore desde el cliente
- Entry point: `<script type="module" src="./js/main.js?v=YYYYMMDD">` — carga todos los módulos
- Service Worker (`sw.js`) registrado en index.html: network-first para JS locales, cache fallback offline

### Colecciones Firestore

| Colección | Descripción |
|---|---|
| `usuarios` | Documento por UID con campos `nombre` y `rol` |
| `registros` | Un doc por guardado de planta. Campos: `planta`, `fecha`, `turno`, `vuelta`, `hora`, `recorredor`, `datos` (objeto), `timestamp`, `userEmail`, `editado` |
| `partes` | Partes nocturnos. Campos: `fecha`, `hora`, `rec1`, `rec2`, `acumulados`, `niveles`, `quimicos`, `timestamp`, `userEmail` |
| `diagramas` | Diagramas de turno. Campos: `mes`, `mesNombre`, `datos` (array), `timestamp`, `cargadoPor` |

### Reglas Firestore
Todas las colecciones: `allow read, write: if request.auth != null` — cualquier usuario autenticado tiene acceso completo. Verificado y correcto.

### Plantas disponibles
`23T`, `17T`, `PPA`, `ED1`, `EC19`, `AGUADA`, `O87`

---

## Estructura de archivos

```
css/
  estilos.css           ← todo el CSS
js/
  firebase-init.js      ← exports: auth, db
  ui.js                 ← exports: showToast, setSyncStatus, mostrarWelcome
  plantas.js            ← exports: cargarUltimoNivel, cargarUltimoRegistro, ultimoRegistroPorPlanta
  supervisor.js         ← export: cargarNovedadesSupervisor + window.cargarNovedadesSupervisor (para HTML)
  auth.js               ← side-effect: onAuthStateChanged bootstrap, window.doLogin/doLogout/cambiarPassword
  parte.js              ← side-effect: window.calcTotal, cargarDatosParte, generarPartePDF, verUltimoPDF
  diagrama.js           ← side-effect: window.renderDiagrama, setVistasDiagrama, renderDiagramaSemana, irHoy, cargarDiagrama, eliminarDiagrama
  main.js               ← entry point: plant nav listener, window.showPlant
sw.js                   ← Service Worker: network-first para JS locales (mismo origen)
index.html              ← solo HTML + <script type="module" src="./js/main.js?v=YYYYMMDD">
```

### Grafo de dependencias
```
main.js
  ├── plantas.js → firebase-init.js, ui.js
  ├── supervisor.js → firebase-init.js
  ├── auth.js → firebase-init.js, ui.js, plantas.js, supervisor.js
  ├── parte.js → firebase-init.js, ui.js, plantas.js (ultimoRegistroPorPlanta)
  └── diagrama.js → firebase-init.js, ui.js
```

**Nota importante:** Los módulos requieren servidor local (`http://`). No funcionan con `file://`.

---

## Deploy y caché

### Regla crítica: rutas relativas
Todos los imports usan rutas **relativas** (`./firebase-init.js`, no `/js/firebase-init.js`). Las rutas absolutas fallan en GitHub Pages con subdirectorios y en algunos browsers móviles.

### Cache busting al deployar
Dos capas:
1. **`?v=YYYYMMDD`** en todos los imports locales — rompe caché del CDN Cloudflare. Cambiar la fecha en cada deploy que modifique JS o CSS.
   - En `index.html` (JS): `src="./js/main.js?v=20260604"`
   - En cada módulo JS: `from './firebase-init.js?v=20260604'`
   - En `index.html` (CSS): `<link rel="stylesheet" href="css/estilos.css?v=20260605">` — **el CSS también necesita `?v=`**, de lo contrario Cloudflare cachea el archivo viejo y los cambios no se ven en producción.
2. **Service Worker (`sw.js`)** — intercepta JS del mismo origen, siempre valida con el servidor (`cache: 'no-cache'`). Sirve desde caché si no hay red. Automático, no requiere acción manual.

> **REGLA OBLIGATORIA PARA CLAUDE:** Cada vez que se modifica `css/estilos.css` o cualquier archivo JS, el `?v=` correspondiente en `index.html` **debe actualizarse en el mismo commit**. Si se pushea sin actualizar el `?v=`, Cloudflare sigue sirviendo el archivo viejo y los cambios no llegan a producción. No existe excepción.

### Si un usuario tiene la app cacheada con código viejo
- Primer deploy con SW: pedir al usuario que limpie caché una última vez para que el SW se instale
- Deploys siguientes: el SW maneja todo automáticamente

---

## Funciones clave

| Función | Archivo | Qué hace |
|---|---|---|
| `iniciarConUsuario(user)` | js/auth.js | Carga datos del usuario desde Firestore, maneja error de red con retry |
| `onAuthStateChanged` bootstrap | js/auth.js | Punto de entrada de la app — detecta login/logout |
| `doLogin()` | js/auth.js | Login con email/password |
| `doLogout()` | js/auth.js | Cierre de sesión con confirmación |
| `cambiarPassword()` | js/auth.js | Reautentica y cambia contraseña |
| `cargarUltimoNivel(planta)` | js/plantas.js | Trae el nivel más reciente de una planta (limit 1) |
| `cargarUltimoRegistro()` | js/plantas.js | Trae el último registro de cada planta (7 queries en paralelo con Promise.all, limit 1 c/u) |
| `guardarPlanta(planta)` | js/plantas.js | Guarda registro en Firestore y limpia el formulario |
| `verHistorial(planta)` | js/plantas.js | Abre modal con últimas 48hs, cursor-based pagination |
| `cargarMasHistorial(planta)` | js/plantas.js | Carga 20 registros más usando startAfter |
| `editarRegistro(docId, planta)` | js/plantas.js | Abre modal de edición — usa `getDoc` directo por docId |
| `cargarNovedadesSupervisor()` | js/supervisor.js | Carga novedades por rango de timestamp: 7 días default, fecha específica, o keyword+rango. Planta y keyword se filtran localmente |
| `supOnFecha()` | js/supervisor.js | Limpia keyword y dispara carga por fecha específica |
| `supOnKeyword()` | js/supervisor.js | Limpia fecha y dispara búsqueda por keyword con debounce 400ms |
| `cargarDatosParte()` | js/parte.js | Carga automáticos al abrir el parte (acumulados, químicos, cierre micro) |
| `generarPartePDF()` | js/parte.js | Guarda parte en Firestore y genera HTML para imprimir/compartir |
| `calcTotal(campo)` | js/parte.js | Calcula total (actual − anterior) en una fila del parte; llamado desde oninput HTML |
| `renderDiagrama()` | js/diagrama.js | Inicializa el diagrama: lee Firestore (más reciente), setea fecha, muestra vista inteligente. Si no hay datos muestra "Sin diagrama cargado" |
| `setVistasDiagrama(vista)` | js/diagrama.js | Alterna entre vista inteligente y tabla completa |
| `renderDiagramaSemana()` | js/diagrama.js | Renderiza los 3 días desde la fecha seleccionada |
| `cargarDiagrama()` | js/diagrama.js | Admin: sube JSON de diagrama a Firestore colección `diagramas` |
| `eliminarDiagrama()` | js/diagrama.js | Admin: elimina el documento más reciente de `diagramas` y muestra "Sin diagrama cargado" |
| `showToast(msg, isError)` | js/ui.js | Toast de notificación |
| `setSyncStatus(type, text)` | js/ui.js | Indicador online/offline/syncing del header |
| `mostrarWelcome(nombre)` | js/ui.js | Splash de bienvenida (1 vez por día) |
| `showPlant(id, btn)` | js/main.js | Navega entre paneles de plantas |

---

## Historial de sesiones

### Sesión 2026-05-26 — autenticación dinámica y deploy
- `onAuthStateChanged` migrado a async: lee nombre y rol desde Firestore `usuarios/{uid}`
- Eliminados objetos hardcodeados — Firestore es la única fuente de verdad
- Si UID no existe en Firestore: cierra sesión y muestra "Usuario no habilitado"
- `assets/firebase-config.js` commiteado (necesario para GitHub Pages)
- PDF del parte nocturno: corregidos bugs de encoding, encabezados y fila TOTAL INTERPLANTAS

### Sesión 2026-05-27 — performance, bugs y UX
- `limit(1)` en `cargarUltimoNivel` y `cargarUltimoRegistro` — evita descargar toda la colección
- Fix logout inesperado: separado "UID no existe" de "Firestore no respondió", retry automático al volver online
- Historial con paginación por cursor (`startAfter`): carga inicial 48hs, luego lotes de 20
- Pantalla supervisor: `<input type="date">` + selector de planta en lugar de Hoy/Ayer/Semana

### Sesión 2026-05-30 — diagrama de turnos + modularización completa

**Diagrama de turnos** (`c7da44e`)
- Nueva pestaña `📅 DIAGRAMA` en la nav
- Vista inteligente: hoy + 2 días, turno propio, compañeros por categoría, badge "puede cubrir"
- Vista tabla: tabla completa del mes con celdas de 12hs destacadas
- ~~Datos hardcodeados en `JSON_PRUEBA`~~ — resuelto en sesión 2026-05-31

**Modularización — completada:**

| Paso | Archivo | Commit |
|---|---|---|
| 1 | `css/estilos.css` | `52cf09e` |
| 2 | `js/firebase-init.js` | `52cf09e` |
| 3 | `js/ui.js` | `52cf09e` |
| 4 | `js/plantas.js` | `29b6f91` |
| 5 | `js/supervisor.js` | `29b6f91` |
| 6 | `js/auth.js` | `29b6f91` |
| 7 | `js/parte.js` | `d5d57d7` |
| 8 | `js/diagrama.js` | `d5d57d7` |
| 9 | `js/main.js` | `d5d57d7` |

### Sesión 2026-06-04 — performance, seguridad y supervisor renovado (`79ce039`)

**Performance**
- `cargarUltimoRegistro`: reemplazado `for...of` con `await` por `Promise.all` — 7 queries en paralelo, login ~1s más rápido
- `editarRegistro`: reemplazada query completa por `getDoc(doc(db,'registros',docId))` directo — 10× más rápido

**Seguridad**
- `escapeHtml()` agregada en `js/plantas.js` — aplicada a todos los campos de usuario en `renderHistorial` (datos, fecha, turno, recorredor, vuelta, hora)

**Pantalla supervisor renovada**
- Carga inicial automática: últimos 7 días sin necesidad de seleccionar filtros
- Filtro por fecha: query a Firestore por rango de timestamp del día seleccionado (no filtro local)
- Búsqueda por keyword: campo de texto con debounce 400ms, busca en `datos.Novedades`; rango "Última semana" / "Último mes" siempre visible
- Palabras encontradas se resaltan en amarillo en los resultados
- Fecha y keyword son mutuamente excluyentes (limpian el otro al activarse)
- Filtro por planta siempre aplicado localmente en combinación con cualquier modo
- Cache busting actualizado a `v=20260604`

---

### Sesión 2026-05-31 — diagrama conectado a Firestore (`8d5fba5`)

- `renderDiagrama()` ya no usa `JSON_PRUEBA` hardcodeado — siempre lee Firestore con `orderBy('timestamp','desc'), limit(1)`
- Si la colección `diagramas` está vacía (o el doc fue borrado), ambas vistas muestran "Sin diagrama cargado" en lugar de datos viejos
- Nueva función `eliminarDiagrama()`: solo visible para admin, elimina el doc más reciente por ID y limpia la vista
- `diagramaActualId` trackea el ID del doc cargado para poder eliminarlo sin hacer una segunda query
- Cache busting: todos los imports actualizados a `v=20260531`

---

### Sesión 2026-05-30 (continuación) — deploy móvil, caché y estabilidad

**Problema de rutas absolutas en móvil** (`1839d66`)
- La app cargaba en PC pero no en celular — quedaba en "Iniciando..."
- Causa: imports con rutas absolutas `/js/firebase-init.js` fallaban en GitHub Pages móvil
- Fix: cambiar todas las rutas a relativas `./firebase-init.js` en los 6 módulos JS e `index.html`

**Cache busting** (`bb96823`, `d553a62`)
- Problema: browser móvil cacheaba versiones viejas de los módulos JS
- Fix 1: `?v=YYYYMMDD` en todos los imports locales (rompe caché CDN)
- Fix 2: Service Worker `sw.js` con network-first para JS locales (automático en deploys futuros)
- Regla: actualizar la fecha `?v=` en cada deploy que cambie archivos JS

**Diagnóstico de errores en móvil sin DevTools**
- Técnica usada: panel de debug temporal en el `loading-overlay` (div fijo en pantalla)
- Capturaba `window.onerror`, `onunhandledrejection`, `console.error`, `console.warn` desde `<head>`
- Importante: el panel debe estar en el `loading-overlay`, NO en el login card — el login no se ve si los módulos fallan
- Eliminado una vez resuelto el problema (`bb96823`)

**Error `permission-denied` de Firestore**
- Apareció en el panel de debug — era del código viejo en caché ejecutándose sin auth
- Las reglas de Firestore son correctas (`allow read, write: if request.auth != null`)
- Desapareció al limpiar caché + SW instalado

**Fix de dependencia frágil entre módulos** (`07e751a`)
- `auth.js` llamaba a `window.cargarNovedadesSupervisor()` dependiendo del orden de imports en `main.js`
- Fix: `supervisor.js` ahora exporta `cargarNovedadesSupervisor`; `auth.js` la importa directamente
- `window.cargarNovedadesSupervisor` se mantiene asignado en `supervisor.js` para los `onchange` del HTML

---

### Sesión 2026-06-04 (fix) — doble encoding UTF-8 en index.html (`a16bbc4`)

**Causa del bug**
- El commit `79ce039` guardó `index.html` con UTF-8 BOM + doble encoding: el editor abrió el archivo como Latin-1, lo que convirtió cada byte multibyte en un carácter Latin-1; al guardar en UTF-8, cada uno de esos caracteres se volvió a encodear, produciendo secuencias rotas (`Ã"` en lugar de `Ó`, `ðŸ"„` en lugar de 🔄, etc.)
- Afectaba todo el archivo — 315 líneas con emojis, tildes y ñ

**Diagnóstico**
1. `file index.html` reveló "UTF-8 (with BOM)" — señal de que el editor agregó BOM
2. `git diff <commit-bueno> <commit-roto> -- index.html` confirmó la corrupción masiva vs. el commit anterior limpio
3. `git show <commit-bueno>:index.html | head -35` mostró los caracteres correctos — el problema era solo del commit reciente

**Fix aplicado**
- Restaurar desde el commit limpio: `git show 8d5fba5:index.html > index.html`
- Aplicar manualmente los cambios funcionales reales del commit roto: versión `?v=20260604` en `main.js` y el nuevo HTML del supervisor (keyword + rango) en encoding correcto

**Regla aprendida — encoding en este proyecto**
- `index.html` debe ser **UTF-8 sin BOM** — verificar con `file index.html` antes de cada commit
- Si el output muestra `UTF-8 (with BOM)`: el archivo fue abierto como Latin-1 y re-guardado → todo el contenido con caracteres no-ASCII está corrupto
- Señal de alerta rápida: `grep -c "Ã\|ðŸ\|â€" index.html` — si devuelve > 0, hay doble encoding
- Causa más probable: editor configurado para abrir archivos como Windows-1252/Latin-1 en vez de UTF-8

---

## Pendientes — ordenados por prioridad

### Funcionalidades nuevas

1. **Exportación CSV/Excel de registros** — media complejidad
2. **Tests de funciones de cálculo** — media complejidad
3. **Manejo de conflictos multi-usuario** — alta complejidad

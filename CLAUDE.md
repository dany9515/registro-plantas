# OilLog — Contexto del proyecto

PWA de registro operacional para pozos de captación y plantas de petróleo.
Stack: HTML/CSS/JS vanilla + Firebase (Auth + Firestore). Modularización completa.

- **Repo:** https://github.com/dany9515/registro-plantas (rama `main`)
- **Producción:** https://oillog.operlog.com.ar (GitHub Pages + dominio propio)
- **Firebase proyecto:** `registroplantas-7dc06`
- **Credenciales Firebase:** `assets/firebase-config.js` (commiteado — son públicas por diseño en apps web)

---

## Arquitectura general

- Login con Firebase Auth (email/password)
- Al autenticar, lee `usuarios/{uid}` en Firestore para obtener `nombre` y `rol`
- Roles: `recorredor` (acceso completo) y `supervisor` (solo novedades)
- Registros guardados en colección `registros`, partes nocturnos en `partes`
- Sin backend propio — todo directo a Firestore desde el cliente
- Entry point: `<script type="module" src="/js/main.js">` — carga todos los módulos

### Colecciones Firestore

| Colección | Descripción |
|---|---|
| `usuarios` | Documento por UID con campos `nombre` y `rol` |
| `registros` | Un doc por guardado de planta. Campos: `planta`, `fecha`, `turno`, `vuelta`, `hora`, `recorredor`, `datos` (objeto), `timestamp`, `userEmail`, `editado` |
| `partes` | Partes nocturnos. Campos: `fecha`, `hora`, `rec1`, `rec2`, `acumulados`, `niveles`, `quimicos`, `timestamp`, `userEmail` |
| `diagramas` | Diagramas de turno. Campos: `mes`, `mesNombre`, `datos` (array), `timestamp`, `cargadoPor` |

### Plantas disponibles
`23T`, `17T`, `PPA`, `ED1`, `EC19`, `AGUADA`, `O87`

---

## Estructura de archivos

```
css/
  estilos.css           ← todo el CSS (296 líneas)
js/
  firebase-init.js      ← exports: auth, db
  ui.js                 ← exports: showToast, setSyncStatus, mostrarWelcome
  plantas.js            ← exports: cargarUltimoNivel, cargarUltimoRegistro, ultimoRegistroPorPlanta
  supervisor.js         ← side-effect: window.cargarNovedadesSupervisor
  auth.js               ← side-effect: onAuthStateChanged bootstrap, window.doLogin/doLogout/cambiarPassword
  parte.js              ← side-effect: window.calcTotal, cargarDatosParte, generarPartePDF, verUltimoPDF
  diagrama.js           ← side-effect: window.renderDiagrama, setVistasDiagrama, renderDiagramaSemana, irHoy, cargarDiagrama
  main.js               ← entry point: plant nav listener, window.showPlant
index.html              ← solo HTML + <script type="module" src="/js/main.js"> (1308 líneas)
```

### Grafo de dependencias
```
main.js
  ├── plantas.js → firebase-init.js, ui.js
  ├── supervisor.js → firebase-init.js, ui.js
  ├── auth.js → firebase-init.js, ui.js
  ├── parte.js → firebase-init.js, ui.js, plantas.js (ultimoRegistroPorPlanta)
  └── diagrama.js → firebase-init.js, ui.js
```

**Nota importante:** Los módulos requieren servidor local (`http://`). No funcionan con `file://`.

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
| `cargarUltimoRegistro()` | js/plantas.js | Trae el último registro de cada planta (7 queries en serie, limit 1 c/u) |
| `guardarPlanta(planta)` | js/plantas.js | Guarda registro en Firestore y limpia el formulario |
| `verHistorial(planta)` | js/plantas.js | Abre modal con últimas 48hs, cursor-based pagination |
| `cargarMasHistorial(planta)` | js/plantas.js | Carga 20 registros más usando startAfter |
| `editarRegistro(docId, planta)` | js/plantas.js | Abre modal de edición (hace query completa — pendiente de optimizar) |
| `cargarNovedadesSupervisor()` | js/supervisor.js | Filtra novedades por fecha y planta (descarga toda la colección — pendiente de limitar) |
| `cargarDatosParte()` | js/parte.js | Carga automáticos al abrir el parte (acumulados, químicos, cierre micro) |
| `generarPartePDF()` | js/parte.js | Guarda parte en Firestore y genera HTML para imprimir/compartir |
| `calcTotal(campo)` | js/parte.js | Calcula total (actual − anterior) en una fila del parte; llamado desde oninput HTML |
| `renderDiagrama()` | js/diagrama.js | Inicializa el diagrama (carga JSON_PRUEBA, setea fecha, muestra vista inteligente) |
| `setVistasDiagrama(vista)` | js/diagrama.js | Alterna entre vista inteligente y tabla completa |
| `renderDiagramaSemana()` | js/diagrama.js | Renderiza los 3 días desde la fecha seleccionada |
| `cargarDiagrama()` | js/diagrama.js | Admin: sube JSON de diagrama a Firestore colección `diagramas` |
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
- Datos hardcodeados en `JSON_PRUEBA` — pendiente cargar desde Firestore colección `diagramas`

**Modularización — completada en esta sesión:**

| Paso | Archivo | Commits |
|---|---|---|
| 1 | `css/estilos.css` | `52cf09e` |
| 2 | `js/firebase-init.js` | `52cf09e` |
| 3 | `js/ui.js` | `52cf09e` |
| 4 | `js/plantas.js` | `29b6f91` |
| 5 | `js/supervisor.js` | `29b6f91` |
| 6 | `js/auth.js` | `29b6f91` |
| 7 | `js/parte.js` | pendiente commit |
| 8 | `js/diagrama.js` | pendiente commit |
| 9 | `js/main.js` | pendiente commit |

---

## Pendientes — ordenados por prioridad

### Mejoras técnicas (rápidas, bajo riesgo)

1. **`cargarUltimoRegistro` en serie → `Promise.all`**
   - 7 queries con `await` en `for...of` → van de a una
   - Cambiar a `Promise.all(plantas.map(...))` → van en paralelo
   - Archivo: `js/plantas.js` — función `cargarUltimoRegistro`
   - Impacto: login ~1s más rápido

2. **`editarRegistro` usa query completa para buscar un doc por ID**
   - Hace `getDocs(query(...where planta==X...))` y busca el ID en el array
   - Cambiar a `getDoc(doc(db,'registros',docId))` directo
   - Archivo: `js/plantas.js` — función `editarRegistro`
   - Una línea de cambio, 10× más rápido

3. **`cargarNovedadesSupervisor` sin límite**
   - Descarga toda la colección `registros` sin `limit`
   - Agregar `limit(200)` como techo razonable
   - Archivo: `js/supervisor.js`

4. **XSS leve en historial**
   - Campo `Novedades` se inserta como `innerHTML` sin escapar
   - Archivo: `js/plantas.js` — función `renderHistorial`
   - Riesgo bajo (sistema interno), pero vale corregir

5. **Diagrama: cargar desde Firestore en lugar de `JSON_PRUEBA` hardcodeado**
   - `renderDiagrama` usa datos estáticos
   - Leer de colección `diagramas`, ordenar por `timestamp desc`, tomar el más reciente
   - Archivo: `js/diagrama.js` — función `renderDiagrama`

### Funcionalidades nuevas

6. **Modo offline / Service Worker** — alta complejidad
7. **Exportación CSV/Excel de registros** — media complejidad
8. **Tests de funciones de cálculo** — media complejidad
9. **Manejo de conflictos multi-usuario** — alta complejidad

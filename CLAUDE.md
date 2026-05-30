# OilLog — Contexto del proyecto

PWA de registro operacional para pozos de captación y plantas de petróleo.
Stack: HTML/CSS/JS vanilla + Firebase (Auth + Firestore). En proceso de modularización — ver sección 2026-05-30.

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

### Colecciones Firestore

| Colección | Descripción |
|---|---|
| `usuarios` | Documento por UID con campos `nombre` y `rol` |
| `registros` | Un doc por guardado de planta. Campos: `planta`, `fecha`, `turno`, `vuelta`, `hora`, `recorredor`, `datos` (objeto), `timestamp`, `userEmail`, `editado` |
| `partes` | Partes nocturnos. Campos: `fecha`, `hora`, `rec1`, `rec2`, `acumulados`, `niveles`, `quimicos`, `timestamp`, `userEmail` |

### Plantas disponibles
`23T`, `17T`, `PPA`, `ED1`, `EC19`, `AGUADA`, `O87`

---

## Sesión 2026-05-26 — autenticación dinámica y deploy

- `onAuthStateChanged` migrado a async: lee nombre y rol desde Firestore `usuarios/{uid}`
- Eliminados objetos hardcodeados `recorredores` y `supervisores` — Firestore es la única fuente de verdad
- Si UID no existe en Firestore: cierra sesión y muestra "Usuario no habilitado"
- `assets/firebase-config.js` sacado del `.gitignore` y commiteado (necesario para GitHub Pages)
- PDF del parte nocturno: corregidos bugs de encoding, encabezados y fila TOTAL INTERPLANTAS
- Corrección de etiquetas del formulario: "Ingreso 17T", eliminación de "A Planta PT"

---

## Sesión 2026-05-27 — performance, bugs y UX

### Commits realizados

| Hash | Descripción |
|---|---|
| `8312f74` | `limit(1)` en `cargarUltimoNivel` y `cargarUltimoRegistro` — evita descargar toda la colección al iniciar |
| `4dd7bde` | Fix logout inesperado por error de red en `onAuthStateChanged` |
| `05582c9` | Historial con paginación por cursor (`startAfter`) y botón "Ver registros anteriores" |
| `6f9aebf` | Pantalla supervisor: input date + selector de planta reemplazan el selector Hoy/Ayer/Semana |

### Detalle de cambios

**`limit(1)` en queries de nivel** (`8312f74`)
- `cargarUltimoNivel` y `cargarUltimoRegistro` traían toda la colección para usar solo el primer doc
- Agregado `limit(1)` — reduce lecturas a 1 doc por planta en lugar de N
- Agregado `limit` al import de Firestore

**Fix logout por error de red** (`4dd7bde`)
- El `catch(e) {}` vacío en `onAuthStateChanged` mezclaba "UID no existe" con "Firestore no respondió"
- Extraída función `iniciarConUsuario(user)` que puede llamarse a sí misma al volver la conexión
- Si `getDoc` lanza excepción (red): muestra "Sin conexión. Reintentando..." + `window.addEventListener('online', ..., {once:true})`
- Si `getDoc` resuelve pero el doc no existe: cierra sesión con "Usuario no habilitado"

**Historial con paginación por cursor** (`05582c9`)
- Antes: una query sin límite que descargaba toda la historia de cada planta
- Ahora: carga inicial de las últimas 48hs; cada click en "Ver registros anteriores" usa `startAfter(lastDoc) + limit(20)`
- Si las 48hs están vacías: muestra el botón para buscar registros anteriores sin filtro de fecha
- Si no hay más registros: muestra "No hay registros anteriores" en lugar del botón
- Agregado `startAfter` al import de Firestore
- Agregado CSS `.historial-cargar-mas`

**Pantalla supervisor** (`6f9aebf`)
- Reemplazado `<select>` Hoy/Ayer/Semana por `<input type="date">` con `color-scheme:dark`
- Agregado `<select id="sup-planta">` con opciones: Todas, 23T, 17T, PPA, ED1, EC19, AGUADA, O87
- Fecha se inicializa en hoy automáticamente al loguear como supervisor
- Filtros combinables: fecha exacta AND planta (si es "Todas", no filtra por planta)
- Conversión interna YYYY-MM-DD → DD/MM/YYYY para comparar contra `r.fecha`

---

## Sesión 2026-05-30 — diagrama de turnos + modularización (en curso)

### Cambios de funcionalidad

**Diagrama de turnos** (`c7da44e`)
- Nueva pestaña `📅 DIAGRAMA` en la nav de plantas
- Vista inteligente: muestra hoy + 2 días siguientes, turno propio, compañeros agrupados por categoría, badge "puede cubrir" para los de FRANCO con descanso válido
- Vista tabla: tabla completa del mes; celdas de 12hs (`6-12`, `18-12`) con fondo intenso + borde `box-shadow inset` + negrita
- Datos hardcodeados en `JSON_PRUEBA` (pendiente: cargar desde Firestore colección `diagramas`)
- Carga admin oculta para subir JSON del diagrama a Firestore

### Modularización — estado al cierre de sesión

**Estrategia:** un archivo por vez, probando entre cada paso. Requiere servidor local (no funciona con `file://`).

**Plan completo (9 pasos):**

| Paso | Archivo | Estado |
|---|---|---|
| 1 | `css/estilos.css` | ✅ Extraído y verificado |
| 2 | `js/firebase-init.js` | ✅ Extraído y verificado |
| 3 | `js/ui.js` | ✅ Extraído y verificado |
| 4 | `js/plantas.js` | ✅ Extraído y verificado |
| 5 | `js/supervisor.js` | ✅ Extraído y verificado |
| 6 | `js/auth.js` | ✅ Extraído y verificado |
| 7 | `js/parte.js` | ⏳ Pendiente |
| 8 | `js/diagrama.js` | ⏳ Pendiente |
| 9 | `js/main.js` (entry point) | ⏳ Pendiente |

**Estructura actual de archivos:**
```
css/
  estilos.css         ← 296 líneas (todo el CSS)
js/
  firebase-init.js    ← exports: auth, db
  ui.js               ← exports: showToast, setSyncStatus, mostrarWelcome
  plantas.js          ← exports: cargarUltimoNivel, cargarUltimoRegistro
  supervisor.js       ← side-effect: window.cargarNovedadesSupervisor
  auth.js             ← side-effect: onAuthStateChanged bootstrap, window.doLogin/doLogout/cambiarPassword
index.html            ← 1881 líneas (bajó de 3315)
```

**Dependencias de imports en index.html `<script type="module">`:**
```
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from firebase-firestore
import { auth, db } from '/js/firebase-init.js'
import { showToast, setSyncStatus } from '/js/ui.js'
import { cargarUltimoNivel } from '/js/plantas.js'
import '/js/supervisor.js'
import '/js/auth.js'
```

**Lo que queda en `index.html` pendiente de extraer:**
- Parte nocturno completo → `js/parte.js`
- Diagrama de turnos completo → `js/diagrama.js`
- `plantMap`, `showPlant`, plant nav listener → `js/main.js`

---

## Estado actual del código

### Funciones clave

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
| `generarPartePDF()` | index.html | Guarda parte en Firestore y genera HTML para imprimir/compartir |
| `cargarNovedadesSupervisor()` | js/supervisor.js | Filtra novedades por fecha y planta (descarga toda la colección — pendiente de limitar) |
| `showToast(msg, isError)` | js/ui.js | Toast de notificación |
| `setSyncStatus(type, text)` | js/ui.js | Indicador online/offline/syncing del header |
| `mostrarWelcome(nombre)` | js/ui.js | Splash de bienvenida (1 vez por día) |

---

## Pendientes — ordenados por prioridad

### Modularización (en curso)
- Continuar desde Paso 4: `js/plantas.js` — ver tabla de estado arriba

### Mejoras técnicas (rápidas, bajo riesgo)

1. **`cargarUltimoRegistro` y `cargarAcumuladosActuales` en serie → `Promise.all`**
   - 7 + 4 queries con `await` en un `for...of` → van de a una
   - Cambiar a `Promise.all(plantas.map(...))` → van en paralelo
   - Impacto: login ~1s más rápido

2. **`editarRegistro` usa query completa para buscar un doc por ID**
   - Hace `getDocs(query(...where planta==X...))` y busca el ID en el array
   - Cambiar a `getDoc(doc(db,'registros',docId))` directo
   - Una línea de cambio, 10× más rápido

3. **`cargarNovedadesSupervisor` sin límite**
   - Descarga toda la colección `registros` sin `limit`
   - Agregar `limit(200)` como techo razonable
   - Impacto creciente con el tiempo

4. **XSS leve en historial**
   - Campo `Novedades` se inserta como `innerHTML` sin escapar
   - Riesgo bajo (sistema interno), pero vale corregir

5. **Diagrama: cargar desde Firestore en lugar de JSON_PRUEBA hardcodeado**
   - `renderDiagrama` actualmente usa datos estáticos
   - Leer de colección `diagramas`, ordenar por `timestamp desc`, tomar el más reciente

### Funcionalidades nuevas

6. **Modo offline / Service Worker** — alta complejidad
7. **Exportación CSV/Excel de registros** — media complejidad
8. **Tests de funciones de cálculo** — media complejidad
9. **Manejo de conflictos multi-usuario** — alta complejidad

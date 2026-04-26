# NEXUS CORE ⚔️

Panel de gestión para la familia de clanes **NEXUS CORE** de Clash of Clans. Registra guerras, CWL, donaciones y rotaciones de Capital Raid en tiempo real, sincronizado con Google Sheets.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript vanilla (sin frameworks) |
| Base de datos | Google Sheets |
| API | Google Apps Script (Web App) |
| Hosting | Vercel |

---

## Clanes

| Clan | Tag | TH mínimo |
|---|---|---|
| The Crushers | `#2RQYUQY0P` | TH 16+ |
| NorthWestern | `#2GY2Q9GQ0` | TH 13+ |
| XxMEXICOxX | `#28Q9R0LRU` | TH 9+ |
| Algo Tranqui | `#2JQR92PRG` | TH 7+ |

---

## Funcionalidades

### Autenticación y roles
- Login con usuario y contraseña gestionados en Google Sheets
- **Super líder** — acceso total, puede editar todos los clanes y ejecutar el sorteo
- **Líder** — solo puede editar el clan que tiene asignado, el resto es solo lectura

### Dashboard principal
- Estadísticas globales de los 4 clanes (miembros, guerras, victorias, aptos para sorteo)
- Tarjetas por clan con resumen de actividad
- Log de actividad reciente del sistema

### Por clan
- Lista de miembros con tag de CoC, ataques en war, ataques en CWL, espejos y donaciones
- Historial de guerras y CWL con resultado y estrellas
- Barra de progreso de ataques por miembro
- Indicador de aptitud para el sorteo

### Registro de War
- Marca por miembro si entró a la guerra y cuántos ataques realizó (0, 1 o 2)
- Acumula datos sobre el histórico del miembro

### Registro de CWL
- Marca si el miembro entró a la temporada, si atacó a su espejo y cuántos ataques realizó (1–7)
- Meta: 8+ estrellas por miembro en los 7 días de CWL

### Donaciones
- Registro semanal por miembro
- Estrella ★ automática al superar 1000 donaciones acumuladas en el mes
- La estrella reacciona en tiempo real mientras se escribe el número

### Rotaciones Capital Raid
- Registra jugadores que atacan en otro clan durante el fin de semana
- Usa el **tag de CoC** como identificador único para acreditar donaciones al clan de origen
- Historial completo de visitas entre clanes

### Sorteo mensual
- Solo ejecutable por el super líder
- Participan miembros que completaron todos sus ataques en war y tienen 100+ donaciones
- Sorteo aleatorio con Fisher-Yates shuffle entre los aptos de los 4 clanes
- 3 pases de oro como premio

---

## Estructura del proyecto

```
nexus-core/
├── index.html              ← App principal (shell HTML)
├── README.md
├── assets/
│   ├── css/
│   │   └── styles.css      ← Estilos (dark/light mode, responsive)
│   └── js/
│       ├── auth.js         ← Login, sesión y permisos por rol
│       ├── api.js          ← Comunicación con Google Apps Script
│       ├── store.js        ← Estado global centralizado
│       ├── war.js          ← Registro de War y CWL
│       ├── donations.js    ← Donaciones semanales
│       ├── rotations.js    ← Rotaciones Capital Raid
│       ├── sorteo.js       ← Sorteo mensual
│       └── app.js          ← Renderizado UI y navegación
└── backend/
    └── Code.gs             ← Google Apps Script (API + base de datos)
```

### Orden de carga de scripts

El orden importa — cada módulo depende del anterior:

```
auth.js → api.js → store.js → war.js → donations.js → rotations.js → sorteo.js → app.js
```

---

## Configuración inicial

### 1. Google Sheets

1. Crea una Google Sheet nueva
2. Ve a **Extensions → Apps Script**
3. Pega el contenido de `backend/Code.gs`
4. Guarda con `Ctrl+S`
5. Ejecuta la función `setup()` manualmente desde el editor — esto crea todas las pestañas automáticamente
6. Ve a **Deploy → New deployment**
   - Type: `Web App`
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Copia la URL generada

### 2. Usuarios

Edita la pestaña `Usuarios` en tu Google Sheet:

| user | pass | role | name | clan |
|---|---|---|---|---|
| turpial | nexus2024 | super | Turpial | *(vacío)* |
| lider1 | clan1234 | leader | Nombre | crushers |
| lider2 | clan1234 | leader | Nombre | northwestern |
| lider3 | clan1234 | leader | Nombre | mexico |
| lider4 | clan1234 | leader | Nombre | tranqui |

> Los valores de `clan` deben ser exactamente: `crushers`, `northwestern`, `mexico`, `tranqui`.
> El super líder deja la columna `clan` vacía.

### 3. Cargar miembros masivamente

Pega los miembros directamente en las pestañas `Miembros_crushers`, `Miembros_northwestern`, `Miembros_mexico`, `Miembros_tranqui`. La fila 1 tiene los encabezados — no la borres.

Columnas requeridas:

```
id | name | tag | role | warTotal | warAttacks | cwlTotal | cwlAtkTotal | cwlMirrors | donTotal
```

- **id** — número único por clan (1, 2, 3...)
- **tag** — tag de CoC con `#` incluido en mayúsculas (ej. `#ABC123`)
- **role** — `Miembro`, `Colidér` o `Líder`
- Todos los contadores en `0` para miembros nuevos

### 4. Conectar al dashboard

1. Abre la app en el navegador
2. Inicia sesión con `turpial` / `nexus2024`
3. Ve a **Configuración**
4. Pega la URL del Apps Script
5. Click en **Conectar**
6. Usa el botón **↻** para sincronizar en cualquier momento

---

## Deploy en Vercel

```bash
# 1. Clona el repo
git clone https://github.com/tu-usuario/nexus-core.git
cd nexus-core

# 2. Instala Vercel CLI (opcional, también puedes conectar desde vercel.com)
npm i -g vercel

# 3. Deploy
vercel
```

O conecta el repositorio directamente desde [vercel.com](https://vercel.com) — detecta automáticamente que es un sitio estático.

La URL quedará en formato: `nexus-core.vercel.app`

---

## Flujo de uso semanal

```
Lunes–Viernes   →  Registrar guerras y CWL día a día
Fin de semana   →  Registrar rotaciones Capital Raid
Cada semana     →  Registrar donaciones de cada miembro
Fin de mes      →  Turpial ejecuta el sorteo con los miembros aptos
```

---

## Criterios del sorteo

Un miembro es apto si cumple **ambas** condiciones:

- Realizó el **100% de sus ataques** en todas las guerras del mes
- Acumuló **100 o más donaciones** en el mes

---

## Credenciales por defecto

> ⚠️ Cámbialas en la pestaña `Usuarios` de Google Sheets antes de compartir el link.

| Usuario | Contraseña | Rol |
|---|---|---|
| `turpial` | `nexus2024` | Super líder |
| `lider1` | `clan1234` | Líder |
| `lider2` | `clan1234` | Líder |
| `lider3` | `clan1234` | Líder |
| `lider4` | `clan1234` | Líder |

---

*NEXUS CORE — Donde se forjan los mejores clanes ⚔️🔥*
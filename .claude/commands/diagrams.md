# /diagrams — Agente de Diagramas y Visualización de Arquitectura

Eres el responsable de traducir arquitectura, flujos y estructuras complejas en diagramas claros.
Usas Mermaid como formato principal — vive en el repositorio, se versiona con el código, se renderiza en GitHub y en las docs.

**Regla:** Un diagrama debe poder leerse en 30 segundos. Si es más complejo, dividirlo.
**Regla:** Siempre leer el código antes de diagramar. Los diagramas deben reflejar la realidad, no la intención.

---

## Tipos de diagramas y cuándo usarlos

### 1. Diagrama de arquitectura del sistema

**Cuándo:** Al inicio del proyecto, cuando cambia la arquitectura, o cuando se incorpora alguien nuevo.

```mermaid
graph TB
    subgraph "Vercel"
        L["apps/landing\nNext.js 16\npuerto 3000"]
        B["apps/backoffice\nNext.js 16\npuerto 3001"]
    end

    subgraph "Supabase"
        DB[(PostgreSQL)]
        AUTH[Auth]
        STORAGE[Storage]
    end

    subgraph "Packages"
        SHARED["@repo/shared\nlógica de negocio"]
        UI["@repo/ui\ndesign system"]
        APILOGIC["@repo/api-logic\nagregaciones"]
    end

    L --> SHARED
    B --> SHARED
    L --> UI
    B --> UI
    B --> APILOGIC
    SHARED --> DB
    L --> AUTH
    B --> AUTH
    L --> STORAGE
    B --> STORAGE
```

Guardar en: `docs/architecture/system-overview.md`

### 2. Diagrama de flujo de negocio

**Cuándo:** Para flujos críticos: registro de asistente, flujo de pago, check-in en puerta, reserva de mesa.

```mermaid
flowchart TD
    A[Asistente abre landing] --> B{¿Hay capacidad?}
    B -- No --> C[Mostrar: Evento agotado]
    B -- Sí --> D[Formulario de registro]
    D --> E{Validar con RENIEC}
    E -- Error --> F[Mostrar error humano]
    E -- OK --> G{¿Requiere pago?}
    G -- No --> H[Generar ticket gratuito]
    G -- Sí --> I[Flujo Culqi]
    I -- Error --> J[Mostrar error de pago]
    I -- OK --> H
    H --> K[Enviar email con QR via Resend]
    K --> L[Confirmación en pantalla]
```

Guardar en: `docs/flows/[nombre-del-flujo].md`

### 3. Diagrama de secuencia

**Cuándo:** Para interacciones entre múltiples sistemas (frontend ↔ API ↔ Supabase ↔ servicio externo).

```mermaid
sequenceDiagram
    participant U as Usuario
    participant L as Landing (RSC)
    participant API as API Route
    participant SB as Supabase
    participant R as RENIEC
    participant Culqi as Culqi

    U->>L: POST /api/tickets
    L->>API: Validar Zod schema
    API->>R: Verificar DNI
    R-->>API: Datos del titular
    API->>SB: Verificar aforo (organizer_id)
    SB-->>API: Capacidad disponible
    API->>Culqi: Procesar pago
    Culqi-->>API: Confirmación
    API->>SB: INSERT ticket (organizer_id, ...)
    API-->>L: { ticketId, qrCode }
    L-->>U: Confirmación + QR
```

Guardar en: `docs/flows/[nombre-secuencia].md`

### 4. Diagrama de schema de base de datos

**Cuándo:** Cuando hay cambios de schema, para onboarding, o para entender relaciones.

```mermaid
erDiagram
    EVENTS {
        uuid id PK
        uuid organizer_id FK
        string name
        timestamptz date
        int capacity
        bool is_active
        timestamptz deleted_at
    }

    TICKETS {
        uuid id PK
        uuid event_id FK
        uuid organizer_id FK
        string holder_name
        string holder_dni
        string status
        decimal price
        timestamptz created_at
        timestamptz deleted_at
    }

    PROMOTERS {
        uuid id PK
        uuid organizer_id FK
        string name
        string code
    }

    EVENTS ||--o{ TICKETS : "tiene"
    PROMOTERS ||--o{ TICKETS : "refiere"
```

Guardar en: `docs/architecture/database-schema.md`

### 5. Diagrama de roles y permisos

**Cuándo:** Cuando cambia el sistema de roles o para documentar quién puede hacer qué.

```mermaid
graph LR
    subgraph "Roles backoffice"
        ADMIN[admin]
        CAJERO[cajero]
        PUERTA[puerta]
        PROMOTOR[promotor]
        MOSO[moso]
    end

    subgraph "Permisos"
        SCAN[Scanner QR]
        REPORTS[Reportes]
        TICKETS_MGMT[Gestión tickets]
        CODES[Códigos promo]
    end

    ADMIN --> SCAN
    ADMIN --> REPORTS
    ADMIN --> TICKETS_MGMT
    ADMIN --> CODES
    PUERTA --> SCAN
    CAJERO --> TICKETS_MGMT
    PROMOTOR --> CODES
```

Guardar en: `docs/architecture/roles-permissions.md`

---

## Proceso para crear un diagrama

### 1. Leer el código primero

Antes de diagramar cualquier flujo:
- Leer los archivos del flujo de principio a fin
- Identificar todos los actores y sistemas involucrados
- Identificar los puntos de decisión (if/else, validaciones)
- Identificar los puntos de fallo posibles

### 2. Elegir el tipo correcto

| Quiero mostrar | Tipo |
|----------------|------|
| Arquitectura general del sistema | graph TB/LR |
| Flujo de usuario con decisiones | flowchart TD |
| Interacciones entre sistemas | sequenceDiagram |
| Relaciones entre tablas | erDiagram |
| Estados de un objeto | stateDiagram-v2 |
| Jerarquía de componentes | graph TB |

### 3. Principios de claridad

- **Máximo 10-12 nodos** por diagrama. Si hay más → dividir
- **Nombrar los nodos con rol**, no con nombre técnico cuando sea para negocio
  - ❌ `L["apps/landing/app/api/tickets/route.ts"]`
  - ✅ `API["API: Crear ticket"]`
- **Agrupar en subgraphs** para separar responsabilidades
- **Usar colores con propósito** (Mermaid permite `style`)
  - Verde → éxito / happy path
  - Rojo → error
  - Amarillo → estado pendiente/decisión

### 4. Dónde guardar

```
docs/
  architecture/
    system-overview.md          → Arquitectura general
    database-schema.md          → Schema DB actualizado
    roles-permissions.md        → Roles y permisos
  flows/
    registro-asistente.md       → Flujo de registro público
    pago-culqi.md               → Flujo de pago
    scanner-checkin.md          → Flujo de check-in en puerta
    reserva-mesa.md             → Flujo de reserva
    [nuevo-flujo].md
```

---

## Modos de invocación

### `/diagrams flow [nombre]`
Diagrama del flujo de negocio indicado. Lee el código primero.

### `/diagrams architecture`
Diagrama de arquitectura general del sistema.

### `/diagrams schema [tabla o dominio]`
Diagrama ER del schema de la DB para las tablas indicadas.

### `/diagrams sequence [flujo]`
Diagrama de secuencia para interacciones entre sistemas.

### `/diagrams update [archivo]`
Actualiza un diagrama existente para reflejar cambios recientes.

---

## Cuándo escalar

- El diagrama refleja un problema arquitectónico → `/orchestrate`
- El diagrama requiere documentación adicional → `/docs`
- El diagrama refleja un bug en el flujo → `/debug`

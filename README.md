# Hyperox Panel — v2.0 (Asset-Centric)

Panel de observabilidad y gestión de infraestructura refactorizado para operar con hosts monitoreados por **Elastic Agent / Fleet**, independientemente de si pertenecen a Proxmox o son equipos externos.

---

## Cambios principales respecto a v1

| Aspecto | v1 (VM-centric) | v2 (Asset-centric) |
|---|---|---|
| Unidad de observabilidad | VM de Proxmox (`vmid`) | Host enrolado en Fleet (`fleet_agent_id`) |
| Correlación Elasticsearch | `host.name` con wildcard | `agent.id` → `host.id` → `host.name` (fallback) |
| RBAC | Basado en `proxmox_pools` | Basado en `asset_tenant_assignments` |
| Hosts externos | No soportado | Soportado nativamente |
| Inventario | Solo Proxmox | Fleet API + manual |
| API principal | `/vms/:vmid/observability/*` | `/assets/:id/observability/*` |
| Compatibilidad | — | `/vms/:vmid/*` sigue funcionando (Fase 1-2) |

---

## Requisitos

- Docker y Docker Compose v2
- Elastic Stack corriendo (Elasticsearch + Kibana + Fleet)
- Proxmox (opcional, solo para Dominio A)
- Elastic Agent instalado en los hosts a monitorear

---

## Configuración rápida

### 1. Clonar y editar variables de entorno

Edita `docker-compose.yml` y ajusta los valores de tu entorno:

```yaml
# Elastic Stack
KIBANA_BASE_URL: http://TU_KIBANA:5601
ELASTICSEARCH_URL: https://TU_ELASTIC:9200
ELASTICSEARCH_USERNAME: elastic
ELASTICSEARCH_PASSWORD: "TU_PASSWORD"
ELASTICSEARCH_INSECURE: "true"   # false si tienes cert válido

# Fleet (si Fleet usa autenticación distinta a Elastic)
FLEET_URL: ""          # vacío = usa KIBANA_BASE_URL
FLEET_API_KEY: ""      # vacío = usa credenciales de Elastic

# Proxmox (opcional)
PROXMOX_URL: https://TU_PROXMOX:8006/api2/json
PROXMOX_TOKEN: "PVEAPIToken=root@pam!TU_TOKEN"
PROXMOX_NODE: TU_NODO
PROXMOX_HOST: TU_PROXMOX_IP
```

### 2. Levantar el stack

```bash
docker compose up -d --build
```

El primer build tarda ~3-5 minutos (instala dependencias y compila TypeScript).

### 3. Aplicar migraciones de base de datos

```bash
# Esperar que el backend esté corriendo
docker compose exec backend npx prisma migrate dev --name init
```

Si la base de datos ya tiene datos de v1, usar:

```bash
docker compose exec backend npx prisma migrate deploy
```

### 4. Sincronizar agentes desde Fleet

Una vez que el stack esté corriendo, hacer login con una cuenta `platform_admin` y ejecutar:

```bash
POST /api/fleet/sync
Authorization: Bearer <token>
```

O desde la UI de admin (próximamente).

---

## Estructura del proyecto

```
panel-refactored/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Modelo de datos completo
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── assets.controller.ts       # /assets/* + /admin/assets/*
│   │   │   ├── fleet.controller.ts        # /fleet/*
│   │   │   ├── infrastructure.controller.ts  # /infra/vms/* + compat /vms/*
│   │   │   ├── auth.controller.ts
│   │   │   └── admin.controller.ts
│   │   ├── services/
│   │   │   ├── identity-resolver.service.ts  # ⭐ núcleo del refactor
│   │   │   ├── assets.service.ts             # RBAC desacoplado de Proxmox
│   │   │   ├── fleet.service.ts              # Integración Fleet API
│   │   │   ├── fleet-sync.job.ts             # Sincronización periódica
│   │   │   ├── observability-native.service.ts  # Queries Elasticsearch
│   │   │   ├── elasticsearch.service.ts
│   │   │   ├── proxmox.service.ts
│   │   │   ├── prisma.service.ts
│   │   │   ├── audit.service.ts
│   │   │   └── keycloak-admin.service.ts
│   │   ├── guards/
│   │   │   └── auth.guard.ts
│   │   ├── shared/types/
│   │   │   └── asset-identity.ts
│   │   └── main.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── pages/
│   │   ├── assets/
│   │   │   ├── index.js           # Lista de activos monitoreados
│   │   │   └── [id].js            # Detalle + observabilidad
│   │   ├── vms/
│   │   │   └── [vmid].js          # Detalle VM con observabilidad (compat)
│   │   ├── vms.js                 # Lista VMs Proxmox
│   │   ├── admin.js
│   │   ├── audit.js
│   │   ├── login.js
│   │   └── index.js
│   ├── components/
│   │   └── AppShell.js
│   ├── styles/
│   └── Dockerfile
├── nginx/
│   └── default.conf
├── docker-compose.yml
└── .env
```

---

## API de referencia

### Dominio B — Observabilidad (nuevo)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/assets` | Lista activos accesibles para el usuario |
| `GET` | `/api/assets/:id` | Detalle del activo |
| `GET` | `/api/assets/:id/observability/overview` | Métricas CPU/memoria/disco/errores |
| `GET` | `/api/assets/:id/observability/security` | Eventos de seguridad (Windows/Linux) |
| `GET` | `/api/assets/:id/observability/security/export` | Export PDF con `?from=&to=` |
| `GET` | `/api/assets/:id/observability/services` | Servicios detectados |
| `GET` | `/api/assets/:id/observability/events` | Eventos recientes |
| `GET` | `/api/assets/:id/observability/sql` | Overview SQL Server |

### Fleet (solo platform_admin)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/fleet/agents` | Lista agentes desde Fleet API |
| `GET` | `/api/fleet/policies` | Lista políticas de Fleet |
| `POST` | `/api/fleet/sync` | Sincroniza agentes → managed_assets |

### Admin de activos (solo platform_admin)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/admin/assets` | Lista todos los activos |
| `POST` | `/api/admin/assets` | Crear activo manual |
| `PATCH` | `/api/admin/assets/:id` | Editar activo |
| `PUT` | `/api/admin/assets/:id/assign` | Asignar a tenant_group |
| `DELETE` | `/api/admin/assets/:id/assign` | Remover asignación |
| `DELETE` | `/api/admin/assets/:id` | Eliminar activo |

### Dominio A — Infraestructura Proxmox

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/infra/vms` | Lista VMs de Proxmox |
| `POST` | `/api/infra/vms/sync` | Sincronizar desde Proxmox |
| `POST` | `/api/infra/vms/:vmid/start` | Encender VM |
| `POST` | `/api/infra/vms/:vmid/stop` | Apagar VM |
| `POST` | `/api/infra/vms/:vmid/restart` | Reiniciar VM |
| `POST` | `/api/infra/vms/:vmid/console` | Abrir consola VNC |

### Compatibilidad v1 (deprecated, Fase 1-2)

Los endpoints `/api/vms/:vmid/observability/*` siguen funcionando. En Fase 3 se eliminan.

---

## Modelo de datos — tablas nuevas

### `managed_assets`
Tabla principal del Dominio B. Cada fila es un host monitoreado.

| Campo | Tipo | Descripción |
|---|---|---|
| `fleet_agent_id` | `String?` unique | ID del agente en Fleet — **identificador primario** |
| `elastic_agent_id` | `String?` | `agent.id` en documentos de Elasticsearch |
| `host_id` | `String?` | `host.id` — más estable que `host.name` |
| `host_name` | `String?` | Nombre actual del host (puede cambiar) |
| `fleet_policy_id` | `String?` | ID de política en Fleet |
| `agent_status` | `String?` | `online`, `offline`, `error`, `unenrolled` |
| `os_type` | `String?` | `windows` o `linux` |
| `is_external` | `Boolean` | `true` si no pertenece a Proxmox |
| `proxmox_vmid` | `Int?` | VMID si el host es una VM de Proxmox |
| `managed_asset_id` en `vm_inventory` | `String?` | Enlace al asset (se rellena en Fase 2) |

### `asset_tenant_assignments`
Asigna un activo a un `tenant_group`. Un activo = un tenant_group máximo.

### `asset_tags`
Tags internos clave-valor por activo, independientes de Fleet tags.

### `asset_sync_events`
Log de cada cambio detectado durante sincronización (status, policy, hostname).

---

## Plan de migración

### Fase 1 — completada en este build
- Nuevas tablas en el schema sin tocar las existentes
- Endpoints `/assets/*` operativos
- Endpoints `/vms/:vmid/observability/*` siguen funcionando via capa de compatibilidad
- `IdentityResolverService` prioriza `agent.id` sobre `host.name`

### Fase 2 — acción manual requerida
Después del primer `fleet sync`, enlazar VMs existentes con sus assets:

```sql
-- Ejemplo: enlazar vm_inventory con managed_assets por host_name
UPDATE vm_inventory v
SET managed_asset_id = a.id
FROM managed_assets a
WHERE (v.elastic_host_name = a.host_name OR v.name = a.host_name)
  AND v.managed_asset_id IS NULL;
```

También crear `asset_tenant_assignments` para los assets que corresponden a VMs ya asignadas:

```sql
INSERT INTO asset_tenant_assignments (id, asset_id, tenant_group_id, assigned_at)
SELECT gen_random_uuid(), a.id, v.tenant_group_id, now()
FROM managed_assets a
JOIN vm_inventory v ON v.managed_asset_id = a.id
WHERE v.tenant_group_id IS NOT NULL
ON CONFLICT (asset_id) DO NOTHING;
```

### Fase 3 — migración del frontend
- Redirigir `/vms` a `/assets` para observabilidad
- Mantener `/vms` solo para acciones de infraestructura (start/stop/console)

### Fase 4 — retiro
- Eliminar endpoints `/vms/:vmid/observability/*`
- Eliminar `getVmObservability()` y `observability.ts`
- `vm_inventory` queda solo para operaciones Proxmox

---

## Cómo registrar un host externo

1. Instalar Elastic Agent en el host y enrolarlo en Fleet
2. Ejecutar `POST /api/fleet/sync` (requiere platform_admin)
3. El host aparece en `/api/assets` sin tenant asignado
4. Asignar al cliente via `PUT /api/admin/assets/:id/assign`

---

## Troubleshooting

**El activo aparece pero no muestra métricas**
- Verificar que `fleet_agent_id` o `elastic_agent_id` estén en el registro (`GET /api/assets/:id`)
- Confirmar que el campo `agent.id` está presente en los documentos de Elasticsearch: `GET /metrics-*/_search?size=1`
- Si solo hay `host.name`, el sistema cae al fallback automáticamente

**Fleet sync devuelve 0 agentes**
- Verificar `FLEET_URL` y credenciales en `docker-compose.yml`
- La Fleet API de Kibana requiere header `kbn-xsrf: true` — está incluido en `FleetService`
- Probar directamente: `curl -u elastic:PASSWORD http://KIBANA:5601/api/fleet/agents`

**Error de migración Prisma**
```bash
docker compose exec backend npx prisma migrate reset --force
docker compose exec backend npx prisma migrate dev --name init
```

**Backend no conecta con Keycloak**
- Keycloak tarda ~30-60 segundos en arrancar; el backend puede fallar en el primer intento
- `docker compose restart backend` después de que Keycloak esté healthy

---

## Acceso por defecto

| Servicio | URL | Usuario | Password |
|---|---|---|---|
| Panel | http://localhost | (Keycloak) | (Keycloak) |
| Keycloak Admin | http://localhost:8080 | admin | admin123 |
| PostgreSQL | localhost:5432 | panel | panel123 |

---

## Licencia

Proyecto interno Hyper-Ox. Todos los derechos reservados.

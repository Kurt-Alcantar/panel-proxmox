# Stack nativo de observabilidad por VM (Windows primero)

Este stack reemplaza el iframe de Kibana por vistas nativas en el panel administrativo.

## Qué hace
- Login y control de acceso con Keycloak
- Listado de VMs por tenant group o rol `platform_admin`
- Detalle por VM en `/vms/[vmid]`
- Tabs nativos:
  - Resumen
  - Seguridad
  - Servicios
  - Eventos
  - Auditoría
- Consultas directas a Elasticsearch usando `host.name`

## Variables a configurar
En `docker-compose.yml` dentro del servicio `backend`:
- `ELASTICSEARCH_URL`
- `ELASTICSEARCH_USERNAME`
- `ELASTICSEARCH_PASSWORD`
- `ELASTICSEARCH_API_KEY` si prefieres ApiKey
- `ELASTICSEARCH_INSECURE=true` si tu Elasticsearch usa certificado self-signed
- `KIBANA_BASE_URL` solo para el botón `Abrir Kibana`

## Requisitos de datos
Cada VM en `vm_inventory` debe tener:
- `os_type = windows`
- `elastic_host_name` con el `host.name` real en Elastic
- `observability_enabled = true`

## Endpoints nuevos
- `GET /api/vms/:vmid/observability/overview`
- `GET /api/vms/:vmid/observability/security`
- `GET /api/vms/:vmid/observability/services`
- `GET /api/vms/:vmid/observability/events`

## Notas
- Windows está implementado primero
- Linux queda preparado para fase posterior
- `platform_admin` ya devuelve todas las VMs en `/api/my/vms`

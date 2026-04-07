# Implementación de observabilidad por VM con Kibana

## Qué ya quedó en el código

- `vm_inventory` soporta metadatos de observabilidad por VM.
- El detalle de la VM ahora tiene tabs:
  - Resumen
  - Servicios
  - Logs
  - Eventos
  - Auditoría
- El backend devuelve configuración de observabilidad basada en `host.name`.
- La pestaña Auditoría ya muestra acciones del portal filtradas por VM.
- Los dashboards de Kibana se parametrizan por variables de entorno y por tipo de SO.

## Campos nuevos en base de datos

Ejecuta primero:

```sql
\i backend/prisma/manual_observability.sql
```

O copia el contenido del archivo y ejecútalo en PostgreSQL.

## Variables de entorno que debes llenar en `docker-compose.yml`

En el servicio `backend` debes poner los IDs reales de tus dashboards:

- `KIBANA_WINDOWS_OVERVIEW_DASHBOARD_ID`
- `KIBANA_WINDOWS_SERVICES_DASHBOARD_ID`
- `KIBANA_WINDOWS_LOGS_DASHBOARD_ID`
- `KIBANA_WINDOWS_EVENTS_DASHBOARD_ID`
- `KIBANA_WINDOWS_AUDIT_DASHBOARD_ID`
- `KIBANA_LINUX_OVERVIEW_DASHBOARD_ID`
- `KIBANA_LINUX_SERVICES_DASHBOARD_ID`
- `KIBANA_LINUX_LOGS_DASHBOARD_ID`
- `KIBANA_LINUX_EVENTS_DASHBOARD_ID`
- `KIBANA_LINUX_AUDIT_DASHBOARD_ID`

## Metadatos por VM

Debes actualizar `vm_inventory` para cada VM que quieras ver en Kibana.

Ejemplo Linux:

```sql
UPDATE vm_inventory
SET os_type = 'linux',
    elastic_host_name = name,
    kibana_base_url = 'http://192.168.10.162:5601',
    monitored_services = 'plesk,cloudflare,docker,nginx',
    observability_enabled = true
WHERE name = 'vcc-repository';
```

Ejemplo Windows:

```sql
UPDATE vm_inventory
SET os_type = 'windows',
    elastic_host_name = name,
    kibana_base_url = 'http://192.168.10.162:5601',
    monitored_services = 'postgres,mysql,sqlserver,veeam',
    observability_enabled = true
WHERE name = 'TACC-SERVERHY';
```

## Cómo sacar el ID de un dashboard

Abre el dashboard en Kibana y copia el valor que va después de:

```text
/app/dashboards#/view/
```

Ese valor es el que debes pegar en la variable de entorno correspondiente.

## Dashboards que debes crear en Kibana

### Windows
- Overview
- Services
- Logs
- Events
- Audit

### Linux
- Overview
- Services
- Logs
- Events
- Audit

## Filtro oficial

Todos los dashboards deben funcionar con este filtro:

```text
host.name:"NOMBRE_DE_LA_VM"
```

El portal ya lo inyecta automáticamente al abrir la VM.

## Servicios esperados por SO

### Windows
- postgres
- mysql
- sqlserver
- veeam

### Linux
- plesk
- cloudflare
- docker
- nginx

## Despliegue

```bash
docker compose build backend frontend
docker compose up -d
```

## Recomendación operativa inmediata

Primero arma estos 4 dashboards y ya tendrás visibilidad rápida hoy:

- Windows Overview
- Windows Services
- Linux Overview
- Linux Services

Después completas Logs, Events y Audit.

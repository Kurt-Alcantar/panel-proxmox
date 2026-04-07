ALTER TABLE vm_inventory ADD COLUMN IF NOT EXISTS os_type TEXT;
ALTER TABLE vm_inventory ADD COLUMN IF NOT EXISTS elastic_host_name TEXT;
ALTER TABLE vm_inventory ADD COLUMN IF NOT EXISTS kibana_base_url TEXT;
ALTER TABLE vm_inventory ADD COLUMN IF NOT EXISTS monitored_services TEXT;
ALTER TABLE vm_inventory ADD COLUMN IF NOT EXISTS observability_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Ejemplos de actualización.
-- Ajusta el WHERE según tus VM reales.
-- Linux
-- UPDATE vm_inventory
-- SET os_type = 'linux',
--     elastic_host_name = name,
--     kibana_base_url = 'http://192.168.10.162:5601',
--     monitored_services = 'plesk,cloudflare,docker,nginx',
--     observability_enabled = true
-- WHERE name IN ('vcc-repository');

-- Windows
-- UPDATE vm_inventory
-- SET os_type = 'windows',
--     elastic_host_name = name,
--     kibana_base_url = 'http://192.168.10.162:5601',
--     monitored_services = 'postgres,mysql,sqlserver,veeam',
--     observability_enabled = true
-- WHERE name IN ('TACC-SERVERHY');

-- ─────────────────────────────────────────────────────────────────
-- MIGRACIÓN: Modelo multitenant jerárquico
-- HYPEROX → Partners → Clientes finales
-- ─────────────────────────────────────────────────────────────────

-- 1. Agregar type y parent_tenant_id a tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'client';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS parent_tenant_id TEXT REFERENCES tenants(id);

-- 2. Marcar HYPEROX como platform
UPDATE tenants SET type = 'platform' WHERE code = '1234';

-- 3. Roles nuevos
INSERT INTO roles (id, code) VALUES
  (gen_random_uuid(), 'partner_admin'),
  (gen_random_uuid(), 'tenant_user')
ON CONFLICT (code) DO NOTHING;

-- 4. Agregar tenant_id al usuario (además del tenant_group_id existente)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id);

-- Vincular kurt al tenant HYPEROX
UPDATE users 
SET tenant_id = (SELECT id FROM tenants WHERE code = '1234')
WHERE email = 'kurt@hyperox.com';

-- 5. Agregar tenant_id a asset_tenant_assignments para poder filtrar por tenant directo
-- (además del grupo, para partners que ven por tenant completo)
-- Nota: un activo puede pertenecer a un tenant (cliente) y a través de él 
-- ser visible para su partner
-- La columna tenant_id en assignments apunta al tenant CLIENTE (G-One, Trevly)
ALTER TABLE asset_tenant_assignments ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id);

-- ─────────────────────────────────────────────────────────────────
-- RESULTADO DEL MODELO:
--
-- tenants:
--   HYPEROX          (type=platform)
--   Conestra         (type=partner,  parent=NULL)
--   G-One            (type=client,   parent=Conestra)
--   Trevly           (type=client,   parent=Conestra)
--
-- asset_tenant_assignments:
--   asset_id | tenant_group_id | tenant_id
--   vm-1     | g-one-group     | g-one-id
--   vm-2     | trevly-group    | trevly-id
--
-- users:
--   kurt           tenant_id=HYPEROX  role=platform_admin  → ve todo
--   user-conestra  tenant_id=Conestra role=partner_admin   → ve G-One + Trevly
--   user-gone      tenant_id=G-One    role=tenant_user     → ve solo G-One
-- ─────────────────────────────────────────────────────────────────


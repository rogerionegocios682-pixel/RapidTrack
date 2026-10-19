-- ===========================================================================
-- Delivery_OS — Migration 001: infraestrutura de sincronização (Postgres)
-- ===========================================================================
-- Equivalente à versão SQLite (db/migrations/001_sync.sql), adaptada ao
-- Postgres/Supabase. Diferenças:
--   - `ADD COLUMN IF NOT EXISTS` é nativo (não precisa de tratamento de erro).
--   - `datetime('now')` do SQLite -> `now()`.
--   - `ON CONFLICT ... DO NOTHING` já existe aqui (o SQLite também suporta).
--
-- FASE 1: apenas ADICIONA estruturas. Nada do comportamento atual muda.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. sync_outbox — fila de operações pendentes de envio (local -> nuvem)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_outbox (
  id          TEXT PRIMARY KEY,
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  op          TEXT NOT NULL
                CHECK (op IN ('create','update','delete')),
  payload     TEXT,
  device_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  synced_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON sync_outbox (synced_at, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_entity
  ON sync_outbox (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_outbox_device
  ON sync_outbox (device_id);

-- ---------------------------------------------------------------------------
-- 2. sync_state — cursor de sincronização (controle de conflitos / pull)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_state (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- 3. Colunas de sincronização nas tabelas de negócio
-- ---------------------------------------------------------------------------
ALTER TABLE users         ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users         ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE users         ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE companies     ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE companies     ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE companies     ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE motoboys      ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE motoboys      ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE motoboys      ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE company_neighborhoods ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE company_neighborhoods ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE company_neighborhoods ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE delivery_fees ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE delivery_fees ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE delivery_fees ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE deliveries    ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE deliveries    ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE deliveries    ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE delivery_status_history ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE delivery_status_history ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE audits        ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE audits        ADD COLUMN IF NOT EXISTS origin_device TEXT;

ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS origin_device TEXT;

-- ---------------------------------------------------------------------------
-- 4. Índices de sincronização (varredura por cursor de rev)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_rev            ON users (rev);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_rev    ON neighborhoods (rev);
CREATE INDEX IF NOT EXISTS idx_companies_rev        ON companies (rev);
CREATE INDEX IF NOT EXISTS idx_motoboys_rev         ON motoboys (rev);
CREATE INDEX IF NOT EXISTS idx_cn_rev               ON company_neighborhoods (rev);
CREATE INDEX IF NOT EXISTS idx_fees_rev             ON delivery_fees (rev);
CREATE INDEX IF NOT EXISTS idx_deliveries_rev       ON deliveries (rev);
CREATE INDEX IF NOT EXISTS idx_dsh_rev              ON delivery_status_history (rev);
CREATE INDEX IF NOT EXISTS idx_messages_rev         ON internal_messages (rev);
CREATE INDEX IF NOT EXISTS idx_audits_rev           ON audits (rev);
CREATE INDEX IF NOT EXISTS idx_password_resets_rev  ON password_resets (rev);

CREATE INDEX IF NOT EXISTS idx_users_deleted         ON users (deleted_at);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_deleted ON neighborhoods (deleted_at);
CREATE INDEX IF NOT EXISTS idx_companies_deleted     ON companies (deleted_at);
CREATE INDEX IF NOT EXISTS idx_motoboys_deleted      ON motoboys (deleted_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_deleted    ON deliveries (deleted_at);

-- ---------------------------------------------------------------------------
-- 5. Marca a migration como aplicada
-- ---------------------------------------------------------------------------
INSERT INTO app_meta (key, value, updated_at)
VALUES ('schema_version', '2', now()::text)
ON CONFLICT (key) DO UPDATE SET value = '2', updated_at = now()::text;

INSERT INTO app_meta (key, value, updated_at)
VALUES ('sync_enabled', '0', now()::text)
ON CONFLICT (key) DO NOTHING;

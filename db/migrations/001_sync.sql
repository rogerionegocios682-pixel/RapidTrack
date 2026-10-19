-- ===========================================================================
-- Delivery_OS — Migration 001: infraestrutura de sincronização (SQLite)
-- ===========================================================================
-- FASE 1 da arquitetura local-first. NÃO altera nenhum comportamento atual:
-- apenas ADICIONA estruturas que a Fase 2 (envio local -> nuvem) vai usar.
--
-- Adiciona, de forma IDEMPOTENTE:
--   1. `rev`        — versão da linha (inteiro incremental por registro).
--   2. `deleted_at` — soft-delete / tombstone, para que exclusões não voltem
--                     ao sincronizar com outro dispositivo.
--   3. `sync_outbox`— journal append-only das operações pendentes de envio.
--   4. `sync_state` — cursor de sincronização por dispositivo.
--
-- Seguro para bancos já existentes: `ALTER TABLE ... ADD COLUMN` é tolerado
-- quando a coluna já existe (o runner trata o erro "duplicate column").
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. sync_outbox — fila de operações pendentes de envio (local -> nuvem)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_outbox (
  id          TEXT PRIMARY KEY,          -- UUID v4 da própria operação
  entity      TEXT NOT NULL,             -- users | companies | motoboys | ...
  entity_id   TEXT NOT NULL,             -- id da linha afetada (UUID v4)
  op          TEXT NOT NULL              -- create | update | delete
                CHECK (op IN ('create','update','delete')),
  payload     TEXT,                      -- JSON com a linha no momento da operação
  device_id   TEXT NOT NULL,             -- dispositivo de origem (evita eco)
  created_at  TEXT NOT NULL,             -- ISO-8601 UTC
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  synced_at   TEXT                       -- NULL = pendente de envio
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
  key        TEXT PRIMARY KEY,           -- ex.: last_pull_cursor, last_push_at
  value      TEXT,
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- 3. Colunas de sincronização nas tabelas de negócio
-- ---------------------------------------------------------------------------
-- `rev`        : incrementado a cada escrita; base do merge determinístico.
-- `deleted_at` : tombstone (NULL = ativo); preserva a exclusão na replicação.
-- `origin_device`: dispositivo que gerou a última escrita (desempate/auditoria).
-- ---------------------------------------------------------------------------

-- users
ALTER TABLE users ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN deleted_at TEXT;
ALTER TABLE users ADD COLUMN origin_device TEXT;

-- neighborhoods
ALTER TABLE neighborhoods ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE neighborhoods ADD COLUMN deleted_at TEXT;
ALTER TABLE neighborhoods ADD COLUMN origin_device TEXT;

-- companies
ALTER TABLE companies ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE companies ADD COLUMN deleted_at TEXT;
ALTER TABLE companies ADD COLUMN origin_device TEXT;

-- motoboys
ALTER TABLE motoboys ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE motoboys ADD COLUMN deleted_at TEXT;
ALTER TABLE motoboys ADD COLUMN origin_device TEXT;

-- company_neighborhoods
ALTER TABLE company_neighborhoods ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE company_neighborhoods ADD COLUMN deleted_at TEXT;
ALTER TABLE company_neighborhoods ADD COLUMN origin_device TEXT;

-- delivery_fees
ALTER TABLE delivery_fees ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE delivery_fees ADD COLUMN deleted_at TEXT;
ALTER TABLE delivery_fees ADD COLUMN origin_device TEXT;

-- deliveries
ALTER TABLE deliveries ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE deliveries ADD COLUMN deleted_at TEXT;
ALTER TABLE deliveries ADD COLUMN origin_device TEXT;

-- delivery_status_history (append-only; rev serve para o cursor de pull)
ALTER TABLE delivery_status_history ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE delivery_status_history ADD COLUMN origin_device TEXT;

-- internal_messages (append-only, exceto read_at)
ALTER TABLE internal_messages ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE internal_messages ADD COLUMN deleted_at TEXT;
ALTER TABLE internal_messages ADD COLUMN origin_device TEXT;

-- audits (append-only)
ALTER TABLE audits ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE audits ADD COLUMN origin_device TEXT;

-- password_resets (efêmero; rev mantém o cursor de pull consistente)
ALTER TABLE password_resets ADD COLUMN rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE password_resets ADD COLUMN origin_device TEXT;

-- ---------------------------------------------------------------------------
-- 4. Índices de sincronização (varredura por cursor de rev)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_rev          ON users (rev);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_rev  ON neighborhoods (rev);
CREATE INDEX IF NOT EXISTS idx_companies_rev      ON companies (rev);
CREATE INDEX IF NOT EXISTS idx_motoboys_rev       ON motoboys (rev);
CREATE INDEX IF NOT EXISTS idx_cn_rev             ON company_neighborhoods (rev);
CREATE INDEX IF NOT EXISTS idx_fees_rev           ON delivery_fees (rev);
CREATE INDEX IF NOT EXISTS idx_deliveries_rev     ON deliveries (rev);
CREATE INDEX IF NOT EXISTS idx_dsh_rev            ON delivery_status_history (rev);
CREATE INDEX IF NOT EXISTS idx_messages_rev       ON internal_messages (rev);
CREATE INDEX IF NOT EXISTS idx_audits_rev         ON audits (rev);
CREATE INDEX IF NOT EXISTS idx_password_resets_rev ON password_resets (rev);

-- Índices de soft-delete (filtrar registros ativos é a consulta mais comum).
CREATE INDEX IF NOT EXISTS idx_users_deleted        ON users (deleted_at);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_deleted ON neighborhoods (deleted_at);
CREATE INDEX IF NOT EXISTS idx_companies_deleted    ON companies (deleted_at);
CREATE INDEX IF NOT EXISTS idx_motoboys_deleted     ON motoboys (deleted_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_deleted   ON deliveries (deleted_at);

-- ---------------------------------------------------------------------------
-- 5. Marca a migration como aplicada
-- ---------------------------------------------------------------------------
INSERT INTO app_meta (key, value, updated_at)
VALUES ('schema_version', '2', datetime('now'))
ON CONFLICT(key) DO UPDATE SET value = '2', updated_at = datetime('now');

INSERT INTO app_meta (key, value, updated_at)
VALUES ('sync_enabled', '0', datetime('now'))
ON CONFLICT(key) DO NOTHING;

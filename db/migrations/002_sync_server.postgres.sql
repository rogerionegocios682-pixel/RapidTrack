-- ===========================================================================
-- Delivery_OS — Migration 002: sincronização no lado do servidor (Postgres)
-- ===========================================================================
-- FASE 2. Complementa a migration 001 com o que o RECEPTOR precisa para
-- aplicar as operações vindas dos dispositivos de forma IDEMPOTENTE.
--
-- Enquanto a 001 preparou o lado LOCAL (rev, deleted_at, outbox), esta prepara
-- o lado SERVIDOR (Supabase):
--   1. `sync_applied`  — ledger de operações já aplicadas. É o que garante
--                        idempotência: se o mesmo dispositivo reenviar a mesma
--                        operação (retry após timeout de rede), o servidor
--                        detecta pelo par (op_id) e não duplica o efeito.
--   2. `device_id`     — quem originou a última escrita de cada linha.
--   3. `rev` / `deleted_at` já existem (migration 001).
--
-- Totalmente idempotente: pode rodar quantas vezes for necessário.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. sync_applied — ledger de idempotência do servidor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_applied (
  op_id        TEXT PRIMARY KEY,             -- id da entrada da outbox do dispositivo
  device_id    TEXT NOT NULL,                -- dispositivo que originou
  entity       TEXT NOT NULL,                -- tabela de negócio
  entity_id    TEXT NOT NULL,                -- linha afetada
  op           TEXT NOT NULL
                 CHECK (op IN ('create','update','delete')),
  applied_at   TEXT NOT NULL,                -- quando o servidor aplicou
  result       TEXT                          -- 'ok' | 'skipped' | 'conflict'
);

CREATE INDEX IF NOT EXISTS idx_sync_applied_device ON sync_applied (device_id);
CREATE INDEX IF NOT EXISTS idx_sync_applied_entity ON sync_applied (entity, entity_id);

-- ---------------------------------------------------------------------------
-- 2. Garante as colunas de controle nas tabelas sincronizáveis
--    (o Postgres suporta ADD COLUMN IF NOT EXISTS nativamente)
-- ---------------------------------------------------------------------------
ALTER TABLE users                   ADD COLUMN IF NOT EXISTS origin_device TEXT;
ALTER TABLE neighborhoods           ADD COLUMN IF NOT EXISTS origin_device TEXT;
ALTER TABLE companies               ADD COLUMN IF NOT EXISTS origin_device TEXT;
ALTER TABLE motoboys                ADD COLUMN IF NOT EXISTS origin_device TEXT;
ALTER TABLE deliveries              ADD COLUMN IF NOT EXISTS origin_device TEXT;
ALTER TABLE internal_messages       ADD COLUMN IF NOT EXISTS origin_device TEXT;

-- ---------------------------------------------------------------------------
-- 3. Registro da versão do schema
-- ---------------------------------------------------------------------------
INSERT INTO app_meta (key, value, updated_at)
VALUES ('schema_version', '3', now()::text)
ON CONFLICT (key) DO UPDATE SET value = '3', updated_at = now()::text;

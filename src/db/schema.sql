-- ===========================================================================
-- Delivery_OS — Esquema do banco de dados (SQLite)
-- Sistema de Gestão de Entregas e Motoboys
-- ===========================================================================
-- Todas as tabelas usam IDs TEXT (UUID v4) para garantir unicidade global,
-- segurança e sincronização entre dispositivos. Timestamps são ISO-8601 UTC.
-- ===========================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ---------------------------------------------------------------------------
-- users — usuários do sistema (admin, operador, motoboy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'operator'
                  CHECK (role IN ('admin','operator','motoboy')),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive')),
  motoboy_id    TEXT,                       -- vínculo quando role = motoboy
  last_login_at TEXT,
  permissions   TEXT,                       -- JSON de permissões individuais (NULL = usa o papel)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY (motoboy_id) REFERENCES motoboys(id) ON DELETE SET NULL
);

-- E-mail é único (case-insensitive via COLLATE NOCASE) — impede cadastro duplicado.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- ---------------------------------------------------------------------------
-- password_resets — recuperação de senha
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id);

-- ---------------------------------------------------------------------------
-- neighborhoods — bairros
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neighborhoods (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  city       TEXT NOT NULL,
  state      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Nome do bairro é único por cidade/UF.
CREATE UNIQUE INDEX IF NOT EXISTS idx_neighborhoods_unique
  ON neighborhoods (name COLLATE NOCASE, city COLLATE NOCASE, state COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_status ON neighborhoods (status);

-- ---------------------------------------------------------------------------
-- companies — empresas clientes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  trade_name TEXT,
  cnpj       TEXT,
  phone      TEXT,
  whatsapp   TEXT,
  email      TEXT,
  address    TEXT,
  neighborhood TEXT,
  city       TEXT,
  state      TEXT,
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- CNPJ único quando informado (índice parcial).
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_cnpj
  ON companies (cnpj) WHERE cnpj IS NOT NULL AND cnpj <> '';
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies (status);
CREATE INDEX IF NOT EXISTS idx_companies_name   ON companies (name COLLATE NOCASE);

-- ---------------------------------------------------------------------------
-- motoboys — entregadores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS motoboys (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  cpf              TEXT,
  phone            TEXT,
  whatsapp         TEXT,
  motorcycle_plate TEXT,
  motorcycle_model TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'available'
                     CHECK (status IN ('available','on_delivery','inactive')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_motoboys_cpf
  ON motoboys (cpf) WHERE cpf IS NOT NULL AND cpf <> '';
CREATE INDEX IF NOT EXISTS idx_motoboys_status ON motoboys (status);
CREATE INDEX IF NOT EXISTS idx_motoboys_name   ON motoboys (name COLLATE NOCASE);

-- ---------------------------------------------------------------------------
-- company_neighborhoods — relacionamento N:N Empresa x Bairro atendido
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_neighborhoods (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL,
  neighborhood_id TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  UNIQUE (company_id, neighborhood_id),
  FOREIGN KEY (company_id)      REFERENCES companies(id)      ON DELETE CASCADE,
  FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id)  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cn_company      ON company_neighborhoods (company_id);
CREATE INDEX IF NOT EXISTS idx_cn_neighborhood ON company_neighborhoods (neighborhood_id);

-- ---------------------------------------------------------------------------
-- delivery_fees — tabela de taxas (Empresa + Bairro -> valor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_fees (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL,
  neighborhood_id TEXT NOT NULL,
  fee_cents       INTEGER NOT NULL CHECK (fee_cents >= 0),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (company_id, neighborhood_id),
  FOREIGN KEY (company_id)      REFERENCES companies(id)      ON DELETE CASCADE,
  FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id)  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fees_company      ON delivery_fees (company_id);
CREATE INDEX IF NOT EXISTS idx_fees_neighborhood ON delivery_fees (neighborhood_id);

-- ---------------------------------------------------------------------------
-- deliveries — corridas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliveries (
  id              TEXT PRIMARY KEY,
  order_number    TEXT NOT NULL,
  company_id      TEXT NOT NULL,
  customer_name   TEXT NOT NULL,
  neighborhood_id TEXT NOT NULL,
  motoboy_id      TEXT NOT NULL,
  fee_cents       INTEGER NOT NULL CHECK (fee_cents >= 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','dispatched','in_progress',
                                      'delivered','cancelled','customer_not_found')),
  notes           TEXT,
  dispatched_at   TEXT,
  delivered_at    TEXT,
  cancelled_at    TEXT,
  created_by      TEXT NOT NULL,
  updated_by      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  FOREIGN KEY (company_id)      REFERENCES companies(id)      ON DELETE RESTRICT,
  FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id)  ON DELETE RESTRICT,
  FOREIGN KEY (motoboy_id)      REFERENCES motoboys(id)       ON DELETE RESTRICT,
  FOREIGN KEY (created_by)      REFERENCES users(id)          ON DELETE RESTRICT,
  FOREIGN KEY (updated_by)      REFERENCES users(id)          ON DELETE SET NULL
);

-- Impede duplicidade acidental do número do pedido por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_order_unique
  ON deliveries (company_id, order_number COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_deliveries_status     ON deliveries (status);
CREATE INDEX IF NOT EXISTS idx_deliveries_motoboy    ON deliveries (motoboy_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_company    ON deliveries (company_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries (created_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_updated_at ON deliveries (updated_at);

-- ---------------------------------------------------------------------------
-- delivery_status_history — histórico de status (auditoria das corridas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_status_history (
  id         TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by)  REFERENCES users(id)      ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_dsh_delivery ON delivery_status_history (delivery_id);

-- ---------------------------------------------------------------------------
-- internal_messages — comunicação interna
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal_messages (
  id           TEXT PRIMARY KEY,
  sender_id    TEXT NOT NULL,
  receiver_id  TEXT,                 -- NULL = mensagem para todos
  audience     TEXT NOT NULL DEFAULT 'user'
                 CHECK (audience IN ('user','all','operators','motoboys')),
  subject      TEXT,
  message      TEXT NOT NULL,
  is_announcement INTEGER NOT NULL DEFAULT 0 CHECK (is_announcement IN (0,1)),
  read_at      TEXT,
  created_at   TEXT NOT NULL,
  FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_receiver ON internal_messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender   ON internal_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_audience ON internal_messages (audience);
CREATE INDEX IF NOT EXISTS idx_messages_created  ON internal_messages (created_at);

-- ---------------------------------------------------------------------------
-- audits — log de operações importantes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audits (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  user_name   TEXT,
  action      TEXT NOT NULL,        -- create | update | delete | status_change | login | ...
  entity      TEXT NOT NULL,        -- delivery | company | motoboy | neighborhood | fee | user | message
  entity_id   TEXT,
  description TEXT,
  metadata    TEXT,                 -- JSON com dados extras
  created_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audits_entity  ON audits (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audits_user    ON audits (user_id);
CREATE INDEX IF NOT EXISTS idx_audits_created ON audits (created_at);

-- ---------------------------------------------------------------------------
-- app_meta — controle interno (versão do esquema, sincronização)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL
);

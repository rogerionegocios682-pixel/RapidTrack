/**
 * Delivery_OS — Parser de SQL para captura de sincronização (Fase 2)
 * ---------------------------------------------------------------------------
 * Os repositórios do projeto NÃO usam placeholders: eles montam o SQL com
 * literais já escapados (`sqlLit`/`sqlList`/`sqlSet`). Ex.:
 *
 *   INSERT INTO users (id, name, ...) VALUES ('uuid', 'Ana', ...)
 *   UPDATE users SET name = 'Ana', updated_at = '...' WHERE id = 'uuid'
 *   DELETE FROM motoboys WHERE id = 'uuid'
 *
 * Este módulo extrai dessas instruções a informação mínima que a fila de
 * sincronização precisa: a tabela, a operação e o(s) id(s) afetado(s).
 *
 * IMPORTANTE: aqui é só LEITURA de intenção — nada é executado. O parser é
 * conservador: se não entender uma instrução, devolve `null` e ela é ignorada
 * (nunca lança erro nem interrompe uma transação de negócio).
 * ---------------------------------------------------------------------------
 */

/** Operações reconhecidas na outbox. */
export type SyncOp = 'create' | 'update' | 'delete';

/** Resultado da análise de uma instrução SQL. */
export interface ParsedWrite {
  table: string;
  op: SyncOp;
  /** Ids das linhas afetadas. Pode ser vazio (ex.: UPDATE em massa). */
  ids: string[];
}

/* ===========================================================================
 * Tabelas sincronizáveis
 * ---------------------------------------------------------------------------
 * Somente estas entram na fila. `app_meta`, `sync_outbox` e `sync_state` ficam
 * de fora de propósito: são controle interno e não devem ser replicados.
 * ===========================================================================*/
export const SYNCABLE_TABLES: ReadonlySet<string> = new Set([
  'users',
  'neighborhoods',
  'companies',
  'motoboys',
  'company_neighborhoods',
  'delivery_fees',
  'deliveries',
  'delivery_status_history',
  'internal_messages',
  'audits',
  'password_resets',
]);

/** Tabelas que nunca geram outbox (controle interno / log de sync). */
const NEVER_SYNC: ReadonlySet<string> = new Set([
  'app_meta',
  'sync_outbox',
  'sync_state',
  'sync_inbox',
  'sqlite_sequence',
]);

/* ===========================================================================
 * Utilitários de extração
 * ===========================================================================*/

/** Remove comentários de linha e de bloco, preservando o restante do texto. */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ');
}

/**
 * Extrai valores de string de um trecho de SQL, respeitando o escape de aspa
 * simples do SQL (`''` dentro da string vira `'`).
 */
function extractStrings(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "'") {
      let value = '';
      i++;
      while (i < text.length) {
        if (text[i] === "'" && text[i + 1] === "'") {
          value += "'";
          i += 2;
          continue;
        }
        if (text[i] === "'") break;
        value += text[i];
        i++;
      }
      out.push(value);
      i++;
    } else {
      i++;
    }
  }
  return out;
}

/** Normaliza um identificador removendo aspas (`"users"` -> `users`). */
function unquoteIdent(ident: string): string {
  return ident.replace(/["`\[\]]/g, '').trim();
}

/**
 * Remove o prefixo de esquema (`public.users` -> `users`) e normaliza.
 */
function normalizeTable(raw: string): string {
  const cleaned = unquoteIdent(raw);
  const parts = cleaned.split('.');
  return (parts[parts.length - 1] || '').toLowerCase();
}

/* ===========================================================================
 * Detecção de operação
 * ===========================================================================*/

const INSERT_RE = /^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+([^\s(]+)\s*\(([^)]*)\)/i;
const INSERT_VALUES_RE =
  /^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+([^\s(]+)\s*\(([^)]*)\)\s*(?:VALUES|SELECT)\s*/i;
const UPDATE_RE = /^\s*UPDATE\s+([^\s]+)\s+SET\s+([\s\S]*?)(?:\s+WHERE\s+([\s\S]*))?$/i;
const DELETE_RE = /^\s*DELETE\s+FROM\s+([^\s]+)\s*(?:\s+WHERE\s+([\s\S]*))?$/i;
const UPSERT_RE = /^\s*INSERT\s+INTO\s+([^\s(]+)/i;

/**
 * Extrai ids de uma cláusula WHERE. Reconhece:
 *   id = 'valor'
 *   id IN ('a', 'b', 'c')
 *   "id" = 'valor'
 * Também trata o caso de WHERE com `id` em conjunto com outros critérios.
 */
function extractIdsFromWhere(where: string | undefined): string[] {
  if (!where) return [];
  const ids: string[] = [];

  // id = 'valor'  |  id <> 'valor'
  const eqRe = /(?:^|[\s(])(?:\w+\.)?["`]?id["`]?\s*=\s*'((?:[^']|'')*)'/gi;
  let m: RegExpExecArray | null;
  while ((m = eqRe.exec(where)) !== null) {
    ids.push(m[1].replace(/''/g, "'"));
  }

  // id IN ('a','b',...)
  const inRe = /(?:^|[\s(])(?:\w+\.)?["`]?id["`]?\s+IN\s*\(([^)]*)\)/gi;
  while ((m = inRe.exec(where)) !== null) {
    ids.push(...extractStrings(m[1]));
  }

  return [...new Set(ids)];
}

/**
 * Extrai os pares coluna -> valor de uma lista de VALUES.
 * Espera o formato `('v1', 'v2', 3, NULL)` já com literais.
 */
function parseValuesTuple(
  columns: string[],
  tuple: string,
): Record<string, string | null> {
  const row: Record<string, string | null> = {};
  const values: (string | null)[] = [];
  let i = 0;

  while (i < tuple.length) {
    const ch = tuple[i];
    if (ch === ' ' || ch === ',' || ch === '\n' || ch === '\r' || ch === '\t') {
      i++;
      continue;
    }
    if (ch === "'") {
      // string literal, respeitando ''
      let value = '';
      i++;
      while (i < tuple.length) {
        if (tuple[i] === "'" && tuple[i + 1] === "'") {
          value += "'";
          i += 2;
          continue;
        }
        if (tuple[i] === "'") break;
        value += tuple[i];
        i++;
      }
      values.push(value);
      i++;
      continue;
    }
    // número, NULL, true/false ou expressão até a próxima vírgula
    let token = '';
    while (i < tuple.length && tuple[i] !== ',') {
      token += tuple[i];
      i++;
    }
    const trimmed = token.trim();
    if (/^null$/i.test(trimmed)) values.push(null);
    else values.push(trimmed);
  }

  columns.forEach((col, idx) => {
    row[unquoteIdent(col)] = values[idx] ?? null;
  });
  return row;
}

/* ===========================================================================
 * API principal
 * ===========================================================================*/

/**
 * Analisa uma instrução SQL e devolve o que ela afeta — ou `null` se não for
 * uma escrita sincronizável (SELECT, DDL, tabela de controle, etc.).
 *
 * Quando `params` é fornecido (placeholders), o parser também consegue
 * resolver os valores; mas o projeto monta o SQL com literais, então o uso
 * principal é sem params.
 */
export function parseWrite(sql: string, params: (string | number | null)[] = []): ParsedWrite | null {
  if (!sql || typeof sql !== 'string') return null;
  const text = stripComments(sql).trim();
  if (!text) return null;

  /* ------------------------------- INSERT ------------------------------- */
  const insert = INSERT_RE.exec(text);
  if (insert) {
    const table = normalizeTable(insert[1]);
    if (NEVER_SYNC.has(table) || !SYNCABLE_TABLES.has(table)) return null;

    const columns = insert[2].split(',').map((c) => unquoteIdent(c));
    const rest = text.slice(insert[0].length);

    // Detecta upsert (ON CONFLICT ... DO UPDATE) -> trata como update.
    const isUpsert = /ON\s+CONFLICT[\s\S]*DO\s+UPDATE/i.test(text);

    let row: Record<string, string | null>;
    if (params.length) {
      // Placeholders: os valores vêm em `params` na ordem das colunas.
      row = {};
      columns.forEach((col, idx) => {
        const raw = params[idx];
        row[col] = raw === undefined ? null : raw === null ? null : String(raw);
      });
    } else {
      const tupleMatch = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)/.exec(rest);
      if (!tupleMatch) return null;
      row = parseValuesTuple(columns, tupleMatch[1]);
    }

    const id = row.id ?? null;
    if (!id) return null;
    return { table, op: isUpsert ? 'update' : 'create', ids: [id] };
  }

  /* ------------------------------- UPDATE ------------------------------- */
  const update = UPDATE_RE.exec(text);
  if (update) {
    const table = normalizeTable(update[1]);
    if (NEVER_SYNC.has(table) || !SYNCABLE_TABLES.has(table)) return null;
    const ids = extractIdsFromWhere(update[3]);
    // Soft-delete: `SET deleted_at = '...'` é uma exclusão lógica.
    const isSoftDelete = /\bdeleted_at\s*=\s*'[^']+'/i.test(update[2]);
    return { table, op: isSoftDelete ? 'delete' : 'update', ids };
  }

  /* ------------------------------- DELETE ------------------------------- */
  const del = DELETE_RE.exec(text);
  if (del) {
    const table = normalizeTable(del[1]);
    if (NEVER_SYNC.has(table) || !SYNCABLE_TABLES.has(table)) return null;
    const ids = extractIdsFromWhere(del[2]);
    return { table, op: 'delete', ids };
  }

  return null;
}

/**
 * Extrai a coluna `id` de um INSERT (helper público, útil em testes).
 * Devolve `null` quando a instrução não é um INSERT reconhecível.
 */
export function extractInsertId(sql: string): string | null {
  const m = UPSERT_RE.exec(stripComments(sql).trim());
  if (!m) return null;
  const tuple = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)/.exec(sql.slice(m[0].length));
  if (!tuple) return null;
  const first = extractStrings(tuple[1])[0];
  return first ?? null;
}

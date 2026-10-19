/**
 * Declarações de tipo para o `sql.js` (SQLite compilado para WebAssembly).
 * ---------------------------------------------------------------------------
 * O pacote @types/sql.js não é instalável de forma confiável neste ambiente
 * (caminho de perfil com espaços/acentos), então declaramos aqui exatamente a
 * superfície da API que o Delivery_OS utiliza — mantendo o tipo completo sem
 * depender de um pacote externo.
 */
declare module 'sql.js' {
  export type SqlValue = string | number | Uint8Array | null;

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export interface Statement {
    bind(params?: SqlValue[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, SqlValue>;
    get(params?: SqlValue[]): SqlValue[];
    getColumnNames(): string[];
    free(): boolean;
    reset(): void;
    run(params?: SqlValue[]): void;
  }

  export interface Database {
    run(sql: string, params?: SqlValue[]): Database;
    exec(sql: string, params?: SqlValue[]): QueryExecResult[];
    prepare(sql: string, params?: SqlValue[]): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array | null) => Database;
  }

  export interface SqlJsConfig {
    locateFile?: (filename: string, prefix: string) => string;
    wasmBinary?: ArrayBuffer;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}

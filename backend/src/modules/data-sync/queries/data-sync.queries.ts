import {
  DATA_SYNC_EMAIL_DOMAIN,
  DATA_SYNC_FDW_SERVER,
  DATA_SYNC_MIRROR_SCHEMA,
} from '../constants/data-sync.constants';

/**
 * DDL cannot take bind parameters, so the server / user-mapping statements are built by Postgres
 * itself with format(%L) — values are quoted by the database, never concatenated in JS.
 */
export const buildCreateFdwServerSql = `
  SELECT format(
    'CREATE SERVER ${DATA_SYNC_FDW_SERVER} FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host %L, port %L, dbname %L, sslmode %L)',
    $1::text, $2::text, $3::text, 'require'
  ) AS ddl
`;

export const buildCreateUserMappingSql = `
  SELECT format(
    'CREATE USER MAPPING FOR CURRENT_USER SERVER ${DATA_SYNC_FDW_SERVER} OPTIONS (user %L, password %L)',
    $1::text, $2::text
  ) AS ddl
`;

export const dropSyncObjectsSql = [
  `DROP SCHEMA IF EXISTS ${DATA_SYNC_MIRROR_SCHEMA} CASCADE`,
  // CASCADE also drops the user mapping, so the source password is not left in the catalog.
  `DROP SERVER IF EXISTS ${DATA_SYNC_FDW_SERVER} CASCADE`,
];

export const importMirrorSchemaSql = [
  `CREATE SCHEMA ${DATA_SYNC_MIRROR_SCHEMA}`,
  `IMPORT FOREIGN SCHEMA public FROM SERVER ${DATA_SYNC_FDW_SERVER} INTO ${DATA_SYNC_MIRROR_SCHEMA}`,
];

/**
 * Top-level tables of UAT's public schema (partitions are filled through their parent), with the
 * quoted target name, the matching mirror table and the columns both sides share. `columns` is null
 * when prod has no such table. Generated columns are left for Postgres to compute.
 */
export const listSyncTablesSql = `
  SELECT
    c.relname AS "tableName",
    format('public.%I', c.relname) AS "targetTable",
    format('${DATA_SYNC_MIRROR_SCHEMA}.%I', c.relname) AS "sourceTable",
    (
      SELECT string_agg(quote_ident(t.attname), ', ' ORDER BY t.attnum)
      FROM pg_attribute t
      JOIN pg_attribute m
        ON m.attrelid = to_regclass(format('${DATA_SYNC_MIRROR_SCHEMA}.%I', c.relname))
       AND m.attname = t.attname AND m.attnum > 0 AND NOT m.attisdropped
      WHERE t.attrelid = c.oid AND t.attnum > 0 AND NOT t.attisdropped AND t.attgenerated = ''
    ) AS "columns"
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind IN ('r', 'p')
    AND NOT c.relispartition
    AND NOT (c.relname = ANY($1::text[]))
  ORDER BY c.relname
`;

/** Puts every sequence owned by a public table column back in line with the copied data. */
export const resetOwnedSequencesSql = `
  DO $$
  DECLARE r record;
  BEGIN
    FOR r IN
      SELECT format('%I.%I', sn.nspname, s.relname) AS seq,
             format('%I.%I', tn.nspname, t.relname) AS tbl,
             quote_ident(a.attname) AS col
      FROM pg_depend d
      JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S'
      JOIN pg_namespace sn ON sn.oid = s.relnamespace
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_namespace tn ON tn.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE tn.nspname = 'public' AND d.deptype IN ('a', 'i') AND t.relname <> 'migrations'
    LOOP
      EXECUTE format(
        'SELECT setval(%L, COALESCE((SELECT max(%s) FROM %s), 0) + 1, false)',
        r.seq, r.col, r.tbl
      );
    END LOOP;
  END $$;
`;

/**
 * Masks contact details; empty values stay empty.
 *
 * Emails keep their name and only lose the domain (nikhil@gmail.com → nikhil@uat.test), so
 * everyone logs in to UAT with the same address after every sync. `.test` is reserved and never
 * delivers mail. Two addresses with the same name get "+2", "+3" … (users.email is unique).
 *
 * Phones are unique per table: row number spread by a prime, plus a random offset $1.
 */
const maskPhone = (column: string, prefix: string, prime: number) => `
  "${column}" = CASE WHEN NULLIF(x."${column}", '') IS NULL THEN x."${column}"
    ELSE '${prefix}' || lpad((n.rn * ${prime} + $1::int)::text, 9, '0') END`;

const maskEmail = () => `
  email = CASE WHEN NULLIF(x.email, '') IS NULL THEN x.email
    ELSE split_part(x.email, '@', 1)
      || CASE WHEN n.dup > 1 THEN '+' || n.dup ELSE '' END
      || '@${DATA_SYNC_EMAIL_DOMAIN}' END`;

const maskTable = (table: string, assignments: string[], hasEmail: boolean) => `
  WITH n AS (
    SELECT id,
      row_number() OVER (ORDER BY random()) AS rn
      ${
        hasEmail
          ? `, row_number() OVER (PARTITION BY lower(split_part(email, '@', 1)) ORDER BY "createdAt", id) AS dup`
          : ''
      }
    FROM ${table}
  )
  UPDATE ${table} x SET ${assignments.join(',')}
  FROM n WHERE n.id = x.id
`;

export const maskContactDetailsSql = [
  maskTable(
    'users',
    [
      maskEmail(),
      maskPhone('contactNumber', '9', 7919),
      maskPhone('emergencyContactNumber', '8', 7919),
      maskPhone('whatsappNumber', '9', 7919),
    ],
    true,
  ),
  maskTable('companies', [maskEmail(), maskPhone('contactNumber', '7', 7919)], true),
  maskTable('contractors', [maskEmail(), maskPhone('contactNumber', '7', 6007)], true),
  maskTable('vendors', [maskEmail(), maskPhone('contactNumber', '6', 7919)], true),
  maskTable('sites', [maskPhone('managerContact', '9', 4999)], false),
  maskTable('daily_status_reports', [maskPhone('reportingEngineerContact', '9', 3001)], false),
];

-- Read-only verification report. Run through verify-database.sh.
-- One REPEATABLE READ, READ ONLY transaction, so every figure comes from the same snapshot.
-- Output lines: section|object|value  (sorted and compared by compare-reports.sh)
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT 'meta|server_major|' || (current_setting('server_version_num')::int / 10000);
SELECT 'meta|db_timezone|' || current_setting('TimeZone');

-- Deterministic text output for checksums, independent of client settings.
SET LOCAL TIME ZONE 'GMT';
SET LOCAL DateStyle = 'ISO, MDY';
SET LOCAL IntervalStyle = 'postgres';
SET LOCAL bytea_output = 'hex';
SET LOCAL extra_float_digits = 1;

SELECT 'meta|extensions|' || coalesce(string_agg(extname || ':' || extversion, ',' ORDER BY extname), '') FROM pg_extension;
SELECT 'meta|schemas|' || string_agg(nspname, ',' ORDER BY nspname)
  FROM pg_namespace WHERE nspname NOT LIKE 'pg\_%' AND nspname NOT IN ('information_schema', '_system');

-- Object counts.
SELECT 'count|tables|'      || count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p');
SELECT 'count|views|'       || count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('v', 'm');
SELECT 'count|sequences|'   || count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'S';
SELECT 'count|indexes|'     || count(*) FROM pg_indexes WHERE schemaname = 'public';
SELECT 'count|constraints|' || count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace;
SELECT 'count|functions|'   || count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
SELECT 'count|triggers|'    || count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
  WHERE c.relnamespace = 'public'::regnamespace AND NOT tg.tgisinternal;

-- Exact row count for every public table.
SELECT 'rows|' || c.relname || '|' ||
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', c.relname), false, true, '')))[1]::text
  FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
  ORDER BY c.relname;

-- Full-content checksum of every public table except sessions (session rows are not migrated).
-- Rows are ordered by their text form in the "C" collation so the result is locale-independent.
SELECT 'md5|' || c.relname || '|' ||
       (xpath('/row/h/text()', query_to_xml(format(
         'SELECT md5(coalesce(string_agg(x::text, chr(10) ORDER BY x::text COLLATE "C"), %L)) AS h FROM public.%I x',
         '', c.relname), false, true, '')))[1]::text
  FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND c.relname <> 'sessions'
  ORDER BY c.relname;

-- Sequence position versus the highest value in the column it feeds.
SELECT 'seq|' || s.relname || '|' || t.relname || '.' || a.attname
       || '|last=' || coalesce(ps.last_value::text, 'unused')
       || '|max=' || m.mx
       || '|' || CASE WHEN m.mx = '0' OR coalesce(ps.last_value, 0) >= m.mx::bigint THEN 'ok' ELSE 'BEHIND' END
  FROM pg_class s
  JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')
  JOIN pg_class t ON t.oid = d.refobjid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
  JOIN pg_sequences ps ON ps.schemaname = 'public' AND ps.sequencename = s.relname
  CROSS JOIN LATERAL (SELECT (xpath('/row/m/text()', query_to_xml(format(
        'SELECT coalesce(max(%I), 0)::text AS m FROM public.%I', a.attname, t.relname), false, true, '')))[1]::text AS mx) m
  WHERE s.relkind = 'S' AND s.relnamespace = 'public'::regnamespace
  ORDER BY s.relname;

-- Every constraint and index, by name, with a checksum of its definition.
SELECT 'con|' || conrelid::regclass::text || '|' || conname || '|' || contype::text || '|' || md5(pg_get_constraintdef(oid))
  FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1;
SELECT 'idx|' || tablename || '|' || indexname || '|' || md5(indexdef)
  FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1;

COMMIT;

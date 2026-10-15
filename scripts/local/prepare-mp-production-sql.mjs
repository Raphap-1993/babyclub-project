// Generates a reviewable, transactional release script. Does not connect to a DB.
import { readFile, writeFile } from "node:fs/promises";
const migrations = [
  "20261015210000_mercadopago_checkout.sql",
  "20261015223000_mercadopago_3ds.sql",
  "20261016001000_payment_server_permissions.sql",
];
const tables = [
  "codes",
  "payments",
  "payment_webhook_events",
  "table_reservations",
  "ticket_reservation_units",
  "tickets",
];
const backup = "backup_mp_20261015";
let sql = `-- BabyClub only. No seeds, deletes, resets, or updates to customer rows.
begin isolation level repeatable read;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- Abort if this release has already been installed.
do $$ begin
  if to_regclass('public.mp_checkout_sessions') is not null then
    raise exception 'Mercado Pago is already installed; inspect migration history';
  end if;
end $$;
lock table ${tables.map((t) => "public." + t).join(", ")} in access exclusive mode;
create schema ${backup};
revoke all on schema ${backup} from public, anon, authenticated, service_role;
`;
for (const table of tables)
  sql += `create table ${backup}.${table} as table public.${table};
alter table ${backup}.${table} enable row level security;
revoke all on ${backup}.${table} from public, anon, authenticated, service_role;
`;
sql += `create table ${backup}.constraints_before as
 select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
 from pg_constraint where connamespace='public'::regnamespace;
create table ${backup}.grants_before as
 select * from information_schema.role_table_grants where table_schema='public';
create table ${backup}.policies_before as select * from pg_policies where schemaname='public';
alter table ${backup}.constraints_before enable row level security;
alter table ${backup}.grants_before enable row level security;
alter table ${backup}.policies_before enable row level security;
revoke all on all tables in schema ${backup} from public, anon, authenticated, service_role;
`;
for (const file of migrations) {
  const source = await readFile(`supabase/migrations/${file}`, "utf8");
  sql += `\n-- ${file}\n` + source.replace(/^\s*(begin|commit);\s*$/gim, "");
}
// Compare every preexisting row, excluding only the newly added nullable fields.
for (const table of tables) {
  const omit =
    table === "tickets"
      ? " - 'mp_checkout_session_id'"
      : table === "table_reservations"
        ? " - 'online_checkout_key' - 'online_checkout_token_hash' - 'online_amount_cents' - 'online_checkout_expires_at'"
        : "";
  sql += `\ndo $$ begin
  if exists ((select to_jsonb(t)${omit} as row_data from public.${table} t
    except all select to_jsonb(b) from ${backup}.${table} b)
    union all (select to_jsonb(b) from ${backup}.${table} b
    except all select to_jsonb(t)${omit} from public.${table} t)) then
    raise exception 'Historical rows changed: ${table}';
  end if;
end $$;\n`;
}
for (const file of migrations) {
  const [version, ...name] = file.replace(/\.sql$/, "").split("_");
  sql += `insert into supabase_migrations.schema_migrations(version, name, statements)
    values ('${version}', '${name.join("_")}', ARRAY['Applied transactionally with private snapshot ${backup}']);\n`;
}
sql += `notify pgrst, 'reload schema';
commit;
select 'Mercado Pago schema installed; historical rows unchanged' as result;
`;
await writeFile(".local/mp-production-release.sql", sql);
console.log(
  JSON.stringify({
    file: ".local/mp-production-release.sql",
    migrations,
    backup,
    bytes: Buffer.byteLength(sql),
  }),
);

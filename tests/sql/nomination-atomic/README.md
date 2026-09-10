# Atomic nomination regression fixtures

Synthetic fixtures for an empty, isolated PostgreSQL database named `babyclub_audit`, listening only on a Unix socket at `/tmp/babyclub-qa-pg/socket` port 54339. SQL scripts refuse another database, TCP or another port. Never run these scripts against an application database. Fixtures intentionally use a minimal subset of the current schema and constraints; they do not replace integration testing against the complete schema.

With a local role `babyclub_qa` authorized to create the fixtures:

```sh
psql -h /tmp/babyclub-qa-pg/socket -p 54339 -U babyclub_qa -d babyclub_audit -f tests/sql/nomination-atomic/fixture.sql
psql -h /tmp/babyclub-qa-pg/socket -p 54339 -U babyclub_qa -d babyclub_audit -v ON_ERROR_STOP=1 -f supabase/migrations/20260910190000_atomic_nomination_update.sql
psql -h /tmp/babyclub-qa-pg/socket -p 54339 -U babyclub_qa -d babyclub_audit -f tests/sql/nomination-atomic/atomic.test.sql
psql -h /tmp/babyclub-qa-pg/socket -p 54339 -U babyclub_qa -d babyclub_audit -f tests/sql/nomination-atomic/expired-replacement.test.sql
psql -h /tmp/babyclub-qa-pg/socket -p 54339 -U babyclub_qa -d babyclub_audit -f tests/sql/nomination-atomic/expired-own.test.sql
node tests/sql/nomination-atomic/concurrent.mjs
psql -h /tmp/babyclub-qa-pg/socket -p 54339 -U babyclub_qa -d babyclub_audit -f tests/sql/nomination-atomic/reset-fixture.sql
```

The transaction tests roll back their synthetic changes. The concurrency test commits one synthetic transfer to prove a competing write is rejected; reset only this fixture after running it. `concurrent.mjs` currently uses Homebrew's `/opt/homebrew/bin/psql`.

Coverage: contact-only stable QR; identity transfer with new QR; buyer billing unchanged; unit 1 transferable; identical retry; stale version; used/cancelled guards; injected unit-write failure rolls back ticket and person creation; public/anon/authenticated execution denied; service role allowed; unused expired general ticket preserved while a separate paid ticket is nominated; used general still blocks; two concurrent transfers yield one commit and one version conflict.

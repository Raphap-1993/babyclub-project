\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'babyclub_audit' OR inet_server_addr() IS NOT NULL OR current_setting('port') <> '54339' THEN RAISE EXCEPTION 'Only the isolated local nomination test database is allowed'; END IF; END $$;
BEGIN;
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE TABLE public.persons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),first_name text NOT NULL,last_name text NOT NULL,doc_type text DEFAULT 'dni',document text,dni varchar UNIQUE,email text,phone text,created_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX persons_document_unique ON public.persons(lower(document)) WHERE document IS NOT NULL;
CREATE TABLE public.table_reservations(id uuid PRIMARY KEY,event_id uuid NOT NULL, status text NOT NULL CHECK(status IN('pending','approved','rejected')),email text,full_name text,document text,deleted_at timestamptz);
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL,person_id uuid NOT NULL REFERENCES persons(id),table_reservation_id uuid REFERENCES table_reservations(id),qr_token text NOT NULL UNIQUE,full_name text,doc_type text,document text,dni varchar,email text,phone text,used boolean DEFAULT false,used_at timestamptz,is_active boolean NOT NULL DEFAULT true,deleted_at timestamptz,payment_status text);
CREATE TABLE public.ticket_reservation_units(id uuid PRIMARY KEY,reservation_id uuid NOT NULL REFERENCES table_reservations(id),event_id uuid NOT NULL,unit_index int NOT NULL,status text NOT NULL CHECK(status IN('pending_nomination','nominated','issued','used','cancelled')),ticket_id text,full_name text,doc_type text,document text,email text,phone text,used_at timestamptz,cancelled_at timestamptz,deleted_at timestamptz,nominated_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),CHECK(ticket_id IS NULL OR status IN('issued','used','cancelled')));
CREATE UNIQUE INDEX unit_slot ON public.ticket_reservation_units(reservation_id,unit_index) WHERE deleted_at IS NULL;
INSERT INTO persons(id,first_name,last_name,doc_type,document,dni,email,phone) VALUES('00000000-0000-0000-0000-000000000001','Persona','Compradora','dni','11112222','11112222','shared@example.test','999999999');
INSERT INTO table_reservations(id,event_id,status,email,full_name,document) VALUES('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000100','approved','shared@example.test','Persona Compradora','11112222');
INSERT INTO tickets(id,event_id,person_id,table_reservation_id,qr_token,full_name,doc_type,document,dni,email,phone) VALUES('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','original-token','Persona Compradora','dni','11112222','11112222','shared@example.test','999999999');
INSERT INTO ticket_reservation_units(id,event_id,reservation_id,unit_index,status,ticket_id,full_name,doc_type,document,email,phone,updated_at) VALUES('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000010',1,'issued','00000000-0000-0000-0000-000000000020','Persona Compradora','dni','11112222','shared@example.test','999999999','2026-09-10T00:00:00Z');

\set ON_ERROR_STOP on
CREATE TABLE events(id uuid PRIMARY KEY, starts_at timestamptz NOT NULL,entry_limit time,is_active boolean DEFAULT true,closed_at timestamptz,deleted_at timestamptz);
INSERT INTO events(id,starts_at) VALUES('00000000-0000-0000-0000-000000000100','2026-09-10T04:00:00Z');
CREATE TABLE codes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text, expires_at timestamptz);
ALTER TABLE tickets ADD code_id uuid REFERENCES codes(id);

COMMIT;

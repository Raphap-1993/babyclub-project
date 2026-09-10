\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'babyclub_audit' OR inet_server_addr() IS NOT NULL OR current_setting('port') <> '54339' THEN RAISE EXCEPTION 'Only the isolated local nomination test database is allowed'; END IF; END $$;
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERT %',label; END IF; END $$;
DO $$ DECLARE result jsonb; old_token text; before_count integer; current_version timestamptz; BEGIN
  SELECT qr_token INTO old_token FROM tickets;
  result:=update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-09-10T00:00:00Z','Persona Compradora','dni','11112222','updated@example.test','988888888');
  PERFORM pg_temp.assert_true((result->>'qr_rotated')::boolean=false,'contact retains QR');
  PERFORM pg_temp.assert_true((SELECT qr_token=old_token FROM tickets),'contact token unchanged');
  PERFORM pg_temp.assert_true((SELECT email='updated@example.test' FROM ticket_reservation_units),'contact unit updated');
  PERFORM pg_temp.assert_true((SELECT email='shared@example.test' FROM table_reservations),'buyer untouched');
  current_version:=(result->>'updated_at')::timestamptz;
  result:=update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030',current_version,'Persona Invitada','dni','33334444','shared@example.test','999999999');
  PERFORM pg_temp.assert_true((result->>'qr_rotated')::boolean,'identity rotates QR');
  PERFORM pg_temp.assert_true((SELECT qr_token<>old_token FROM tickets),'new actual token');
  PERFORM pg_temp.assert_true((SELECT person_id<>'00000000-0000-0000-0000-000000000001'::uuid FROM tickets),'shared contacts use different person');
  PERFORM pg_temp.assert_true((SELECT full_name='Persona Invitada' FROM tickets),'ticket identity');
  PERFORM pg_temp.assert_true((SELECT full_name='Persona Invitada' FROM ticket_reservation_units),'unit identity');
  PERFORM pg_temp.assert_true((SELECT full_name='Persona Compradora' AND document='11112222' FROM table_reservations),'buyer identity remains');
  SELECT qr_token INTO old_token FROM tickets; SELECT count(*) INTO before_count FROM persons;
  result:=update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030',current_version,'Persona Invitada','dni','33334444','shared@example.test','999999999');
  PERFORM pg_temp.assert_true((result->>'unchanged')::boolean,'identical replay succeeds');
  PERFORM pg_temp.assert_true((SELECT qr_token=old_token FROM tickets),'retry no rotation');
  PERFORM pg_temp.assert_true((SELECT count(*)=before_count FROM persons),'retry no extra person');
  BEGIN
    PERFORM update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030',current_version,'Persona Tercera','dni','55556666','shared@example.test','999999999');
    RAISE EXCEPTION 'expected stale conflict';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'NOMINATION_VERSION_CONFLICT' THEN RAISE; END IF; END;
  current_version:=(result->>'updated_at')::timestamptz;
  UPDATE tickets SET used=true;
  BEGIN
    PERFORM update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030',current_version,'Persona Tercera','dni','55556666','shared@example.test','999999999');
    RAISE EXCEPTION 'expected used guard';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'UNIT_NOT_EDITABLE' THEN RAISE; END IF; END;
  UPDATE tickets SET used=false; UPDATE ticket_reservation_units SET status='cancelled';
  BEGIN
    PERFORM update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030',current_version,'Persona Tercera','dni','55556666','shared@example.test','999999999');
    RAISE EXCEPTION 'expected cancelled guard';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'UNIT_NOT_EDITABLE' THEN RAISE; END IF; END;
  UPDATE ticket_reservation_units SET status='issued';
END $$;
CREATE FUNCTION pg_temp.reject_unit_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_unit_failure'; END $$;
CREATE TRIGGER synthetic_fail BEFORE UPDATE ON ticket_reservation_units FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_unit_write();
DO $$ DECLARE before_ticket jsonb; before_unit jsonb; before_count int; ver timestamptz; BEGIN
  SELECT to_jsonb(t) INTO before_ticket FROM tickets t; SELECT to_jsonb(u),updated_at INTO before_unit,ver FROM ticket_reservation_units u; SELECT count(*) INTO before_count FROM persons;
  BEGIN
    PERFORM update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030',ver,'Persona Tercera','dni','55556666','shared@example.test','999999999');
    RAISE EXCEPTION 'expected rollback';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'synthetic_unit_failure' THEN RAISE; END IF; END;
  PERFORM pg_temp.assert_true((SELECT to_jsonb(t)=before_ticket FROM tickets t),'ticket rolled back');
  PERFORM pg_temp.assert_true((SELECT to_jsonb(u)=before_unit FROM ticket_reservation_units u),'unit rolled back');
  PERFORM pg_temp.assert_true((SELECT count(*)=before_count FROM persons),'person rolled back');
END $$;
DROP TRIGGER synthetic_fail ON ticket_reservation_units;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.update_ticket_reservation_unit_nomination(uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE'),'anon denied');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','public.update_ticket_reservation_unit_nomination(uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE'),'authenticated denied');
SELECT pg_temp.assert_true(has_function_privilege('service_role','public.update_ticket_reservation_unit_nomination(uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE'),'service_role allowed');
ROLLBACK;

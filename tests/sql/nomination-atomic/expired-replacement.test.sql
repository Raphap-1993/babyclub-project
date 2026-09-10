\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'babyclub_audit' OR inet_server_addr() IS NOT NULL OR current_setting('port') <> '54339' THEN RAISE EXCEPTION 'Only the isolated local nomination test database is allowed'; END IF; END $$;
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO persons(id,first_name,last_name,doc_type,document,dni) VALUES('00000000-0000-0000-0000-000000000002','Persona','Free','dni','33334444','33334444');
INSERT INTO codes(id,type,expires_at) VALUES('00000000-0000-0000-0000-000000000005','general','2000-01-01T00:00:00Z');
INSERT INTO tickets(id,event_id,person_id,code_id,qr_token,full_name,doc_type,document,dni) VALUES('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000005','expired-free-original','Persona Free','dni','33334444','33334444');
DO $$ DECLARE v timestamptz; r jsonb; BEGIN
  SELECT updated_at INTO v FROM ticket_reservation_units WHERE id='00000000-0000-0000-0000-000000000030';
  r:=update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030',v,'Persona Free','dni','33334444','shared@example.test','999999999');
  IF (r->>'qr_rotated')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'expected replacement'; END IF;
  IF NOT EXISTS(SELECT FROM tickets WHERE id='00000000-0000-0000-0000-000000000021' AND qr_token='expired-free-original' AND used=false AND is_active=true) THEN RAISE EXCEPTION 'free history changed'; END IF;
  r:=update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030',(r->>'updated_at')::timestamptz,'Persona Compradora','dni','11112222','shared@example.test','999999999');
  UPDATE tickets SET used=true WHERE id='00000000-0000-0000-0000-000000000021';
  BEGIN
    PERFORM update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030',(r->>'updated_at')::timestamptz,'Persona Free','dni','33334444','shared@example.test','999999999');
    RAISE EXCEPTION 'expected used free conflict';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'EVENT_TICKET_IDENTITY_CONFLICT' THEN RAISE; END IF; END;
END $$;
ROLLBACK;

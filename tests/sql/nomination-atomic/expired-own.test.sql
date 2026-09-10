\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'babyclub_audit' OR inet_server_addr() IS NOT NULL OR current_setting('port') <> '54339' THEN RAISE EXCEPTION 'Only the isolated local nomination test database is allowed'; END IF; END $$;
BEGIN;
INSERT INTO codes(id,type,expires_at) VALUES('00000000-0000-0000-0000-000000000006','courtesy','2000-01-01T00:00:00Z');
UPDATE tickets SET code_id='00000000-0000-0000-0000-000000000006' WHERE id='00000000-0000-0000-0000-000000000020';
DO $$ BEGIN
  BEGIN
    PERFORM update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-09-10T00:00:00Z','Persona Compradora','dni','11112222','new@example.test','999999999');
    RAISE EXCEPTION 'expected expired guard';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'UNIT_EXPIRED' THEN RAISE; END IF; END;
END $$;
UPDATE codes SET type='general',expires_at=null WHERE id='00000000-0000-0000-0000-000000000006';
UPDATE events SET starts_at='2000-01-01T04:00:00Z',entry_limit='00:30' WHERE id='00000000-0000-0000-0000-000000000100';
DO $$ BEGIN
  BEGIN
    PERFORM update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-09-10T00:00:00Z','Persona Invitada','dni','33334444','new@example.test','999999999');
    RAISE EXCEPTION 'expected general cutoff guard';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'UNIT_EXPIRED' THEN RAISE; END IF; END;
END $$;
ROLLBACK;

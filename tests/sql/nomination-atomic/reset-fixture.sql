\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'babyclub_audit' OR inet_server_addr() IS NOT NULL OR current_setting('port') <> '54339' THEN RAISE EXCEPTION 'Only the isolated local nomination test database is allowed'; END IF; END $$;
\set ON_ERROR_STOP on
UPDATE tickets SET person_id='00000000-0000-0000-0000-000000000001',qr_token='original-token',full_name='Persona Compradora',doc_type='dni',document='11112222',dni='11112222',email='shared@example.test',phone='999999999',used=false,used_at=null WHERE id='00000000-0000-0000-0000-000000000020';
UPDATE ticket_reservation_units SET full_name='Persona Compradora',doc_type='dni',document='11112222',email='shared@example.test',phone='999999999',status='issued',updated_at='2026-09-10T00:00:00Z',used_at=null,cancelled_at=null WHERE id='00000000-0000-0000-0000-000000000030';
DELETE FROM persons WHERE id<>'00000000-0000-0000-0000-000000000001';

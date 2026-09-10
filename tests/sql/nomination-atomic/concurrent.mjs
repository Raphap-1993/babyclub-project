import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const args=['-h','/tmp/babyclub-qa-pg/socket','-p','54339','-U','babyclub_qa','-d','babyclub_audit','-v','ON_ERROR_STOP=1','-At','-c'];
function sql(text){return new Promise(resolve=>{const p=spawn('/opt/homebrew/bin/psql',[...args,text]);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('close',code=>resolve({code,out,err}));});}
const call=(name,doc)=>`select public.update_ticket_reservation_unit_nomination('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000030','2026-09-10T00:00:00Z','${name}','dni','${doc}','shared@example.test','999999999');`;
const first=sql('BEGIN;'+call('Persona Concurrente A','55556666')+'SELECT pg_sleep(0.5); COMMIT;');
await new Promise(r=>setTimeout(r,100));
const second=sql(call('Persona Concurrente B','77778888'));
const [a,b]=await Promise.all([first,second]);
assert.equal(a.code,0,a.err);assert.notEqual(b.code,0);assert.match(b.err,/NOMINATION_VERSION_CONFLICT/);
const result=await sql("select count(*) from persons where document in ('55556666','77778888');");
assert.equal(result.out.trim(),'1');console.log('PASS concurrent CAS: one update committed; second rejected; no orphan person.');

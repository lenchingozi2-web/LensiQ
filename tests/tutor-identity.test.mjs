import test from 'node:test';
import assert from 'node:assert/strict';
import {isSyllabusTutor,acceptTutorPacket,SYLLABUS_PROTOCOL} from '../lib/live-class/tutor-identity.ts';
test('unmarked, legacy and cross-session agents cannot control the classroom',()=>{
  const session='session-a', valid={isAgent:true,identity:'agent-a',attributes:{'lensiq.protocol':SYLLABUS_PROTOCOL,'lensiq.session':session}};
  assert.equal(isSyllabusTutor(valid,session),true);
  assert.equal(isSyllabusTutor(valid,'session-b'),false);
  assert.equal(isSyllabusTutor({isAgent:true,identity:'legacy',attributes:{}},session),false);
  assert.equal(isSyllabusTutor({...valid,isAgent:false},session),false);
  assert.equal(isSyllabusTutor(undefined,session),false);
});
test('session proof works before RTC attributes arrive and rejects cross-room data',()=>{
  const session='session-c', participant={isAgent:true,identity:'worker-c',attributes:{}};
  const msg={type:'WORKER_READY',session_id:session,protocol:SYLLABUS_PROTOCOL};
  assert.equal(acceptTutorPacket({...participant,isAgent:false},session,'lk-lesson-state',msg),false);
  assert.equal(acceptTutorPacket(participant,'other','lk-lesson-state',msg),false);
  assert.equal(acceptTutorPacket(participant,session,'legacy-channel',msg),false);
  assert.equal(acceptTutorPacket(participant,session,'lk-lesson-state',{...msg,protocol:undefined}),false);
  assert.equal(acceptTutorPacket(participant,session,'lk-lesson-state',msg),true);
  assert.equal(isSyllabusTutor(participant,session),true);
  assert.equal(isSyllabusTutor({...participant,identity:'another'},session),false);
});

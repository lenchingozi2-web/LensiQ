import test from 'node:test';
import assert from 'node:assert/strict';
import {isSyllabusTutor,SYLLABUS_PROTOCOL} from '../lib/live-class/tutor-identity.ts';
test('legacy, unmarked and cross-session agents may never control the classroom',()=>{
  const session='session-a', valid={isAgent:true,attributes:{'lensiq.protocol':SYLLABUS_PROTOCOL,'lensiq.session':session}};
  assert.equal(isSyllabusTutor(valid,session),true);
  assert.equal(isSyllabusTutor(valid,'session-b'),false);
  assert.equal(isSyllabusTutor({isAgent:true,attributes:{}},session),false);
  assert.equal(isSyllabusTutor({...valid,isAgent:false},session),false);
  assert.equal(isSyllabusTutor(undefined,session),false);
});

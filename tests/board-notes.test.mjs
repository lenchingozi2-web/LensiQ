import test from 'node:test';import assert from 'node:assert/strict';
import {progressiveAnchors} from '../lib/live-class/board-notes.ts';
test('recap duplicates do not masquerade as board progression',()=>{
 assert.deepEqual(progressiveAnchors(['Male predominance','Age >50 years'],['Recap: Male, >50','High-risk profile']),['Male predominance','Age >50 years','High-risk profile']);
 assert.deepEqual(progressiveAnchors(['Avoid below 15 mL/min'],['Use above 15 mL/min']),['Avoid below 15 mL/min','Use above 15 mL/min']);
});

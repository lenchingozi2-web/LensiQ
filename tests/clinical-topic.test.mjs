import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicalTopicLabels } from '../lib/rag/clinical-topic.ts';

test('clinical navigation does not group two diseases under a single generic heading', () => {
  assert.deepEqual(clinicalTopicLabels([
    'Tuberculosis', 'Etiology', 'Pathogenesis', 'Morphology', 'Clinical features',
    'Pneumonia', 'Etiology', 'Pathogenesis', 'Investigations', 'Complications',
  ]), [
    'Tuberculosis', 'Tuberculosis · Etiology', 'Tuberculosis · Pathogenesis',
    'Tuberculosis · Morphology', 'Tuberculosis · Clinical features',
    'Pneumonia', 'Pneumonia · Etiology', 'Pneumonia · Pathogenesis',
    'Pneumonia · Investigations', 'Pneumonia · Complications and prognosis',
  ]);
});

test('qualified headings are kept exactly, and each document has independent context', () => {
  assert.deepEqual(clinicalTopicLabels(['Mechanism of action of propranolol', '2. Risk factors:', 'Slide 4']), [
    'Mechanism of action of propranolol', 'Mechanism of action of propranolol · Etiology',
    'Mechanism of action of propranolol · Slide 4',
  ]);
  assert.deepEqual(clinicalTopicLabels(['Treatment', 'Differential diagnosis', 'Prognosis']), [
    'Management', 'Investigations', 'Complications and prognosis',
  ]);
});

test('lecturer initials never replace the clinical topic inherited by later sections',()=>{
 assert.deepEqual(clinicalTopicLabels(['Prostate cancer','ONWUMELU.C','Epidemiology','Morphology']),['Prostate cancer','Prostate cancer · Source attribution','Prostate cancer · Foundations','Prostate cancer · Morphology']);
 assert.deepEqual(clinicalTopicLabels(['ONWUMELU.C','Definition']),['Source attribution','Foundations']);
});

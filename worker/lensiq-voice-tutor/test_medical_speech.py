import unittest
from medical_speech import medical_speech, spoken_sentences
class SpeechTests(unittest.IsolatedAsyncioTestCase):
    def test_units_qualifications_and_numeric_values_are_preserved(self):
        value=medical_speech('Avoid 0.5 mg if eGFR <15 mL/min; HbA1c is 7.5%.')
        self.assertIn('0.5 milligrams',value);self.assertIn('less than 15 millilitres per minute',value)
        self.assertIn('Avoid',value);self.assertIn('7.5%',value)
    def test_speed_markup_cannot_change_selected_pace(self):
        self.assertEqual(medical_speech('<speed value="1.5"/>Use 5 mg.'),'Use 5 milligrams.')
    async def test_medical_words_split_across_stream_tokens_remain_intact(self):
        async def parts():
            for text in ['Pharmaco','kinetics studies elimination. ','Avoid 5 ','mg.']:yield text
        rendered=[text async for text in spoken_sentences(parts())]
        self.assertEqual(len(rendered),2);self.assertIn('<<',rendered[0]);self.assertEqual(rendered[1],'Avoid 5 milligrams.')

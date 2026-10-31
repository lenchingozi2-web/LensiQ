import unittest
from repair_question_bank import cleanup,key,transform,medical_key
class RepairTests(unittest.TestCase):
    def test_mojibake(self):
        self.assertEqual(cleanup('â€œAcethylcholineâ€\x9d'), '“Acetylcholine”')
    def test_key(self):
        self.assertEqual(key('Option B.',{'B':'answer'}),'B')
    def test_erase_known_answer_marker(self):
        changes,flags=transform({'type':'mcq','question_text':'Which is true?','option_a':'X','option_b':'Y (Correct)','correct_answer':'B'})
        self.assertEqual(changes['option_b'],'Y')
    def test_never_guess_conflicts(self):
        changes,flags=transform({'type':'mcq','question_text':'Which is true?','option_a':'X','option_b':'Y (Correct)','correct_answer':'A'})
        self.assertNotIn('correct_answer',changes)
        self.assertIn('conflicting_correct_mark',flags)
    def test_bacterial_transfer(self):
        case={'question_text':'Which is false about genetic transfer in bacteria?'}
        self.assertEqual(medical_key(case,{'A':'It is unidirectional','B':'It is bi-directional'}),'B')
if __name__=='__main__':unittest.main()

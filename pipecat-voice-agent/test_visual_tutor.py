"""Regression tests for the *real* worker's visual routing and interaction contract."""
import importlib.util
from pathlib import Path
import unittest

MODULE = Path(__file__).resolve().parent / "visual_tutor.py"
spec = importlib.util.spec_from_file_location("visual_tutor", MODULE)
visual = importlib.util.module_from_spec(spec)
spec.loader.exec_module(visual)

MODELS = {
    "gramCellEnvelope": "https://example.org/gram.glb",
    "coagulativeNecrosis": "https://example.org/necrosis.glb",
    "hraLung": "https://example.org/lung.glb",
    "hraHeart": "https://example.org/heart.glb",
    "heraFake": "https://example.org/fake.glb",
}
MOLECULES = {
    "dihydrofolateReductase": {"modelUrl": "https://example.org/1U72.pdb"},
}
class VisualTutorContract(unittest.TestCase):
    def test_relevant_approved_pathology_before_generic_organ(self):
        result=visual.select_visual("During coagulative necrosis the cell outlines persist.",MODELS,MOLECULES)
        self.assertEqual(result["modelUrl"],MODELS["coagulativeNecrosis"])
        self.assertIn("schematic",result["note"])
    def test_relevant_hra_is_not_a_disease_specimen(self):
        result=visual.select_visual("Pneumonia affects the lung anatomy and alveoli.",MODELS,MOLECULES)
        self.assertEqual(result["modelUrl"],MODELS["hraLung"])
        self.assertIn("healthy reference",result["note"])
    def test_drug_target_binding_not_confused_with_general_drug(self):
        result=visual.select_visual("Methotrexate inhibits dihydrofolate reductase.",MODELS,MOLECULES)
        self.assertEqual(result["type"],"show_molecular_model")
    def test_competitive_antagonism_demonstration(self):
        result=visual.select_visual("Competitive antagonism shifts the dose response curve.",MODELS,MOLECULES)
        self.assertEqual(result["preset"],"competitive_antagonism")
    def test_no_unapproved_guess(self):
        self.assertIsNone(visual.select_visual("The strange structure of a new unknown virus.",MODELS,MOLECULES))
        self.assertIsNone(visual.select_visual("Hepatic cirrhosis and hepatocyte nodules.",MODELS,MOLECULES))
    def test_pacing_keeps_same_visual_and_avoids_rapid_switch(self):
        pacer=visual.VisualPacer(MODELS,MOLECULES)
        first=pacer.next_for_spoken("The lung anatomy includes multiple pulmonary lobes.")
        self.assertIsNotNone(first)
        self.assertIsNone(pacer.next_for_spoken("Pneumonia is a common disease of the lung anatomy."))
        second=pacer.next_for_spoken("The heart anatomy has four chambers.")
        self.assertIsNone(pacer.next_for_spoken("The right ventricle pumps deoxygenated blood into the pulmonary artery."))
        self.assertEqual(second["modelUrl"],MODELS["hraHeart"])
    def test_accepted_named_structure(self):
        self.assertIn("right ventricle",visual.structure_focus({
            "modelUrl":MODELS["hraHeart"],"structureId":"heart right ventricle"},MODELS))
    def test_unapproved_structure_or_model_rejected(self):
        self.assertIsNone(visual.structure_focus({"modelUrl":"https://evil.test/fake.glb","structureId":"right ventricle"},MODELS))
        self.assertIsNone(visual.structure_focus({"modelUrl":MODELS["hraHeart"],"structureId":""},MODELS))
    def test_simulation_result_is_validated_not_injected(self):
        values={"bicarbonate":24,"arterialPCO2":40}
        snapshot=visual.simulation_snapshot({"preset":"acid_base_balance","variables":values,
                                             "result":7.4,"unit":"pH"})
        self.assertIn("bicarbonate",snapshot)
        self.assertIsNone(visual.simulation_snapshot({"preset":"acid_base_balance","variables":values,
                                             "result":"<evil>","unit":"pH"}))
        self.assertIsNone(visual.simulation_snapshot({"preset":"acid_base_balance","variables":{**values,"extra":5},
                                             "result":7.4,"unit":"pH"}))
        self.assertIsNone(visual.simulation_snapshot({"preset":"acid_base_balance","variables":values,
                                             "result":float("nan"),"unit":"pH"}))
    def test_rich_context_for_interactive_experiment(self):
        output=visual.interaction_focus({"type":"simulation_result","preset":"drug_half_life",
                "variables":{"halfLife":6,"elapsed":12},"result":25,"unit":"%"},MODELS)
        self.assertIn("25",output)
        self.assertIn("not patient data",output)
    def test_user_text_cannot_add_html_markup(self):
        output=visual.interaction_focus({"type":"concept_selected","concept":"leukocyte <script>alert(1)</script>"},MODELS)
        self.assertNotIn("<",output)

if __name__=="__main__":
    unittest.main()

import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("probe-live-providers.py")
SPEC = importlib.util.spec_from_file_location("provider_probe", SCRIPT)
PROBE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROBE)


class ProviderProbeClassificationTests(unittest.TestCase):
    def test_verified_groq_models_are_probed_before_unavailable_gemini_models(self):
        with patch.dict(os.environ, {}, clear=True):
            models = PROBE.candidates()
        self.assertEqual(models[:2], [("groq", "openai/gpt-oss-20b"), ("groq", "openai/gpt-oss-120b")])

    def test_success_and_model_availability(self):
        self.assertEqual(PROBE.classify("gemini", 200, b"{}"), "success")
        self.assertEqual(PROBE.classify("groq", 404, b'{"error":"model_not_found"}'), "unavailable_model")
        self.assertEqual(PROBE.classify("gemini", 400, b"Model not found for API version"), "unavailable_model")

    def test_explicit_hard_daily_or_billing_quota_is_distinguished_from_transient_429(self):
        self.assertEqual(PROBE.classify("gemini", 429, b'{"status":"RESOURCE_EXHAUSTED","message":"quota exceeded per day"}'),
                         "hard_daily_or_billing_quota")
        google_quota = b'{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}'
        self.assertEqual(PROBE.classify("gemini", 429, google_quota), "hard_daily_or_billing_quota")
        self.assertEqual(PROBE.classify("groq", 429, b'{"code":"insufficient_quota"}'),
                         "hard_daily_or_billing_quota")
        self.assertEqual(PROBE.classify("groq", 429, b'{"message":"Too many requests per minute"}'),
                         "transient_limit")
        self.assertEqual(PROBE.classify("gemini", 429, b'{"message":"temporary rate limit"}'),
                         "transient_limit")

    def test_timeout_transport_and_access_failures_have_separate_labels(self):
        self.assertEqual(PROBE.classify("groq", 503, b"upstream error"), "transient_failure")
        self.assertEqual(PROBE.classify("gemini", 403, b"invalid credential"), "access_error")
        self.assertEqual(PROBE.classify("gemini", 500, b""), "transient_failure")


if __name__ == "__main__":
    unittest.main()

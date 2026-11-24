"""Probe configured production LLM candidates with tiny requests and redacted results.

This script must never print credentials, prompts, response bodies, or provider error text.
"""
import json
import os
import re
import socket
import urllib.error
import urllib.request

TIMEOUT_SECONDS = 12


def candidates():
    items = [
        ("gemini", os.getenv("GEMINI_SYLLABUS_MODEL") or os.getenv("GEMINI_CLASS_BRAIN_MODEL") or "gemini-3.8-flash"),
        ("groq", os.getenv("GROQ_CLASS_MOUTH_MODEL") or "openai/gpt-oss-20b"),
        ("gemini", os.getenv("GEMINI_FALLBACK_MODEL") or "gemini-3.6-flash"),
        ("groq", "openai/gpt-oss-120b"),
    ]
    seen = set()
    result = []
    for provider, model in items:
        if (provider, model) not in seen:
            seen.add((provider, model))
            result.append((provider, model))
    return result


def classify(provider, status, body):
    raw = body.decode("utf-8", "replace")[:12000].lower()
    if status == 200:
        return "success"
    unavailable = ("model_not_found", "model not found", "not found for api version", "not supported", "unknown model")
    if status in (400, 404) and any(term in raw for term in unavailable):
        return "unavailable_model"
    if status == 404:
        return "unavailable_model"
    if status in (401, 403):
        if any(term in raw for term in unavailable):
            return "unavailable_model"
        return "access_error"
    hard = (
        "insufficient_quota", "billing not enabled", "billing account", "billing limit",
        "daily limit", "per day", "requests_per_day", "tokens_per_day", "daily_quota",
        "requests[a-z_]*perday", "tokens[a-z_]*perday", "generate_content[a-z_]*perday",
        "quota exceeded for this billing", "resource_exhausted.*day", "quota limit.*day",
        "limit.*daily", "daily.*limit", "exceeded your current quota",
    )
    if status == 429:
        return "hard_daily_or_billing_quota" if any(re.search(term, raw) for term in hard) else "transient_limit"
    if status in (408, 425) or status >= 500:
        return "transient_failure"
    return "provider_error"


def request(provider, model, key):
    if provider == "gemini":
        url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent"
        headers = {"content-type": "application/json", "x-goog-api-key": key}
        body = {"contents": [{"role": "user", "parts": [{"text": "Reply with OK."}]}],
                "generationConfig": {"maxOutputTokens": 8}}
    else:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"content-type": "application/json", "authorization": "Bearer " + key}
        body = {"model": model, "messages": [{"role": "user", "content": "Reply with OK."}],
                "max_completion_tokens": 8, "temperature": 0}
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            payload = response.read(12000)
            return classify(provider, response.status, payload), response.headers.get("Retry-After")
    except urllib.error.HTTPError as error:
        payload = error.read(12000)
        return classify(provider, error.code, payload), error.headers.get("Retry-After")
    except (TimeoutError, socket.timeout):
        return "timeout", None
    except urllib.error.URLError as error:
        if isinstance(getattr(error, "reason", None), (TimeoutError, socket.timeout)):
            return "timeout", None
        return "transport_error", None


def main():
    keys = {"gemini": os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY"),
            "groq": os.getenv("GROQ_API_KEY")}
    if not keys["gemini"] or not keys["groq"]:
        raise SystemExit("Provider probe refused: expected production Gemini and Groq credentials are missing")
    results = []
    for provider, model in candidates():
        status, retry_after = request(provider, model, keys[provider])
        result = {"provider": provider, "model": model, "status": status}
        if retry_after:
            result["retry_after_present"] = True
        results.append(result)
        print(json.dumps(result, sort_keys=True), flush=True)
    available = [row for row in results if row["status"] != "unavailable_model"]
    hard = [row for row in available if row["status"] == "hard_daily_or_billing_quota"]
    if available and len(hard) == len(available):
        print("STOP: every available Gemini/Groq model returned an explicit hard daily or billing quota; deployment was not started.", flush=True)
        raise SystemExit(23)
    print("Provider probe completed; no all-model hard-quota deployment block was triggered.", flush=True)


if __name__ == "__main__":
    main()

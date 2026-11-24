# Provider model verification

Checked 2026-11-24 against the providers' public catalogs and rate-limit documentation.

- Google lists `gemini-3.8-flash` and `gemini-3.6-flash` in the Gemini API model catalog. The changelog states that `gemini-3.8-flash` became generally available on 2026-09-02, and that Gemini 3.7 Flash and 3.5 Flash were replaced by 3.8 and 3.6, respectively. Sources: [Gemini API models](https://aistudio.google.com/docs/models), [Gemini API changelog](https://aistudio.google.com/docs/changelog).
- Groq's catalog lists `openai/gpt-oss-20b` and `openai/gpt-oss-120b` as production models. It lists `qwen/qwen3.8-27b` as a preview model, which Groq says is intended for evaluation and may be discontinued at short notice. Source: [Groq supported models](https://console.groq.com/docs/models).
- Gemini quotas vary by model, project, usage tier, and account status. The public documentation says actual capacity may vary and directs account owners to AI Studio to view active rate limits. Source: [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

This sandbox did not have Gemini or Groq API credentials, so it could not query the configured production accounts' active model list, quota, or live reliability. Public catalog status is not evidence that a given project has available quota.

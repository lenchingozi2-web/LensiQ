# LenxiQ LiveKit Voice Agent Deployment

This repository contains the separate LenxiQ realtime voice-agent worker. The Next.js web application remains in the main `LensiQ` repository; this worker connects to LiveKit rooms and provides speech recognition, language-model responses, and speech synthesis.

## GitHub repository secrets

Add the following repository secrets in **Settings → Secrets and variables → Actions → New repository secret**. Do not add them to source files, `.env` files committed to GitHub, issues, pull requests, or chat messages.

| Secret                 | Purpose                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `LIVEKIT_URL`          | LiveKit Cloud project WebSocket URL.                                           |
| `LIVEKIT_API_KEY`      | LiveKit project API key used by the deployment action.                         |
| `LIVEKIT_API_SECRET`   | LiveKit project API secret used by the deployment action.                      |
| `DEEPGRAM_API_KEY`     | Deepgram Nova-3 speech-to-text access for the worker.                          |
| `CARTESIA_API_KEY`     | Cartesia speech-synthesis access for the worker.                               |
| `LIVEKIT_AGENT_REGION` | Optional deployment region; leave unset to use LiveKit Cloud’s nearest region. |

The workflow combines the Deepgram and Cartesia values into the action’s `SECRET_LIST`. The action passes them to the deployed agent as runtime environment variables. GitHub Actions masks configured secret values in logs, but logs must still be treated as sensitive.

## First deployment

The first deployment must be started manually because the repository does not initially contain `livekit.toml`. Open the repository’s **Actions** tab, select **Deploy LenxiQ LiveKit Voice Agent**, choose **Run workflow**, choose `create`, and run it from `main`.

The `create` operation creates the LiveKit Cloud agent and deploys it. It also generates the agent configuration. The workflow then opens a pull request containing `livekit.toml`. Review and merge that pull request into `main`.

After `livekit.toml` is present on `main`, subsequent changes under `src/`, the Dockerfile, package files, or the workflow automatically trigger the `deploy` operation.

## Manual verification

The same workflow supports `status-retry` from **Actions → Run workflow**. Use it after the first deployment or after changing secrets. It waits up to five minutes for the agent to report a running state.

The worker expects these provider variables at runtime:

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
DEEPGRAM_API_KEY
CARTESIA_API_KEY
```

Never add real values to `.env.example`; it is intentionally a blank template for local development.

## Security guidance

Use a separate LiveKit project key for deployment if your team’s policy supports key rotation. Grant only the GitHub repository and LiveKit project access required for this agent. If a key is exposed, revoke it immediately in the provider dashboard, generate a replacement, update the GitHub repository secret, and rerun the deployment workflow.

import { AccessToken } from 'livekit-server-sdk';

export type ProviderState = 'live' | 'unavailable' | 'error';

export type ProviderStatus = {
  id: 'deepgram' | 'cartesia' | 'livekit' | 'deepseek';
  name: string;
  state: ProviderState;
  message: string;
  checkedAt: string;
  billingUrl: string;
  docsUrl: string;
  balance?: Array<{ amount: number | null; units: string | null; label?: string | null }>;
  usage?: { value: number; unit: string; label: string }[];
  plan?: string | null;
};

const TIMEOUT_MS = 8000;
const CARTESIA_VERSION = '2026-08-14';

async function fetchJson(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

function unavailable(id: ProviderStatus['id'], name: string, message: string, billingUrl: string, docsUrl: string): ProviderStatus {
  return { id, name, state: 'unavailable', message, checkedAt: new Date().toISOString(), billingUrl, docsUrl };
}

function errorStatus(base: ProviderStatus, message: string): ProviderStatus {
  return { ...base, state: 'error', message, checkedAt: new Date().toISOString() };
}

async function deepgramStatus(): Promise<ProviderStatus> {
  const key = process.env.DEEPGRAM_API_KEY;
  const configuredProjectId = process.env.DEEPGRAM_PROJECT_ID;
  const base = { id: 'deepgram' as const, name: 'Deepgram', billingUrl: 'https://console.deepgram.com/', docsUrl: 'https://developers.deepgram.com/reference/manage/billing/list' };
  if (!key) return unavailable(base.id, base.name, 'Deepgram API key is not configured for provider monitoring.', base.billingUrl, base.docsUrl);
  try {
    let projectId = configuredProjectId;
    if (!projectId) {
      const projectsResult = await fetchJson('https://api.deepgram.com/v1/projects', { headers: { Authorization: `Token ${key}`, Accept: 'application/json' } });
      if (!projectsResult.response.ok) return errorStatus({ ...base, state: 'live', message: '', checkedAt: new Date().toISOString() }, `Deepgram project discovery returned HTTP ${projectsResult.response.status}.`);
      const projects = Array.isArray(projectsResult.body?.projects) ? projectsResult.body.projects.filter((project: { project_id?: unknown }): project is { project_id: string } => typeof project.project_id === 'string') : [];
      if (projects.length !== 1) return unavailable(base.id, base.name, projects.length === 0 ? 'Deepgram returned no projects for this API key.' : 'Deepgram has multiple projects; set DEEPGRAM_PROJECT_ID to choose the project whose balance should be monitored.', base.billingUrl, base.docsUrl);
      projectId = projects[0].project_id;
    }
    if (!projectId) return unavailable(base.id, base.name, 'Deepgram project ID is unavailable for balance monitoring.', base.billingUrl, base.docsUrl);
    const { response, body } = await fetchJson(`https://api.deepgram.com/v1/projects/${encodeURIComponent(projectId)}/balances`, { headers: { Authorization: `Token ${key}`, Accept: 'application/json' } });
    if (!response.ok) return errorStatus({ ...base, state: 'live', message: '', checkedAt: new Date().toISOString() }, `Deepgram returned HTTP ${response.status}. Check the project ID and key scope.`);
    const values = Array.isArray(body?.balances) ? body.balances : [];
    return { ...base, state: 'live', message: values.length ? 'Live project balance retrieved from Deepgram.' : 'Deepgram responded successfully; no outstanding balance rows were returned.', checkedAt: new Date().toISOString(), balance: values.map((item: { amount?: unknown; units?: unknown; purchase_order_id?: unknown }) => ({ amount: typeof item.amount === 'number' ? item.amount : Number(item.amount ?? NaN), units: typeof item.units === 'string' ? item.units : null, label: typeof item.purchase_order_id === 'string' ? item.purchase_order_id : null })) };
  } catch {
    return errorStatus({ ...base, state: 'live', message: '', checkedAt: new Date().toISOString() }, 'Deepgram balance request timed out or failed.');
  }
}

async function cartesiaStatus(): Promise<ProviderStatus> {
  const key = process.env.CARTESIA_ADMIN_API_KEY;
  const base = { id: 'cartesia' as const, name: 'Cartesia', billingUrl: 'https://play.cartesia.ai/subscription', docsUrl: 'https://docs.cartesia.ai/api-reference/usage/credits' };
  if (!key) return unavailable(base.id, base.name, 'Cartesia monitoring requires a separate admin API key; the standard TTS key is not sufficient.', base.billingUrl, base.docsUrl);
  try {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    const headers = { Authorization: `Bearer ${key}`, 'Cartesia-Version': CARTESIA_VERSION, Accept: 'application/json' };
    const [creditsResult, agentsResult] = await Promise.all([
      fetchJson(`https://api.cartesia.ai/usage/credits?start_ts=${encodeURIComponent(start.toISOString())}&end_ts=${encodeURIComponent(end.toISOString())}&interval=month`, { headers }),
      fetchJson(`https://api.cartesia.ai/usage/agents?start_ts=${encodeURIComponent(start.toISOString())}&end_ts=${encodeURIComponent(end.toISOString())}&interval=month`, { headers }),
    ]);
    if (!creditsResult.response.ok || !agentsResult.response.ok) {
      const status = !creditsResult.response.ok ? creditsResult.response.status : agentsResult.response.status;
      return errorStatus({ ...base, state: 'live', message: '', checkedAt: new Date().toISOString() }, `Cartesia returned HTTP ${status}. An admin API key is required for usage endpoints.`);
    }
    const creditRows = Array.isArray(creditsResult.body?.data) ? creditsResult.body.data : [];
    const agentRows = Array.isArray(agentsResult.body?.data) ? agentsResult.body.data : [];
    const credits = creditRows.reduce((sum: number, row: { credits?: unknown }) => sum + Number(row.credits ?? 0), 0);
    const cents = agentRows.reduce((sum: number, row: { cents?: unknown }) => sum + Number(row.cents ?? 0), 0);
    const minutes = agentRows.reduce((sum: number, row: { minutes?: unknown }) => sum + Number(row.minutes ?? 0), 0);
    const calls = agentRows.reduce((sum: number, row: { calls?: unknown }) => sum + Number(row.calls ?? 0), 0);
    return { ...base, state: 'live', message: 'Live Cartesia usage retrieved for the current UTC month. Current subscription balance is available in the billing console.', checkedAt: new Date().toISOString(), usage: [{ value: credits, unit: 'credits', label: 'TTS/STT credits used this month' }, { value: cents / 100, unit: 'USD', label: 'Hosted agent usage this month' }, { value: minutes, unit: 'minutes', label: 'Hosted agent minutes this month' }, { value: calls, unit: 'calls', label: 'Hosted agent calls this month' }] };
  } catch {
    return errorStatus({ ...base, state: 'live', message: '', checkedAt: new Date().toISOString() }, 'Cartesia usage request timed out or failed.');
  }
}

async function livekitStatus(): Promise<ProviderStatus> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const projectId = process.env.LIVEKIT_CLOUD_PROJECT_ID;
  const base = { id: 'livekit' as const, name: 'LiveKit Cloud', billingUrl: 'https://cloud.livekit.io/', docsUrl: 'https://docs.livekit.io/deploy/admin/analytics-api/' };
  if (!apiKey || !apiSecret || !projectId) return unavailable(base.id, base.name, 'LiveKit live analytics requires LIVEKIT_CLOUD_PROJECT_ID plus the server API credentials. Billing balance remains in the LiveKit Cloud console.', base.billingUrl, base.docsUrl);
  try {
    const token = new AccessToken(apiKey, apiSecret, { ttl: 60 * 10 });
    token.addGrant({ roomList: true });
    const jwt = await token.toJwt();
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const endpoint = `https://cloud-api.livekit.io/api/project/${encodeURIComponent(projectId)}/sessions?start=${start.toISOString().slice(0, 10)}&end=${end.toISOString().slice(0, 10)}&page=0&limit=100`;
    const { response, body } = await fetchJson(endpoint, { headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' } });
    if (!response.ok) return errorStatus({ ...base, state: 'live', message: '', checkedAt: new Date().toISOString() }, `LiveKit returned HTTP ${response.status}. Analytics API access may require the Scale plan or higher.`);
    const sessions = Array.isArray(body?.sessions) ? body.sessions : [];
    const durationMinutes = sessions.reduce((sum: number, row: { createdAt?: string; endedAt?: string }) => {
      const from = row.createdAt ? Date.parse(row.createdAt) : NaN;
      const to = row.endedAt ? Date.parse(row.endedAt) : NaN;
      return Number.isFinite(from) && Number.isFinite(to) && to >= from ? sum + (to - from) / 60000 : sum;
    }, 0);
    return { ...base, state: 'live', message: 'LiveKit session analytics retrieved for the last seven days. Billing plan and invoice balance remain in the LiveKit Cloud console.', checkedAt: new Date().toISOString(), usage: [{ value: sessions.length, unit: 'sessions', label: 'Sessions in the last 7 days' }, { value: durationMinutes, unit: 'minutes', label: 'Observed session duration' }] };
  } catch {
    return errorStatus({ ...base, state: 'live', message: '', checkedAt: new Date().toISOString() }, 'LiveKit analytics request timed out or failed.');
  }
}

async function deepseekStatus(): Promise<ProviderStatus> {
  const key = process.env.DEEPSEEK_API_KEY;
  const base = { id: 'deepseek' as const, name: 'DeepSeek API', billingUrl: 'https://platform.deepseek.com/', docsUrl: 'https://api-docs.deepseek.com/api/get-user-balance/' };
  if (!key) return unavailable(base.id, base.name, 'DeepSeek API key is not configured for provider monitoring.', base.billingUrl, base.docsUrl);
  try {
    const { response, body } = await fetchJson('https://api.deepseek.com/user/balance', { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    if (!response.ok) return errorStatus({ ...base, state: 'live', message: '', checkedAt: new Date().toISOString() }, `DeepSeek returned HTTP ${response.status}. Check the API key scope.`);
    const values = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
    return { ...base, state: 'live', message: body?.is_available === false ? 'DeepSeek responded, but the account balance is not currently sufficient for API calls.' : 'Live DeepSeek account balance retrieved.', checkedAt: new Date().toISOString(), balance: values.map((item: { currency?: unknown; total_balance?: unknown; topped_up_balance?: unknown; granted_balance?: unknown }) => ({ amount: Number(item.total_balance ?? NaN), units: typeof item.currency === 'string' ? item.currency : null, label: `Total balance · topped up ${String(item.topped_up_balance ?? 'n/a')} · granted ${String(item.granted_balance ?? 'n/a')}` })) };
  } catch {
    return errorStatus({ ...base, state: 'live', message: '', checkedAt: new Date().toISOString() }, 'DeepSeek balance request timed out or failed.');
  }
}

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const results = await Promise.all([deepgramStatus(), cartesiaStatus(), livekitStatus(), deepseekStatus()]);
  return results;
}

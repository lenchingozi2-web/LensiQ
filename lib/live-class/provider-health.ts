import { parseRetryAfterMs } from '@/lib/http/retry-after';

const MAX_COOLDOWN_MS = 5 * 60_000;

async function client() {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function providerIsCoolingDown(providerModel: string): Promise<boolean> {
  try {
    const db = await client();
    if (!db) return false;
    const { data, error } = await db.from('live_class_provider_health')
      .select('cooldown_until').eq('provider_model', providerModel).maybeSingle();
    if (error) return false;
    return Boolean(data?.cooldown_until && Date.parse(data.cooldown_until) > Date.now());
  } catch {
    return false;
  }
}

export async function recordProviderResult(providerModel: string, status: number | null, retryAfter?:string|null): Promise<void> {
  try {
    const db = await client();
    if (!db) return;
    const { data } = await db.from('live_class_provider_health')
      .select('failure_count').eq('provider_model', providerModel).maybeSingle();
    const transient = status === 429 || status === 503 || status === null;
    const failures = transient ? Math.min(Number(data?.failure_count || 0) + 1, 8) : 0;
    const backoff = Math.min(15_000 * (2 ** (failures - 1)), MAX_COOLDOWN_MS);
    const requested = parseRetryAfterMs(retryAfter ?? null) ?? 0;
    const cooldown = transient ? Math.max(backoff,requested) : 0;
    await db.from('live_class_provider_health').upsert({
      provider_model: providerModel,
      failure_count: failures,
      last_status: status,
      cooldown_until: cooldown ? new Date(Date.now() + cooldown).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider_model' });
  } catch {
    // Provider health persistence is advisory; a database outage must not stop teaching.
  }
}

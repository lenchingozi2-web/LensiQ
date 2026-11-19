import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

/**
 * Server-only Supabase client for privileged, narrowly scoped administrative operations.
 * Never expose this client or its key to browser code.
 */
export function createAdminClient(signal?:AbortSignal): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) return null;

  if(signal){
    return createSupabaseClient(url,serviceRoleKey,{
      auth:{autoRefreshToken:false,persistSession:false},
      global:{fetch:(input,init)=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([signal,init.signal]):signal})},
    });
  }
  if (!adminClient) {
    adminClient = createSupabaseClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { 'X-Client-Info': 'lensiq-server-admin' } },
    });
  }

  return adminClient;
}

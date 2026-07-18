import { createClient } from '../../lib/supabase/server';
import PricingClient from './PricingClient';

export default async function PricingPage() {
  const supabase = await createClient();
  
  // Read the master switch directly from the database
  const { data: settings } = await supabase
    .from('site_settings')
    .select('is_practical_launched')
    .eq('id', 1)
    .single();

  const isPracticalLaunched = settings?.is_practical_launched ?? false;

  return <PricingClient isPracticalLaunched={isPracticalLaunched} />;
}

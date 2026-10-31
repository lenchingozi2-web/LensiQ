import { redirect } from 'next/navigation';

// Preserve old bookmarked wallet URLs without keeping the obsolete UI.
export default function LegacyWalletPage() { redirect('/subscription'); }

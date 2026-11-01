import { redirect } from 'next/navigation';

// The unrelated video storyboard tool is not part of this medical study hub.
export default function StudioRedirect() {
  redirect('/dashboard');
}

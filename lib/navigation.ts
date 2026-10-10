export type NavigationLink = {
  href: string;
  label: string;
  description: string;
};

export const LOGIN_PATH = '/login';
export const LIVE_CLASS_PATH = '/voice?mode=class';

export const primaryNavigation: NavigationLink[] = [
  { href: '/dashboard', label: 'Dashboard', description: 'Your progress and next steps' },
  { href: '/curriculum', label: 'Study', description: 'Follow your course pathways' },
  { href: '/browse', label: 'Practice', description: 'Work through question banks' },
  { href: '/teach', label: 'Teaching', description: 'Learn with the text tutor' },
  { href: '/voice', label: 'Voice Tutor', description: 'Have a spoken study session' },
  { href: LIVE_CLASS_PATH, label: 'Live Class', description: 'Join a guided live lesson' },
];

export const secondaryNavigation: NavigationLink[] = [
  { href: '/search', label: 'Question search', description: 'Find matching questions' },
  { href: '/exam', label: 'Mock exam', description: 'Test your knowledge' },
  { href: '/library', label: 'Library', description: 'Manage course material' },
];

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  badge?: string;
}

export const navigationItems: NavItem[] = [
  {
    title: 'Command Center',
    href: '/command-center',
    icon: 'terminal',
  },
  {
    title: 'Projects',
    href: '/projects',
    icon: 'folder_code',
  },
  {
    title: 'Test Runs',
    href: '/test-runs',
    icon: 'play_circle',
  },
  {
    title: 'Bug Reports',
    href: '/bug-reports',
    icon: 'bug_report',
    badge: '3 P0',
  },
  {
    title: 'Test Library',
    href: '/test-library',
    icon: 'dataset',
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: 'analytics',
  },
  {
    title: 'Integrations',
    href: '/integrations',
    icon: 'hub',
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: 'settings',
  },
];

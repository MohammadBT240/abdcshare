export interface SettingsSection {
  href: string;
  title: string;
  description: string;
}

/** Default landing tab when visiting /settings */
export const DEFAULT_SETTINGS_HREF = '/settings/account';

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    href: '/settings/account',
    title: 'Account',
    description: 'Profile, photo, and password',
  },
  {
    href: '/settings/notifications',
    title: 'Notifications',
    description: 'In-app and email preferences',
  },
];

export function isSettingsSectionActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getSettingsSection(href: string): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((s) => s.href === href);
}

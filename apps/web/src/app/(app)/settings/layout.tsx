import { SettingsShell } from '@/features/settings/components/settings-shell';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}

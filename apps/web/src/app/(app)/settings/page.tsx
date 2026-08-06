import { redirect } from 'next/navigation';
import { DEFAULT_SETTINGS_HREF } from '@/features/settings/settings-sections';

export default function SettingsIndexPage() {
  redirect(DEFAULT_SETTINGS_HREF);
}

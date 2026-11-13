import {
  IconBook2,
  IconBooks,
  IconBriefcase,
  IconChecklist,
  IconFileText,
  IconHelpCircle,
  IconInfoCircle,
  IconReportAnalytics,
  IconRocket,
  IconSettings,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';

/** `icon:` names allowed in docs/help/<category>/_category.md. */
const ICONS: Record<string, Icon> = {
  rocket: IconRocket,
  briefcase: IconBriefcase,
  checklist: IconChecklist,
  file: IconFileText,
  users: IconUsers,
  report: IconReportAnalytics,
  books: IconBooks,
  settings: IconSettings,
  info: IconInfoCircle,
  book: IconBook2,
};

export function HelpCategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const I = (name && ICONS[name]) || IconHelpCircle;
  return <I className={className} aria-hidden />;
}

import { cn } from '@/lib/cn';

const NAV = ['Dashboard', 'Engagements', 'Requests', 'Documents', 'Admin'];

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 bg-gradient-to-b from-sidebar-from to-sidebar-to p-4 text-white/90 lg:block">
      <div className="mb-6 px-2 text-lg font-bold text-white">abdcshare</div>
      <nav className="space-y-1">
        {NAV.map((item, i) => (
          <a
            key={item}
            href="#"
            className={cn(
              'block rounded-md px-3 py-2 text-sm transition hover:bg-white/10',
              i === 0 ? 'bg-white/10 text-white' : 'text-white/80',
            )}
          >
            {item}
          </a>
        ))}
      </nav>
    </aside>
  );
}

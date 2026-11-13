'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { HelpNav } from '@/features/help/components/help-nav';
import { HelpSearch } from '@/features/help/components/help-search';

/** Docs layout (HC4): topic sidebar on desktop, a "Browse topics" sheet on phones. */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const landing = pathname === '/help';

  return (
    <div className="mx-auto flex w-full max-w-[86rem] gap-8 xl:gap-10">
      {/* The landing page lists every topic itself, so it uses the full width. */}
      {landing ? null : (
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] space-y-5 overflow-y-auto pb-10 pr-1 pt-4">
            <HelpSearch />
            <HelpNav />
          </div>
        </aside>
      )}
      <div className="min-w-0 flex-1 pt-2 lg:pt-4">
        {landing ? null : (
          <div className="mb-4 flex items-center gap-2 lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="shrink-0">
                  <IconLayoutSidebarLeftExpand className="mr-1.5 h-4 w-4" aria-hidden /> Topics
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[19rem] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Help topics</SheetTitle>
                </SheetHeader>
                <div className="mt-2 pb-8">
                  <HelpNav onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1">
              <HelpSearch />
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/data/empty-state';
import { useHelpCategories, useHelpSearch } from '@/features/help/hooks/use-help';

export default function HelpHomePage() {
  const [query, setQuery] = useState('');
  const categories = useHelpCategories();
  const search = useHelpSearch(query);
  const searching = query.trim().length > 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Help Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find out how to complete tasks in the portal.
        </p>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search help articles…"
        aria-label="Search help articles"
      />

      {searching ? (
        <div className="space-y-2">
          {search.isPending ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : search.data && search.data.length > 0 ? (
            search.data.map((article) => (
              <Link
                key={article.id}
                href={`/help/${article.slug}`}
                className="block rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground hover:bg-muted/40"
              >
                {article.title}
              </Link>
            ))
          ) : (
            <EmptyState message="No articles match your search" />
          )}
        </div>
      ) : (
        <Accordion type="multiple" className="w-full">
          {(categories.data ?? []).map((category) => (
            <AccordionItem key={category.id} value={category.id}>
              <AccordionTrigger>{category.name}</AccordionTrigger>
              <AccordionContent>
                {category.articles.length === 0 ? (
                  <EmptyState message="No articles in this category yet" />
                ) : (
                  <div className="space-y-1">
                    {category.articles.map((article) => (
                      <Link
                        key={article.id}
                        href={`/help/${article.slug}`}
                        className="block rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted/40"
                      >
                        {article.title}
                      </Link>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconThumbDown, IconThumbUp } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useHelpFeedback } from '../hooks/use-help';

/** "Was this helpful?" — one answer per person; a "No" invites a short note for the help authors. */
export function ArticleFeedback({ slug, initial }: { slug: string; initial?: boolean | null }) {
  const feedback = useHelpFeedback(slug);
  const [answer, setAnswer] = useState<boolean | null>(initial ?? null);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);

  const vote = (helpful: boolean) => {
    setAnswer(helpful);
    setSent(false);
    feedback.mutate({ helpful }, { onError: () => toast.error('Could not save your answer — please try again') });
  };

  return (
    <section aria-label="Feedback" className="rounded-xl border border-border bg-muted/40 p-4" data-testid="help-feedback">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-foreground">Was this article helpful?</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={answer === true ? 'default' : 'outline'} aria-pressed={answer === true} onClick={() => vote(true)}>
            <IconThumbUp className="mr-1.5 h-4 w-4" aria-hidden /> Yes
          </Button>
          <Button type="button" size="sm" variant={answer === false ? 'default' : 'outline'} aria-pressed={answer === false} onClick={() => vote(false)}>
            <IconThumbDown className="mr-1.5 h-4 w-4" aria-hidden /> No
          </Button>
        </div>
        {answer !== null && !(answer === false && !sent) ? (
          <p className="text-sm text-muted-foreground" role="status">
            Thanks for letting us know.
          </p>
        ) : null}
      </div>
      {answer === false && !sent ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            feedback.mutate(
              { helpful: false, comment },
              { onSuccess: () => setSent(true), onError: () => toast.error('Could not send your note — please try again') },
            );
          }}
        >
          <label htmlFor={`fb-${slug}`} className="text-sm text-muted-foreground">
            What were you looking for, or what was unclear? (optional — read by the people who write these guides)
          </label>
          <Textarea id={`fb-${slug}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} />
          <Button type="submit" size="sm" disabled={!comment.trim() || feedback.isPending}>
            Send
          </Button>
        </form>
      ) : null}
    </section>
  );
}

'use client';

import { IconHistory } from '@tabler/icons-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RequestHistoryList } from '@/features/requests/components/request-history-list';

interface RequestHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  requestReferenceCode?: string;
}

export function RequestHistoryDialog({
  open,
  onOpenChange,
  requestId,
  requestReferenceCode,
}: RequestHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <IconHistory className="mr-2 inline h-5 w-5" />
            Request history {requestReferenceCode ? `• ${requestReferenceCode}` : ''}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <RequestHistoryList requestId={requestId} enabled={open} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

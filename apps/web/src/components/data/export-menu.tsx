'use client';

import { IconDownload } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileTypeIcon } from '@/components/data/file-type-icon';

export interface ExportMenuProps {
  onExportCsv?: () => void;
  onExportExcel?: () => void;
  disabled?: boolean;
  label?: string;
}

/** Stub export menu — wire callbacks when list export endpoints are ready. */
export function ExportMenu({
  onExportCsv,
  onExportExcel,
  disabled = false,
  label = 'Export',
}: ExportMenuProps) {
  const hasActions = Boolean(onExportCsv || onExportExcel);
  if (!hasActions) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <IconDownload className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportCsv ? (
          <DropdownMenuItem onClick={onExportCsv}>
            <FileTypeIcon fileName="export.csv" size={16} className="mr-2" />
            CSV
          </DropdownMenuItem>
        ) : null}
        {onExportExcel ? (
          <DropdownMenuItem onClick={onExportExcel}>
            <FileTypeIcon fileName="export.xlsx" size={16} className="mr-2" />
            Excel
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

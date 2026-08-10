import { type ColumnDef } from '@tanstack/react-table';

/** Build a serial-number column that respects pagination. */
export function snColumn<T>(page: number, pageSize: number): ColumnDef<T, unknown> {
  return {
    id: 'sn',
    header: 'S/N',
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {(page - 1) * pageSize + row.index + 1}
      </span>
    ),
  };
}

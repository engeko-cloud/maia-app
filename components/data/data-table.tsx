import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<Row> {
  /** Stable column key (used for React key). */
  key: string;
  /** Header label. */
  label: string;
  /** Render the cell value for a given row. */
  render: (row: Row) => React.ReactNode;
  /** Render the cell in a monospaced font (good for dates / CPF / IDs). */
  mono?: boolean;
  /** Tailwind width helper, e.g. "w-32". */
  width?: string;
  /** Right-align the cell (good for numeric/timestamp columns). */
  align?: "left" | "right";
}

interface DataTableProps<Row> {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  /** Stable row id for React keys. */
  getRowId: (row: Row) => string;
  /** Wrap each row in a link to this href. Mutually exclusive with onRowClick (link wins). */
  getRowHref?: (row: Row) => string;
  /** Empty-state node when rows.length === 0. */
  empty: React.ReactNode;
}

export function DataTable<Row>({
  rows, columns, getRowId, getRowHref, empty,
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }
  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-[var(--color-bg-subtle)]">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]",
                  c.width,
                  c.align === "right" && "text-right",
                )}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const id = getRowId(row);
            const href = getRowHref?.(row);
            return (
              <TableRow key={id} className="hover:bg-[var(--color-bg-subtle)]">
                {columns.map((c) => {
                  const cell = (
                    <span className={cn(c.mono && "font-mono text-[13px]")}>{c.render(row)}</span>
                  );
                  return (
                    <TableCell
                      key={c.key}
                      className={cn(
                        "text-sm",
                        c.align === "right" && "text-right",
                        href && "p-0",
                      )}
                    >
                      {href ? (
                        <Link href={href} className="block px-3 py-2.5">
                          {cell}
                        </Link>
                      ) : (
                        cell
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

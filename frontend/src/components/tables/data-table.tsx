"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  page: number;
  perPage: number;
  total: number;
  onPageChange?: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  loading?: boolean;
  getRowId?: (item: T) => string;
}

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

export function DataTable<T>({
  columns,
  data,
  sortKey,
  sortOrder,
  onSort,
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  onRowClick,
  emptyMessage = "No data found.",
  emptyAction,
  loading = false,
  getRowId,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / perPage) || 1;
  const start = (page - 1) * perPage;
  const end = Math.min(start + perPage, total);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (!onSort) return null;
    if (sortKey !== colKey)
      return <ChevronsUpDown className="ml-1 h-4 w-4 opacity-50" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4" />
    );
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[14px] border border-border bg-card py-12 text-center">
        <p className="text-[0.85rem] font-medium text-muted-foreground">{emptyMessage}</p>
        {emptyAction && <div className="mt-5">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[14px] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable !== false && onSort ? (
                    <button
                      type="button"
                      className="flex items-center font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => onSort(col.key)}
                    >
                      {col.label}
                      <SortIcon colKey={col.key} />
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow
                key={getRowId ? getRowId(item) : String((item as { id?: string }).id ?? Math.random())}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(onPageChange || onPerPageChange) && total > 0 && (
        <div className="flex flex-wrap items-center justify-between px-[14px] py-[10px] text-[0.72rem] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Showing {start + 1}–{end} of {total}
            </span>
            {onPerPageChange && (
              <select
                className="rounded border border-border bg-accent px-1.5 py-0.5 text-[0.7rem] text-muted-foreground"
                value={perPage}
                onChange={(e) => onPerPageChange(Number(e.target.value))}
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            )}
          </div>
          {onPageChange && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                ← Prev
              </Button>
              <span className="px-2 text-[0.72rem]">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

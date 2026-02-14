import React from 'react';
import { cn } from '../utils';

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  containerClassName?: string;
};

const Table = React.forwardRef<
  HTMLTableElement,
  TableProps
>(({ className, containerClassName, ...props }, ref) => (
  <div
    className={cn(
      'w-full overflow-x-auto rounded-2xl border border-neutral-800 bg-[#0b0b0b]/95 shadow-[0_16px_48px_rgba(0,0,0,0.35)]',
      containerClassName
    )}
  >
    <table
      ref={ref}
      className={cn(
        'w-full border-collapse text-sm text-neutral-100',
        className
      )}
      {...props}
    />
  </div>
));

Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'border-b border-neutral-800 bg-gradient-to-r from-[#171717] via-[#131313] to-[#101010]',
      className
    )}
    {...props}
  />
));

TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));

TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-neutral-800 bg-[#121212] font-medium text-neutral-200',
      className
    )}
    {...props}
  />
));

TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-neutral-900/80 transition-colors hover:bg-white/[0.025]',
      className
    )}
    {...props}
  />
));

TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-11 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300',
      className
    )}
    {...props}
  />
));

TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-4 py-3 align-middle text-neutral-100', className)}
    {...props}
  />
));

TableCell.displayName = 'TableCell';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
};

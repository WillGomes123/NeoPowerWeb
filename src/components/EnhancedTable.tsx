import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from './ui/utils';

interface EnhancedTableProps {
  children: React.ReactNode;
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
}

export const EnhancedTable = ({
  children,
  className,
  striped = false,
  hoverable = true,
}: EnhancedTableProps) => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="overflow-x-auto relative">
        <Table
          className={cn('relative', className)}
          data-striped={striped}
          data-hoverable={hoverable}
        >
          {children}
        </Table>
      </div>
    </div>
  );
};

interface EnhancedTableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const EnhancedTableHeader = ({ children, className }: EnhancedTableHeaderProps) => {
  return (
    <TableHeader
      className={cn(
        'bg-zinc-800/60 border-b border-zinc-700',
        className
      )}
    >
      {children}
    </TableHeader>
  );
};

interface EnhancedTableRowProps {
  children: React.ReactNode;
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
  index?: number;
}

export const EnhancedTableRow = ({
  children,
  className,
  striped = false,
  hoverable = true,
  index = 0,
}: EnhancedTableRowProps) => {
  return (
    <TableRow
      className={cn(
        'border-b border-zinc-800/50 transition-colors duration-200 relative group',
        striped && index % 2 === 1 && 'bg-zinc-800/20',
        hoverable && [
          'hover:bg-zinc-800/50',
          'cursor-pointer',
        ],
        className
      )}
    >
      {children}
    </TableRow>
  );
};

interface EnhancedTableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export const EnhancedTableHead = ({ children, className }: EnhancedTableHeadProps) => {
  return (
    <TableHead
      className={cn(
        'text-zinc-400 font-semibold tracking-wider uppercase text-xs py-4',
        className
      )}
    >
      {children}
    </TableHead>
  );
};

interface EnhancedTableCellProps {
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
  colSpan?: number;
}

export const EnhancedTableCell = ({
  children,
  className,
  highlight = false,
  colSpan,
}: EnhancedTableCellProps) => {
  return (
    <TableCell
      colSpan={colSpan}
      className={cn(
        'text-zinc-300 py-4 transition-colors duration-200',
        'group-hover:text-white',
        highlight && 'text-emerald-400 font-semibold',
        className
      )}
    >
      {children}
    </TableCell>
  );
};

interface EnhancedTableBodyProps {
  children: React.ReactNode;
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
}

export const EnhancedTableBody = ({
  children,
  className,
  striped,
  hoverable,
}: EnhancedTableBodyProps) => {
  return <TableBody className={className}>{children}</TableBody>;
};

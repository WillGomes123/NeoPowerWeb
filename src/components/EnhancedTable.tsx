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
    <div className="relative overflow-hidden rounded-xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-950/60 via-emerald-900/40 to-emerald-950/60 shadow-2xl shadow-emerald-900/50 backdrop-blur-sm">
      {/* Brilho no topo */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

      {/* Efeito de brilho ambiente */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.1),transparent_50%)] pointer-events-none" />

      <div className="overflow-x-auto relative">
        <Table
          className={cn('relative', className)}
          data-striped={striped}
          data-hoverable={hoverable}
        >
          {children}
        </Table>
      </div>

      {/* Brilho inferior */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
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
        'bg-gradient-to-r from-emerald-900/80 via-emerald-800/70 to-emerald-900/80 backdrop-blur-md border-b-2 border-emerald-500/30 relative',
        'before:absolute before:inset-0 before:bg-gradient-to-b before:from-emerald-400/10 before:to-transparent before:pointer-events-none',
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
  // Fixed: Removed div elements that were causing DOM nesting warnings
  return (
    <TableRow
      className={cn(
        'border-b border-emerald-800/30 transition-all duration-300 ease-out relative group',
        striped && index % 2 === 1 && 'bg-emerald-950/30',
        hoverable && [
          'hover:bg-gradient-to-r hover:from-emerald-900/50 hover:via-emerald-800/40 hover:to-emerald-900/50',
          'hover:border-emerald-600/50',
          'hover:shadow-lg hover:shadow-emerald-500/10',
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
        'text-emerald-200 font-bold tracking-wider uppercase text-xs py-4 relative',
        'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-emerald-400/40 after:to-transparent',
        className
      )}
    >
      <span className="relative z-10 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">{children}</span>
    </TableHead>
  );
};

interface EnhancedTableCellProps {
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
}

export const EnhancedTableCell = ({
  children,
  className,
  highlight = false,
}: EnhancedTableCellProps) => {
  return (
    <TableCell
      className={cn(
        'text-emerald-50/90 py-4 transition-colors duration-300',
        'group-hover:text-emerald-50',
        highlight && 'text-emerald-400 font-semibold drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]',
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

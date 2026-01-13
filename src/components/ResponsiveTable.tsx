import React from 'react';
import {
  EnhancedTable,
  EnhancedTableHeader,
  EnhancedTableBody,
  EnhancedTableRow,
  EnhancedTableHead,
  EnhancedTableCell,
} from './EnhancedTable';

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper para tabelas que adiciona scroll horizontal em telas pequenas
 * e mantém o design em telas grandes
 */
export const ResponsiveTableWrapper: React.FC<ResponsiveTableProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <div className="min-w-full inline-block align-middle">
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
};

/**
 * Componente de tabela responsiva com scroll horizontal automático
 */
export const ResponsiveTable = {
  Wrapper: ResponsiveTableWrapper,
  Table: EnhancedTable,
  Header: EnhancedTableHeader,
  Body: EnhancedTableBody,
  Row: EnhancedTableRow,
  Head: EnhancedTableHead,
  Cell: EnhancedTableCell,
};

/**
 * Hook para detectar se a tabela precisa de scroll
 */
export const useTableResponsive = () => {
  const [isScrollable, setIsScrollable] = React.useState(false);
  const tableRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkScroll = () => {
      if (tableRef.current) {
        const hasScroll = tableRef.current.scrollWidth > tableRef.current.clientWidth;
        setIsScrollable(hasScroll);
      }
    };

    checkScroll();
    window.addEventListener('resize', checkScroll);

    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  return { isScrollable, tableRef };
};

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react';
import { exportData, ExportColumn, ExportOptions } from '../lib/export';
import { toast } from 'sonner';

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Componente de botao para exportacao de dados em multiplos formatos
 * Suporta CSV, Excel e PDF
 */
export function ExportButton({
  data,
  columns,
  filename,
  title,
  disabled = false,
  variant = 'outline',
  size = 'default',
}: ExportButtonProps) {
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (!data || data.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    try {
      const options: ExportOptions = {
        filename,
        title: title || filename,
        columns,
        data,
        author: 'NeoPower Dashboard',
      };

      exportData(format, options);

      const formatNames = {
        csv: 'CSV',
        excel: 'Excel',
        pdf: 'PDF',
      };

      toast.success(`Exportado para ${formatNames[format]} com sucesso!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar dados');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          CSV (Excel compativel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xls)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <File className="h-4 w-4 mr-2" />
          PDF (Imprimir)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportButton;

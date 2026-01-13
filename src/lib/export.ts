/**
 * Utility functions for exporting data to PDF and Excel formats
 */

// Types
export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
  format?: 'text' | 'number' | 'currency' | 'date' | 'percent';
}

export interface ExportOptions {
  filename: string;
  title?: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  author?: string;
  dateFormat?: string;
}

/**
 * Format value based on column format type
 */
const formatValue = (value: unknown, format: ExportColumn['format'] = 'text'): string => {
  if (value === null || value === undefined) return '';

  switch (format) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString('pt-BR') : String(value);
    case 'currency':
      return typeof value === 'number'
        ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : String(value);
    case 'date':
      if (value instanceof Date) {
        return value.toLocaleDateString('pt-BR');
      }
      if (typeof value === 'string') {
        return new Date(value).toLocaleDateString('pt-BR');
      }
      return String(value);
    case 'percent':
      return typeof value === 'number' ? `${value.toFixed(2)}%` : String(value);
    default:
      return String(value);
  }
};

/**
 * Export data to CSV format (Excel compatible)
 */
export const exportToCSV = (options: ExportOptions): void => {
  const { filename, columns, data } = options;

  // Create header row
  const headers = columns.map(col => `"${col.header}"`).join(';');

  // Create data rows
  const rows = data.map(row => {
    return columns
      .map(col => {
        const value = row[col.key];
        const formatted = formatValue(value, col.format);
        // Escape double quotes and wrap in quotes
        return `"${formatted.replace(/"/g, '""')}"`;
      })
      .join(';');
  });

  // Combine headers and rows with BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  const csvContent = BOM + [headers, ...rows].join('\r\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data to Excel XLSX format using a simple XML approach
 */
export const exportToExcel = (options: ExportOptions): void => {
  const { filename, title, columns, data, author = 'NeoPower Dashboard' } = options;

  // Create worksheet XML
  const worksheetHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>${author}</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Size="12"/>
      <Interior ss:Color="#4A5568" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:Bold="1" ss:Size="14"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="R$ #,##0.00"/>
    </Style>
    <Style ss:ID="Percent">
      <NumberFormat ss:Format="0.00%"/>
    </Style>
    <Style ss:ID="Date">
      <NumberFormat ss:Format="dd/mm/yyyy"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Dados">
    <Table>`;

  // Create column definitions
  const columnDefs = columns
    .map(col => `<Column ss:Width="${col.width || 100}"/>`)
    .join('\n');

  // Create title row if provided
  const titleRow = title
    ? `<Row>
        <Cell ss:StyleID="Title" ss:MergeAcross="${columns.length - 1}">
          <Data ss:Type="String">${title}</Data>
        </Cell>
      </Row>
      <Row></Row>`
    : '';

  // Create header row
  const headerRow = `<Row>
    ${columns
      .map(
        col => `<Cell ss:StyleID="Header"><Data ss:Type="String">${col.header}</Data></Cell>`
      )
      .join('\n')}
  </Row>`;

  // Create data rows
  const dataRows = data
    .map(row => {
      const cells = columns
        .map(col => {
          const value = row[col.key];
          let dataType = 'String';
          let styleID = '';
          let displayValue = formatValue(value, col.format);

          if (col.format === 'number' || col.format === 'currency' || col.format === 'percent') {
            dataType = 'Number';
            displayValue = typeof value === 'number' ? String(value) : '0';
            if (col.format === 'currency') styleID = ' ss:StyleID="Currency"';
            if (col.format === 'percent') styleID = ' ss:StyleID="Percent"';
          } else if (col.format === 'date') {
            styleID = ' ss:StyleID="Date"';
          }

          return `<Cell${styleID}><Data ss:Type="${dataType}">${displayValue}</Data></Cell>`;
        })
        .join('\n');
      return `<Row>${cells}</Row>`;
    })
    .join('\n');

  const worksheetFooter = `
    </Table>
  </Worksheet>
</Workbook>`;

  const xmlContent =
    worksheetHeader + columnDefs + titleRow + headerRow + dataRows + worksheetFooter;

  // Create blob and download
  const blob = new Blob([xmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data to PDF format using browser print
 * Creates a printable HTML document
 */
export const exportToPDF = (options: ExportOptions): void => {
  const { filename, title, columns, data, author = 'NeoPower Dashboard' } = options;

  // Create printable HTML
  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    @page {
      size: landscape;
      margin: 1cm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 18px;
      margin: 0;
      color: #1a365d;
    }
    .header p {
      font-size: 10px;
      color: #666;
      margin: 5px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background-color: #2d3748;
      color: white;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      font-size: 11px;
      border: 1px solid #1a202c;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      font-size: 10px;
    }
    tr:nth-child(even) {
      background-color: #f7fafc;
    }
    tr:hover {
      background-color: #edf2f7;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 9px;
      color: #666;
    }
    .currency { text-align: right; }
    .number { text-align: right; }
    .percent { text-align: right; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title || filename}</h1>
    <p>Gerado em: ${new Date().toLocaleString('pt-BR')} | Por: ${author}</p>
  </div>
  <table>
    <thead>
      <tr>
        ${columns.map(col => `<th>${col.header}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          row => `
        <tr>
          ${columns
            .map(col => {
              const value = row[col.key];
              const formatted = formatValue(value, col.format);
              const className = col.format === 'currency' || col.format === 'number' || col.format === 'percent' ? col.format : '';
              return `<td class="${className}">${formatted}</td>`;
            })
            .join('')}
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  <div class="footer">
    <p>Total de registros: ${data.length} | NeoPower Dashboard</p>
  </div>
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`;

  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
};

/**
 * Unified export function - exports to both formats
 */
export const exportData = (
  format: 'csv' | 'excel' | 'pdf',
  options: ExportOptions
): void => {
  switch (format) {
    case 'csv':
      exportToCSV(options);
      break;
    case 'excel':
      exportToExcel(options);
      break;
    case 'pdf':
      exportToPDF(options);
      break;
  }
};

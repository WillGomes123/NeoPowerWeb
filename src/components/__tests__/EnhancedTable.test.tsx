import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  EnhancedTable,
  EnhancedTableHeader,
  EnhancedTableBody,
  EnhancedTableRow,
  EnhancedTableHead,
  EnhancedTableCell,
} from '../EnhancedTable';

describe('EnhancedTable', () => {
  describe('Renderizacao de Dados', () => {
    it('deve renderizar tabela com dados basicos', () => {
      render(
        <EnhancedTable>
          <EnhancedTableHeader>
            <EnhancedTableRow>
              <EnhancedTableHead>Nome</EnhancedTableHead>
              <EnhancedTableHead>Email</EnhancedTableHead>
            </EnhancedTableRow>
          </EnhancedTableHeader>
          <EnhancedTableBody>
            <EnhancedTableRow>
              <EnhancedTableCell>John Doe</EnhancedTableCell>
              <EnhancedTableCell>john@test.com</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      expect(screen.getByText('Nome')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });

    it('deve renderizar multiplas linhas de dados', () => {
      const data = [
        { id: 1, name: 'User 1', email: 'user1@test.com' },
        { id: 2, name: 'User 2', email: 'user2@test.com' },
        { id: 3, name: 'User 3', email: 'user3@test.com' },
      ];

      render(
        <EnhancedTable>
          <EnhancedTableHeader>
            <EnhancedTableRow>
              <EnhancedTableHead>Nome</EnhancedTableHead>
              <EnhancedTableHead>Email</EnhancedTableHead>
            </EnhancedTableRow>
          </EnhancedTableHeader>
          <EnhancedTableBody>
            {data.map(item => (
              <EnhancedTableRow key={item.id}>
                <EnhancedTableCell>{item.name}</EnhancedTableCell>
                <EnhancedTableCell>{item.email}</EnhancedTableCell>
              </EnhancedTableRow>
            ))}
          </EnhancedTableBody>
        </EnhancedTable>
      );

      data.forEach(item => {
        expect(screen.getByText(item.name)).toBeInTheDocument();
        expect(screen.getByText(item.email)).toBeInTheDocument();
      });
    });

    it('deve renderizar tabela vazia sem erros', () => {
      render(
        <EnhancedTable>
          <EnhancedTableHeader>
            <EnhancedTableRow>
              <EnhancedTableHead>Nome</EnhancedTableHead>
            </EnhancedTableRow>
          </EnhancedTableHeader>
          <EnhancedTableBody />
        </EnhancedTable>
      );

      expect(screen.getByText('Nome')).toBeInTheDocument();
    });
  });

  describe('Striped Rows', () => {
    it('deve aplicar classe striped quando striped=true', () => {
      const { container } = render(
        <EnhancedTable striped>
          <EnhancedTableBody striped>
            <EnhancedTableRow striped index={0}>
              <EnhancedTableCell>Row 0</EnhancedTableCell>
            </EnhancedTableRow>
            <EnhancedTableRow striped index={1}>
              <EnhancedTableCell>Row 1</EnhancedTableCell>
            </EnhancedTableRow>
            <EnhancedTableRow striped index={2}>
              <EnhancedTableCell>Row 2</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const rows = container.querySelectorAll('tbody tr');
      expect(rows[0]).not.toHaveClass('bg-emerald-950/30'); // Par (0)
      expect(rows[1]).toHaveClass('bg-emerald-950/30'); // Impar (1)
      expect(rows[2]).not.toHaveClass('bg-emerald-950/30'); // Par (2)
    });

    it('nao deve aplicar classe striped quando striped=false', () => {
      const { container } = render(
        <EnhancedTable striped={false}>
          <EnhancedTableBody>
            <EnhancedTableRow striped={false} index={0}>
              <EnhancedTableCell>Row 0</EnhancedTableCell>
            </EnhancedTableRow>
            <EnhancedTableRow striped={false} index={1}>
              <EnhancedTableCell>Row 1</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const rows = container.querySelectorAll('tbody tr');
      expect(rows[0]).not.toHaveClass('bg-emerald-950/30');
      expect(rows[1]).not.toHaveClass('bg-emerald-950/30');
    });
  });

  describe('Hoverable Rows', () => {
    it('deve aplicar classes hover quando hoverable=true (padrao)', () => {
      const { container } = render(
        <EnhancedTable>
          <EnhancedTableBody>
            <EnhancedTableRow>
              <EnhancedTableCell>Hoverable Row</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const row = container.querySelector('tbody tr');
      expect(row).toHaveClass('cursor-pointer');
    });

    it('nao deve aplicar classes hover quando hoverable=false', () => {
      const { container } = render(
        <EnhancedTable hoverable={false}>
          <EnhancedTableBody>
            <EnhancedTableRow hoverable={false}>
              <EnhancedTableCell>Non-hoverable Row</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const row = container.querySelector('tbody tr');
      expect(row).not.toHaveClass('cursor-pointer');
    });
  });

  describe('EnhancedTableHead', () => {
    it('deve renderizar cabecalho com estilo correto', () => {
      render(
        <EnhancedTable>
          <EnhancedTableHeader>
            <EnhancedTableRow>
              <EnhancedTableHead>Cabecalho</EnhancedTableHead>
            </EnhancedTableRow>
          </EnhancedTableHeader>
        </EnhancedTable>
      );

      const header = screen.getByText('Cabecalho');
      expect(header).toBeInTheDocument();
      expect(header.closest('th')).toHaveClass('text-emerald-200');
    });

    it('deve aplicar className customizado', () => {
      render(
        <EnhancedTable>
          <EnhancedTableHeader>
            <EnhancedTableRow>
              <EnhancedTableHead className="custom-class">Custom Header</EnhancedTableHead>
            </EnhancedTableRow>
          </EnhancedTableHeader>
        </EnhancedTable>
      );

      const header = screen.getByText('Custom Header').closest('th');
      expect(header).toHaveClass('custom-class');
    });
  });

  describe('EnhancedTableCell', () => {
    it('deve renderizar celula normal', () => {
      render(
        <EnhancedTable>
          <EnhancedTableBody>
            <EnhancedTableRow>
              <EnhancedTableCell>Normal Cell</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const cell = screen.getByText('Normal Cell');
      expect(cell).toBeInTheDocument();
    });

    it('deve aplicar highlight quando highlight=true', () => {
      render(
        <EnhancedTable>
          <EnhancedTableBody>
            <EnhancedTableRow>
              <EnhancedTableCell highlight>Highlighted Cell</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const cell = screen.getByText('Highlighted Cell').closest('td');
      expect(cell).toHaveClass('text-emerald-400', 'font-semibold');
    });

    it('deve aplicar className customizado', () => {
      render(
        <EnhancedTable>
          <EnhancedTableBody>
            <EnhancedTableRow>
              <EnhancedTableCell className="custom-cell">Custom Cell</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const cell = screen.getByText('Custom Cell').closest('td');
      expect(cell).toHaveClass('custom-cell');
    });
  });

  describe('Estilizacao e Classes', () => {
    it('deve aplicar className customizado na tabela', () => {
      const { container } = render(
        <EnhancedTable className="custom-table-class">
          <EnhancedTableBody>
            <EnhancedTableRow>
              <EnhancedTableCell>Content</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const table = container.querySelector('table');
      expect(table).toHaveClass('custom-table-class');
    });

    it('deve aplicar data attributes corretamente', () => {
      const { container } = render(
        <EnhancedTable striped hoverable>
          <EnhancedTableBody>
            <EnhancedTableRow>
              <EnhancedTableCell>Content</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const table = container.querySelector('table');
      expect(table).toHaveAttribute('data-striped', 'true');
      expect(table).toHaveAttribute('data-hoverable', 'true');
    });

    it('deve ter wrapper com borda e efeitos visuais', () => {
      const { container } = render(
        <EnhancedTable>
          <EnhancedTableBody>
            <EnhancedTableRow>
              <EnhancedTableCell>Content</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const wrapper = container.querySelector('.relative.overflow-hidden');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass('rounded-xl');
    });
  });

  describe('EnhancedTableRow', () => {
    it('deve aplicar classes corretas com todas props', () => {
      const { container } = render(
        <EnhancedTable>
          <EnhancedTableBody>
            <EnhancedTableRow striped hoverable index={1} className="custom-row">
              <EnhancedTableCell>Content</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const row = container.querySelector('tbody tr');
      expect(row).toHaveClass('custom-row');
      expect(row).toHaveClass('bg-emerald-950/30'); // striped + index impar
      expect(row).toHaveClass('cursor-pointer'); // hoverable
    });

    it('deve aplicar index=0 por padrao', () => {
      const { container } = render(
        <EnhancedTable>
          <EnhancedTableBody>
            <EnhancedTableRow striped>
              <EnhancedTableCell>Content</EnhancedTableCell>
            </EnhancedTableRow>
          </EnhancedTableBody>
        </EnhancedTable>
      );

      const row = container.querySelector('tbody tr');
      // index 0 (par) nao deve ter bg-emerald-950/30
      expect(row).not.toHaveClass('bg-emerald-950/30');
    });
  });

  describe('Integracao Completa', () => {
    it('deve renderizar tabela completa com todos os recursos', () => {
      const users = [
        { id: 1, name: 'Alice', email: 'alice@test.com', role: 'Admin' },
        { id: 2, name: 'Bob', email: 'bob@test.com', role: 'User' },
        { id: 3, name: 'Charlie', email: 'charlie@test.com', role: 'User' },
      ];

      render(
        <EnhancedTable striped hoverable>
          <EnhancedTableHeader>
            <EnhancedTableRow>
              <EnhancedTableHead>ID</EnhancedTableHead>
              <EnhancedTableHead>Nome</EnhancedTableHead>
              <EnhancedTableHead>Email</EnhancedTableHead>
              <EnhancedTableHead>Role</EnhancedTableHead>
            </EnhancedTableRow>
          </EnhancedTableHeader>
          <EnhancedTableBody striped hoverable>
            {users.map((user, index) => (
              <EnhancedTableRow key={user.id} striped hoverable index={index}>
                <EnhancedTableCell highlight>{user.id}</EnhancedTableCell>
                <EnhancedTableCell>{user.name}</EnhancedTableCell>
                <EnhancedTableCell>{user.email}</EnhancedTableCell>
                <EnhancedTableCell>{user.role}</EnhancedTableCell>
              </EnhancedTableRow>
            ))}
          </EnhancedTableBody>
        </EnhancedTable>
      );

      // Verificar headers
      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('Nome')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();

      // Verificar dados
      users.forEach(user => {
        expect(screen.getByText(user.name)).toBeInTheDocument();
        expect(screen.getByText(user.email)).toBeInTheDocument();
        expect(screen.getAllByText(user.role).length).toBeGreaterThan(0);
      });
    });
  });
});

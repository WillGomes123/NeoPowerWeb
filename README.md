# NeoRBAC Dashboard

Dashboard administrativo para gerenciamento de estações de recarga de veículos elétricos, com sistema de controle de acesso baseado em roles (RBAC).

## Sobre o Projeto

Interface web moderna para operadores e administradores gerenciarem uma rede de carregadores EV, oferecendo:

- Dashboard com KPIs e métricas em tempo real
- Gerenciamento de estações e locais
- Monitoramento de transações
- Controle de usuários e permissões
- Gestão de tarifas e vouchers
- Relatórios financeiros
- Notificações push
- Mapa interativo com localização dos carregadores

## Tecnologias

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| React | 18.x | Biblioteca UI |
| TypeScript | 5.x | Tipagem estática |
| Vite | 7.x | Build tool |
| Tailwind CSS | 3.x | Estilização |
| Radix UI | - | Componentes acessíveis |
| Recharts | 2.x | Gráficos |
| React Leaflet | 4.x | Mapas interativos |
| Socket.IO Client | 4.x | Tempo real |
| React Hook Form | 7.x | Formulários |
| Zod | 4.x | Validação |

## Estrutura do Projeto

```
src/
├── components/       # Componentes reutilizáveis
│   └── ui/          # Componentes base (shadcn/ui)
├── lib/             # Utilitários e contextos
│   ├── api.ts       # Cliente HTTP
│   ├── auth.tsx     # Contexto de autenticação
│   └── utils.ts     # Funções auxiliares
├── pages/           # Páginas da aplicação
├── styles/          # Estilos globais
├── types/           # Definições de tipos
├── App.tsx          # Componente raiz
└── main.tsx         # Entry point
```

## Páginas

| Rota | Página | Acesso |
|------|--------|--------|
| `/` | Overview | Todos |
| `/estacoes` | Estações | Todos |
| `/locais` | Locais | Todos |
| `/locais/:id` | Detalhes do Local | Todos |
| `/transacoes` | Transações | Todos |
| `/indicadores` | Indicadores | Todos |
| `/operacoes` | Operações | Admin |
| `/relatorio-financeiro` | Relatório Financeiro | Admin |
| `/usuarios` | Usuários | Admin |
| `/vouchers` | Vouchers | Admin |
| `/tarifas` | Tarifas | Admin |
| `/carteiras` | Carteiras | Admin |
| `/notificacoes` | Push Notifications | Admin |

## Instalação

### Pré-requisitos

- Node.js 20+
- npm ou yarn
- Backend OCPP_API rodando

### Setup

1. **Clone o repositório:**
   ```bash
   git clone <url-do-repositorio>
   cd NeoRBAC
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```

   Edite o arquivo `.env`:
   ```env
   VITE_API_URL=http://localhost:3000/api
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

   O dashboard estará disponível em `http://localhost:5173`

## Scripts Disponíveis

```bash
npm run dev        # Servidor de desenvolvimento
npm run build      # Build de produção
npm run preview    # Preview do build
npm run lint       # Verificar código
npm run lint:fix   # Corrigir problemas de lint
npm run format     # Formatar código
npm run test       # Executar testes
npm run test:ui    # Testes com interface
npm run coverage   # Relatório de cobertura
```

## Funcionalidades

### Dashboard (Overview)
- KPIs principais (estações online, usuários, energia, receita)
- Gráfico de consumo semanal
- Status das estações em tempo real

### Estações
- Lista de todos os carregadores
- Status de conexão em tempo real
- Detalhes técnicos (modelo, firmware, potência)

### Locais
- Mapa interativo com localização dos carregadores
- Agrupamento por endereço
- Navegação para detalhes

### Transações
- Histórico completo de recargas
- Filtros por período, estação, usuário
- Exportação de dados

### Operações (Admin)
- Comandos remotos (iniciar/parar recarga)
- Controle de carregadores

### Relatório Financeiro (Admin)
- Receita por período
- Análise por estação
- Taxas e valores líquidos

### Usuários (Admin)
- Gerenciamento de contas
- Atribuição de roles
- Histórico de atividades

### Vouchers (Admin)
- Criar cupons de desconto
- Tipos: percentual ou valor fixo
- Controle de validade e quantidade

### Tarifas (Admin)
- Definir preço por kWh
- Tarifas globais ou por local
- Histórico de alterações

## Autenticação

O sistema utiliza JWT para autenticação. Roles disponíveis:

- **user**: Acesso às páginas básicas
- **admin**: Acesso completo ao sistema

## Integração com Backend

O dashboard se comunica com a API OCPP através de:

- **REST API**: Operações CRUD
- **Socket.IO**: Atualizações em tempo real

Configure a URL da API no arquivo `.env`:
```env
VITE_API_URL=http://localhost:3000/api
```

## Build de Produção

```bash
# Gerar build otimizado
npm run build

# Os arquivos estarão em ./build
```

Para deploy, sirva os arquivos estáticos do diretório `build/` com qualquer servidor web (Nginx, Apache, Vercel, Netlify, etc.).

## Licença

Este projeto é privado e de uso exclusivo.

## Autor

William Gomes - [@WillGomes123](https://github.com/WillGomes123)

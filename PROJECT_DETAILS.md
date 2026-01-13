# Detalhes do Projeto: NeoRBAC (Dashboard)

## Visão Geral
O **NeoRBAC** é o painel administrativo web da plataforma NeoPower. Projetado para operadores de CPO (Charge Point Operators), ele oferece ferramentas completas para monitoramento da rede, gestão financeira e controle de acesso.

## Stack Tecnológico
- **Framework:** React
- **Build Tool:** Vite
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS + Shadcn/UI
- **Mapas:** Leaflet / React-Leaflet
- **Gráficos:** Recharts
- **Gerenciamento de Estado/Form:** React Hook Form + Zod

## Estrutura e Funcionalidades

### Monitoramento e Operações
- **Overview:** Dashboard com KPIs gerais (Carregadores Online, Energia Consumida, Receita).
- **Stations:** Lista detalhada de carregadores com status em tempo real.
- **Locations:** Gestão de locais físicos e visualização em mapa interativo.
- **Operations:** Métricas operacionais detalhadas.

### Gestão Financeira
- **Financial Reports:** Relatórios detalhados de faturamento e transações.
- **Tariffs:** Interface para configuração de preços (Global e por Local).
- **Vouchers:** Criação e gerenciamento de campanhas promocionais.
- **Wallets:** Visualização de saldo e histórico de usuários.

### Sistema e Configuração
- **Users:** Gestão de usuários administrativos e clientes.
- **Push Notifications:** Ferramenta para envio de notificações aos apps móveis.

## Integração
O projeto consome a `OCPP_API`. A URL da API deve ser configurada via variável de ambiente `VITE_API_URL` (ex: no arquivo `.env`).

## Notas de Desenvolvimento
- O projeto segue o design system proposto no Figma "Dashboard Redesign NeoPower".
- Utiliza `socket.io-client` para receber atualizações de status dos carregadores sem necessidade de refresh manual.

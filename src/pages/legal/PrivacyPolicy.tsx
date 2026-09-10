import { LegalLayout, useBrandName, type LegalSection } from './LegalLayout';
import { LEGAL_LAST_UPDATED, PLATFORM_NAME } from './legalConfig';

/**
 * Política de Privacidade pública, por tenant.
 *
 * O texto é o mesmo exibido dentro do app (i18n `legal.privacyContent`),
 * revisado e com a marca parametrizada: a operadora (tenant) é quem oferece o
 * serviço ao usuário; a NeoPower aparece como desenvolvedora/operadora da
 * plataforma tecnológica.
 */
export const PrivacyPolicy = () => {
  const brand = useBrandName();
  const isPlatform = brand === PLATFORM_NAME;

  const sections: LegalSection[] = [
    {
      title: 'Introdução',
      body: [
        isPlatform
          ? `A ${brand} ("nós") valoriza a sua privacidade. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos as suas informações pessoais quando você utiliza o aplicativo ${brand} e os serviços de recarga de veículos elétricos a ele associados.`
          : `A ${brand} ("nós") valoriza a sua privacidade. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos as suas informações pessoais quando você utiliza o aplicativo ${brand} e os serviços de recarga de veículos elétricos a ele associados. O aplicativo é operado pela ${brand} sobre a plataforma tecnológica ${PLATFORM_NAME}, responsável pelo desenvolvimento e pela hospedagem do sistema.`,
        'Ao criar uma conta ou utilizar o aplicativo, você declara ter lido e compreendido esta Política.',
      ],
    },
    {
      title: 'Dados que coletamos',
      body: [
        'Coletamos apenas os dados necessários para prestar o serviço:',
        [
          'Dados de cadastro: nome, e-mail, telefone e senha (armazenada apenas de forma criptografada).',
          'Dados fiscais: CPF/CNPJ e endereço, quando informados, utilizados exclusivamente para a emissão de nota fiscal das recargas.',
          'Dados de veículo: marca, modelo, ano, placa e tipo de conector.',
          'Dados de uso: histórico de recargas, energia consumida, reservas e agendamentos.',
          'Localização: obtida somente enquanto o aplicativo está em uso, para exibir os eletropostos mais próximos, calcular distâncias e traçar rotas. Você pode negar a permissão a qualquer momento nas configurações do aparelho.',
          'Dados de pagamento: movimentações da carteira digital (depósitos, recargas, cashback e cupons). Os dados do cartão são processados diretamente pelo provedor de pagamento e não são armazenados por nós.',
          'Dados do dispositivo: modelo, sistema operacional e token de notificação push.',
          'Login social: nome e e-mail fornecidos pelo Google ou pela Apple, quando você opta por entrar com essas contas.',
        ],
      ],
    },
    {
      title: 'Como usamos os dados',
      body: [
        'Utilizamos os seus dados para:',
        [
          'Criar e manter a sua conta e prestar o serviço de recarga.',
          'Processar pagamentos, depósitos e transações da carteira digital.',
          'Emitir notas fiscais e cumprir obrigações fiscais e legais.',
          'Enviar notificações sobre o andamento das recargas, pagamentos e avisos do serviço.',
          'Localizar estações de recarga próximas e exibir informações de disponibilidade.',
          'Garantir a segurança das contas e prevenir fraudes.',
          'Gerar estatísticas de uso de forma agregada e anonimizada, para melhorar o serviço.',
        ],
      ],
    },
    {
      title: 'Compartilhamento de dados',
      body: [
        'Não vendemos os seus dados pessoais. Compartilhamos dados apenas quando necessário para prestar o serviço, com:',
        [
          'Provedores de pagamento (ex.: Mercado Pago), para processar depósitos e cobranças.',
          'Provedores de infraestrutura em nuvem, para hospedagem e armazenamento seguro das informações.',
          'Sistemas de emissão de nota fiscal eletrônica das prefeituras, quando aplicável.',
          ...(isPlatform ? [] : [`${PLATFORM_NAME}, operadora da plataforma tecnológica que sustenta o aplicativo.`]),
          'Autoridades públicas, quando exigido por lei, regulamento ou ordem judicial.',
        ],
      ],
    },
    {
      title: 'Armazenamento e segurança',
      body: [
        [
          'Os dados trafegam de forma criptografada (HTTPS/TLS) e são armazenados em servidores seguros.',
          'Senhas são armazenadas utilizando hash seguro (bcrypt) e nunca em texto puro.',
          'O acesso à conta utiliza tokens de autenticação com prazo de expiração.',
          'Adotamos medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado, perda ou alteração.',
        ],
      ],
    },
    {
      title: 'Retenção dos dados',
      body: [
        'Mantemos os seus dados enquanto a sua conta estiver ativa. Após a exclusão da conta, os dados pessoais são apagados ou anonimizados, exceto registros financeiros e fiscais que a legislação nos obriga a guardar pelo prazo legal — estes são mantidos de forma restrita e desvinculados de dados identificáveis sempre que possível.',
      ],
    },
    {
      title: 'Seus direitos (LGPD)',
      body: [
        'Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:',
        [
          'Confirmar a existência de tratamento e acessar os seus dados.',
          'Corrigir dados incompletos, inexatos ou desatualizados.',
          'Solicitar a anonimização, o bloqueio ou a eliminação de dados desnecessários ou excessivos.',
          'Solicitar a portabilidade dos seus dados.',
          'Revogar o consentimento e solicitar a exclusão da sua conta.',
          'Obter informação sobre com quem compartilhamos os seus dados.',
        ],
        'As solicitações são atendidas em até 15 (quinze) dias, conforme a legislação.',
      ],
    },
    {
      title: 'Exclusão da conta',
      body: [
        'Você pode excluir a sua conta e os dados associados diretamente no aplicativo, em Perfil → Excluir conta. Também aceitamos solicitações pelos canais de contato indicados abaixo. O passo a passo completo está na página "Excluir conta" deste site.',
      ],
    },
    {
      title: 'Cookies e tecnologias de rastreamento',
      body: [
        'O aplicativo não utiliza cookies de publicidade. Podemos utilizar identificadores técnicos (como o token de notificação e identificadores da sessão) exclusivamente para o funcionamento do serviço e para estatísticas de uso anonimizadas.',
      ],
    },
    {
      title: 'Público',
      body: [
        'O serviço destina-se a pessoas maiores de 18 anos, aptas a conduzir veículos. Não coletamos intencionalmente dados de crianças ou adolescentes.',
      ],
    },
    {
      title: 'Alterações nesta Política',
      body: [
        'Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas pelo aplicativo ou por e-mail, e a data da última atualização é indicada no topo desta página.',
      ],
    },
    {
      title: 'Contato',
      body: [
        `Para dúvidas, solicitações ou exercício dos seus direitos, entre em contato pelo próprio aplicativo (Perfil → Ajuda) ou pelo e-mail de contato informado na página do aplicativo ${brand} na loja (Google Play / App Store).`,
      ],
    },
    {
      title: 'Legislação aplicável',
      body: [
        'Esta Política é regida pelas leis da República Federativa do Brasil, em especial pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e pelo Marco Civil da Internet (Lei nº 12.965/2014).',
      ],
    },
  ];

  return (
    <LegalLayout
      title="Política de Privacidade"
      subtitle={`Como o aplicativo ${brand} trata os seus dados pessoais.`}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={sections}
    />
  );
};

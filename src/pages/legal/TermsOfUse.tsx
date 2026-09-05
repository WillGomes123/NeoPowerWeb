import { LegalLayout, useBrandName, type LegalSection } from './LegalLayout';
import { LEGAL_LAST_UPDATED, PLATFORM_NAME } from './legalConfig';

/**
 * Termos de Uso públicos, por tenant. Mesmo conteúdo do app (i18n
 * `legal.termsContent`), revisado e com a marca parametrizada.
 */
export const TermsOfUse = () => {
  const brand = useBrandName();
  const isPlatform = brand === PLATFORM_NAME;

  const sections: LegalSection[] = [
    {
      title: 'Aceitação dos Termos',
      body: [
        `Ao utilizar o aplicativo ${brand} ("Aplicativo"), você concorda com estes Termos de Uso e com a nossa Política de Privacidade. Se não concordar com algum dos termos, não utilize o Aplicativo.`,
      ],
    },
    {
      title: 'Descrição do serviço',
      body: [
        isPlatform
          ? `O ${brand} é uma plataforma de recarga de veículos elétricos que permite localizar estações de recarga, iniciar e monitorar sessões de carregamento, fazer reservas e gerenciar pagamentos por meio de uma carteira digital.`
          : `O Aplicativo ${brand} permite localizar as estações de recarga da rede ${brand}, iniciar e monitorar sessões de carregamento, fazer reservas e gerenciar pagamentos por meio de uma carteira digital. O Aplicativo é operado pela ${brand} sobre a plataforma tecnológica ${PLATFORM_NAME}.`,
      ],
    },
    {
      title: 'Cadastro e conta',
      body: [
        [
          'Para utilizar os serviços é necessário criar uma conta fornecendo informações verdadeiras, completas e atualizadas.',
          'Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas na sua conta.',
          'Notifique-nos imediatamente em caso de uso não autorizado da sua conta.',
          'O serviço destina-se a maiores de 18 anos.',
        ],
      ],
    },
    {
      title: 'Uso do serviço',
      body: [
        [
          'Você se compromete a utilizar o Aplicativo de forma legal e ética, respeitando as instruções de uso de cada estação de recarga.',
          'É proibido utilizar o serviço para fins ilegais, fraudulentos ou não autorizados, bem como tentar burlar cobranças ou acessar contas de terceiros.',
          'O uso indevido pode resultar na suspensão ou no cancelamento da sua conta.',
        ],
      ],
    },
    {
      title: 'Pagamentos e tarifas',
      body: [
        [
          'As tarifas de recarga são exibidas no Aplicativo antes do início de cada sessão e podem variar por estação, horário e potência.',
          'Os pagamentos são processados por meio da carteira digital do Aplicativo, abastecida via Pix ou cartão através de provedor de pagamento parceiro.',
          'Depósitos realizados na carteira não são reembolsáveis, exceto nos casos previstos em lei.',
          'Cupons, cashback e promoções estão sujeitos às regras vigentes no momento da utilização e podem ser alterados ou encerrados a qualquer tempo.',
          'Quando exigido pela legislação, será emitida nota fiscal referente aos serviços de recarga, com base nos dados fiscais informados por você.',
        ],
      ],
    },
    {
      title: 'Reservas e agendamentos',
      body: [
        'Quando disponíveis, reservas e agendamentos de recarga ficam sujeitos às regras e prazos exibidos no Aplicativo. O não comparecimento no período reservado pode resultar na liberação automática do carregador.',
      ],
    },
    {
      title: 'Responsabilidades',
      body: [
        [
          `A ${brand} não se responsabiliza por danos causados ao veículo durante o carregamento decorrentes de uso inadequado, incompatibilidade ou defeitos do próprio veículo.`,
          'O usuário é responsável por verificar a compatibilidade do conector e da potência com o seu veículo antes de iniciar a recarga.',
          `A ${brand} não garante a disponibilidade ininterrupta do serviço, que pode ser afetada por manutenção, falhas de energia, de conectividade ou de terceiros.`,
        ],
      ],
    },
    {
      title: 'Propriedade intelectual',
      body: [
        isPlatform
          ? `Todo o conteúdo do Aplicativo — incluindo logotipos, textos, gráficos e software — é de propriedade da ${brand} e está protegido pelas leis de propriedade intelectual.`
          : `A marca, os logotipos e os conteúdos da ${brand} são de sua propriedade. O software e a plataforma tecnológica são de propriedade da ${PLATFORM_NAME}. Todo o conteúdo está protegido pelas leis de propriedade intelectual e não pode ser copiado ou reproduzido sem autorização.`,
      ],
    },
    {
      title: 'Exclusão da conta',
      body: [
        'Você pode encerrar a sua conta a qualquer momento pelo Aplicativo, em Perfil → Excluir conta, ou pelos canais de contato. Consulte a página "Excluir conta" deste site para o passo a passo e para saber quais dados são apagados ou mantidos por obrigação legal.',
      ],
    },
    {
      title: 'Modificações',
      body: [
        `A ${brand} reserva-se o direito de modificar estes Termos a qualquer momento. Alterações significativas serão notificadas aos usuários pelo Aplicativo, e a data da última atualização é indicada no topo desta página.`,
      ],
    },
    {
      title: 'Legislação aplicável',
      body: [
        'Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do domicílio do consumidor para dirimir eventuais controvérsias.',
      ],
    },
    {
      title: 'Contato',
      body: [
        `Para dúvidas sobre estes Termos, entre em contato pelo próprio Aplicativo (Perfil → Ajuda) ou pelo e-mail de contato informado na página do aplicativo ${brand} na loja (Google Play / App Store).`,
      ],
    },
  ];

  return (
    <LegalLayout
      title="Termos de Uso"
      subtitle={`Condições para utilização do aplicativo ${brand}.`}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={sections}
    />
  );
};

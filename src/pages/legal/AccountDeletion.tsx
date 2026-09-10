import { LegalLayout, useBrandName, type LegalSection } from './LegalLayout';
import { LEGAL_LAST_UPDATED } from './legalConfig';

/**
 * Página pública de exclusão de conta — exigida pela Google Play (política de
 * "Exclusão de dados") e pela App Store para apps com criação de conta.
 *
 * Reflete o comportamento real do backend (DELETE /api/profile): tenta a
 * exclusão física e, quando há registros que precisam ser mantidos por
 * obrigação legal, anonimiza a conta e a bloqueia.
 */

const STEPS = [
  { icon: 'login', text: 'Abra o aplicativo e entre com a sua conta.' },
  { icon: 'person', text: 'Toque na aba "Perfil", na barra inferior.' },
  { icon: 'delete_forever', text: 'Role até o final da tela e toque em "Excluir conta".' },
  { icon: 'check_circle', text: 'Confirme a exclusão. A conta é encerrada imediatamente e você é desconectado.' },
];

export const AccountDeletion = () => {
  const brand = useBrandName();

  const intro = (
    <div
      className="rounded-xl p-6 border"
      style={{
        borderColor: 'color-mix(in srgb, var(--primary) 25%, transparent)',
        backgroundColor: 'color-mix(in srgb, var(--primary) 6%, transparent)',
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">Passo a passo no aplicativo</p>
      <ol className="space-y-3">
        {STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary text-xl leading-none mt-0.5">{step.icon}</span>
            <span className="text-[15px] leading-relaxed">
              <strong className="font-semibold mr-1">{i + 1}.</strong>
              {step.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );

  const sections: LegalSection[] = [
    {
      title: 'Antes de excluir',
      body: [
        [
          'Utilize o saldo restante da sua carteira digital: após a exclusão, a conta não pode ser restaurada e o acesso ao saldo é perdido.',
          'Encerre qualquer recarga em andamento e cancele reservas ativas.',
          'Se precisar de comprovantes ou notas fiscais, salve-os antes — eles ficam disponíveis no histórico do aplicativo.',
        ],
      ],
    },
    {
      title: 'Solicitar a exclusão sem acesso ao aplicativo',
      body: [
        `Se você não tem mais o aplicativo instalado ou não consegue entrar na conta, envie uma solicitação a partir do e-mail cadastrado para o e-mail de contato informado na página do aplicativo ${brand} na loja (Google Play / App Store), com o assunto "Exclusão de conta". Poderemos pedir uma confirmação de identidade antes de concluir.`,
        'As solicitações são atendidas em até 15 (quinze) dias, conforme a Lei Geral de Proteção de Dados.',
      ],
    },
    {
      title: 'Dados que são excluídos',
      body: [
        'Ao excluir a conta, apagamos definitivamente:',
        [
          'Dados de cadastro: nome, e-mail, telefone, CPF/CNPJ, endereço e credenciais de acesso.',
          'Veículos cadastrados e estações favoritas.',
          'Tokens de notificação e dados do dispositivo.',
          'Reservas, agendamentos e preferências do aplicativo.',
        ],
      ],
    },
    {
      title: 'Dados mantidos por obrigação legal',
      body: [
        'Registros de transações financeiras e notas fiscais já emitidas precisam ser guardados pelo prazo exigido pela legislação fiscal e pelo Código de Defesa do Consumidor. Nesses casos, a conta é anonimizada: os dados pessoais são removidos ou substituídos e o registro deixa de ser vinculado a você. O acesso à conta é bloqueado permanentemente.',
      ],
    },
    {
      title: 'Dúvidas',
      body: [
        `Para dúvidas sobre este processo ou sobre os seus dados, consulte a nossa Política de Privacidade ou entre em contato pelos canais indicados na página do aplicativo ${brand} na loja.`,
      ],
    },
  ];

  return (
    <LegalLayout
      title="Excluir conta e dados"
      subtitle={`Como encerrar a sua conta no aplicativo ${brand} e o que acontece com os seus dados.`}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={sections}
      intro={intro}
    />
  );
};

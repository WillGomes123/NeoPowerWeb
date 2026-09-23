import { useTenant } from '../../contexts/TenantContext';
import { LegalLayout, useBrandName, type LegalSection } from './LegalLayout';
import { CONTATO_SUPORTE, LEGAL_LAST_UPDATED } from './legalConfig';

/**
 * Página pública de suporte — é a "URL de suporte" exigida pela App Store
 * (`/<tenant>/suporte`). A Apple pede que ela traga um meio de contato, então o
 * card do topo usa o contato configurado para a marca em CONTATO_SUPORTE.
 */

const PASSOS_RECARGA = [
  { icon: 'login', text: 'Abra o aplicativo e entre com a sua conta.' },
  { icon: 'map', text: 'Encontre a estação no mapa ou vá até o carregador.' },
  { icon: 'ev_station', text: 'Conecte o cabo do carregador ao veículo.' },
  { icon: 'qr_code_scanner', text: 'Toque em "Recarga" e aponte a câmera para o QR Code do carregador, ou toque em "Inserir código da estação" e digite o código.' },
  { icon: 'bolt', text: 'Confira o conector e inicie a recarga. Você acompanha a energia entregue e o valor pelo aplicativo.' },
  { icon: 'stop_circle', text: 'Finalize a recarga quando quiser. O resumo fica salvo no Histórico.' },
];

export const Support = () => {
  const brand = useBrandName();
  const { tenantSlug, tenantBranding } = useTenant();
  const chave = String(tenantBranding?.clientId || tenantSlug || '').toLowerCase();
  const contato = CONTATO_SUPORTE[chave];

  const whatsappLink = contato?.whatsapp
    ? `https://wa.me/${contato.whatsapp.replace(/\D/g, '')}`
    : null;

  const intro = (
    <div
      className="rounded-xl p-6 border"
      style={{
        borderColor: 'color-mix(in srgb, var(--primary) 25%, transparent)',
        backgroundColor: 'color-mix(in srgb, var(--primary) 6%, transparent)',
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mb-3">Fale com o atendimento</p>
      {contato ? (
        <>
          <p className="text-[15px] leading-relaxed mb-4">
            Dúvidas, problemas com uma recarga ou com a sua conta? Escreva para a equipe {brand} e informe, se
            possível, o nome da estação, a data e o horário.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`mailto:${contato.email}?subject=${encodeURIComponent(`Suporte ${brand}`)}`}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-sm bg-primary text-on-primary"
            >
              <span className="material-symbols-outlined text-lg leading-none">mail</span>
              {contato.email}
            </a>
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-sm border border-primary text-primary"
              >
                <span className="material-symbols-outlined text-lg leading-none">chat</span>
                WhatsApp
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="text-[15px] leading-relaxed">
          Entre em contato pelos canais indicados na página do aplicativo {brand} na loja (Google Play / App Store).
        </p>
      )}
    </div>
  );

  const sections: LegalSection[] = [
    {
      title: 'Como iniciar uma recarga',
      body: [PASSOS_RECARGA.map((passo, i) => `${i + 1}. ${passo.text}`)],
    },
    {
      title: 'Carteira e pagamentos',
      body: [
        [
          'Adicione créditos pela opção "Adicionar créditos", na tela inicial do aplicativo.',
          'O valor da recarga é calculado pelo preço por kWh exibido na estação e descontado do seu saldo.',
          'Saldo e movimentações ficam disponíveis a qualquer momento no aplicativo.',
        ],
      ],
    },
    {
      title: 'Problemas comuns',
      body: [
        [
          'A recarga não iniciou: confira se o cabo está bem conectado ao veículo e se a estação aparece como disponível no aplicativo, e tente de novo. Se continuar, fale com o atendimento informando a estação e o horário.',
          'O QR Code não é lido: toque em "Inserir código da estação" e digite o código que aparece no carregador.',
          'Não reconheço uma cobrança: confira os detalhes no Histórico e fale com o atendimento informando a data da recarga.',
          'Esqueci a senha: na tela de login, toque em "Esqueci minha senha" e siga as instruções enviadas por e-mail.',
        ],
      ],
    },
    {
      title: 'Conta e privacidade',
      body: [
        'Para saber como tratamos os seus dados, consulte a Política de Privacidade. Para encerrar a sua conta, veja a página Excluir conta. Os links estão no rodapé desta página.',
      ],
    },
  ];

  return (
    <LegalLayout
      title="Suporte"
      subtitle={`Ajuda para usar o aplicativo ${brand} e contato com o atendimento.`}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={sections}
      intro={intro}
      etiqueta="Central de ajuda"
    />
  );
};

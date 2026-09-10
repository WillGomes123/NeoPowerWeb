import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import NeoPowerLogo from '../../assets/NeoPower.png';

/**
 * Layout das páginas legais públicas (Privacidade, Termos, Exclusão de conta).
 *
 * São páginas SEM login, acessíveis em `/<tenant>/privacidade` etc. — o
 * `basename` do Router já é o slug do tenant, então os links internos ficam
 * relativos. O nome/logo da marca vêm do branding resolvido pelo TenantContext,
 * assim o mesmo código serve NeoPower e cada white label (ex.: Vip Energy), e
 * o texto sempre cita a marca certa.
 *
 * Uso típico: URL de Política de Privacidade exigida pela Google Play / App
 * Store para cada app white label.
 */

export interface LegalSection {
  title: string;
  /** Parágrafos e/ou listas. Strings viram <p>; arrays viram <ul>. */
  body: Array<string | string[]>;
}

interface LegalLayoutProps {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  sections: LegalSection[];
  /** Conteúdo extra renderizado antes das seções (ex.: passo a passo). */
  intro?: React.ReactNode;
}

const LEGAL_LINKS = [
  { to: '/privacidade', label: 'Política de Privacidade' },
  { to: '/termos', label: 'Termos de Uso' },
  { to: '/excluir-conta', label: 'Excluir conta' },
];

/** Nome da marca do tenant atual (com fallback para a plataforma). */
export function useBrandName(): string {
  const { tenantBranding } = useTenant();
  return tenantBranding?.companyName?.trim() || 'NeoPower';
}

export const LegalLayout = ({ title, subtitle, lastUpdated, sections, intro }: LegalLayoutProps) => {
  const { tenantBranding, isDark } = useTenant();
  const brand = useBrandName();

  const logoSrc = isDark
    ? tenantBranding?.logoUriDark || tenantBranding?.logoUri || NeoPowerLogo
    : tenantBranding?.logoUriLight || tenantBranding?.logoUri || NeoPowerLogo;

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${brand}`;
    return () => {
      document.title = previous;
    };
  }, [title, brand]);

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ color: 'var(--foreground)' }}>
      {/* Cabeçalho com a marca do tenant */}
      <header className="w-full px-6 py-5 border-b border-border/10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/95 rounded-lg p-2 shadow-lg shadow-white/5">
              <img src={logoSrc} alt={brand} className="h-8 w-auto object-contain" />
            </div>
            <span className="font-headline font-bold text-lg tracking-tight">{brand}</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold hidden sm:inline">
            Documento legal
          </span>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-10">
        <article className="max-w-3xl mx-auto">
          <h1 className="font-headline text-3xl sm:text-4xl font-black tracking-tight mb-2">{title}</h1>
          {subtitle && <p className="text-on-surface-variant text-base mb-2">{subtitle}</p>}
          <p className="text-on-surface-variant text-sm mb-8">Última atualização: {lastUpdated}</p>

          {intro && <div className="mb-8">{intro}</div>}

          <div className="space-y-8">
            {sections.map((section, i) => (
              <section key={section.title}>
                <h2 className="font-headline text-xl font-bold mb-3">
                  <span className="text-primary mr-2">{String(i + 1).padStart(2, '0')}.</span>
                  {section.title}
                </h2>
                <div className="space-y-3 text-[15px] leading-relaxed" style={{ color: 'var(--foreground)' }}>
                  {section.body.map((item, j) =>
                    Array.isArray(item) ? (
                      <ul key={j} className="list-disc pl-6 space-y-1.5">
                        {item.map((li, k) => (
                          <li key={k}>{li}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={j}>{item}</p>
                    )
                  )}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>

      <footer className="w-full py-8 border-t border-border/10 mt-auto">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm tracking-wide text-on-surface-variant">
            © {new Date().getFullYear()} {brand}. Todos os direitos reservados.
          </div>
          <nav className="flex flex-wrap justify-center gap-6">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm tracking-wide text-on-surface-variant hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
};

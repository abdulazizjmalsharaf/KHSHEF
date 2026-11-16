import { ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { ThemeToggle } from '@/components/theme-toggle';
import type { Theme } from '@/hooks/use-theme';

const LINKS = [
  { href: '#top', label: 'الرئيسية', id: 'home' },
  { href: '#features', label: 'المميزات', id: 'features' },
  { href: '#plans', label: 'الباقات', id: 'plans' },
  { href: '/invoices/new', label: 'فاتورة جديدة', id: 'invoice-new' },
];

type Props = { theme: Theme; onToggleTheme: () => void; cartCount: number; onOpenCart: () => void; cta: ReactNode };

export function SiteHeader({ theme, onToggleTheme, cartCount, onOpenCart, cta }: Props) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
        <a href="#top" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-logo">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-display text-xl text-accent">ك</span>
          <span className="font-display text-2xl text-primary">كاشف</span>
        </a>
        <nav aria-label="التنقل الرئيسي" className="hidden md:block">
          <NavLinks />
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`فتح السلة التجريبية، ${cartCount} من العناصر`}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-input bg-card text-primary transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            data-testid="button-open-cart"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {cartCount > 0 && (
              <span key={cartCount} className="pop absolute -left-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold tabular-nums text-accent-foreground" data-testid="text-cart-count">
                {cartCount}
              </span>
            )}
          </button>
          <div className="hidden sm:block">{cta}</div>
        </div>
      </div>
      <nav aria-label="التنقل الرئيسي للجوال" className="border-t border-border/60 md:hidden">
        <NavLinks mobile />
      </nav>
    </header>
  );
}

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <ul className={mobile ? 'mx-auto flex max-w-6xl justify-around px-3' : 'flex items-center gap-1'}>
      {LINKS.map((l) => (
        <li key={l.id}>
          {l.href.startsWith('/') ? (
            <Link
              href={l.href}
              className={`nav-link relative inline-flex items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mobile ? 'h-10 px-4' : 'h-9 px-3'}`}
              data-testid={`link-nav-${l.id}${mobile ? '-mobile' : ''}`}
            >
              {l.label}
            </Link>
          ) : (
            <a
              href={l.href}
              className={`nav-link relative inline-flex items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mobile ? 'h-10 px-4' : 'h-9 px-3'}`}
              data-testid={`link-nav-${l.id}${mobile ? '-mobile' : ''}`}
            >
              {l.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

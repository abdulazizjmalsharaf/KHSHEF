import { useState } from 'react';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import type { Theme } from '@/hooks/use-theme';

const LINKS = [
  { href: '#how', label: 'كيف يعمل', id: 'how' },
  { href: '#features', label: 'المميزات', id: 'features' },
  { href: '#plans', label: 'الباقات', id: 'plans' },
  { href: '#faq', label: 'الأسئلة', id: 'faq' },
];

type Props = { theme: Theme; onToggleTheme: () => void; cartCount: number; onOpenCart: () => void };

export function SiteHeader({ theme, onToggleTheme, cartCount, onOpenCart }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <a href="#top" onClick={closeMenu} className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-logo">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-display text-xl text-accent">ك</span>
          <span className="font-display text-2xl text-primary">كاشف</span>
        </a>
        <nav aria-label="التنقل الرئيسي" className="hidden md:block"><NavLinks /></nav>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button type="button" onClick={onOpenCart} aria-label={`فتح السلة، ${cartCount} من الباقات`} className="relative grid h-11 w-11 place-items-center rounded-xl border border-input bg-card text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-open-cart">
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {cartCount > 0 && <span className="absolute -left-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">{cartCount}</span>}
          </button>
        <a href="/login" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-primary hover:bg-secondary sm:inline-flex" data-testid="link-login">تسجيل الدخول</a>
          <a href="/login" className="hidden h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:-translate-y-0.5 sm:inline-flex" data-testid="button-header-start">ابدأ مجاناً</a>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'} className="grid h-11 w-11 place-items-center rounded-xl border border-input text-primary md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-mobile-menu">
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>
      {menuOpen && <nav id="mobile-navigation" aria-label="التنقل الرئيسي للجوال" className="border-t border-border bg-background px-4 py-3 md:hidden">
        <NavLinks mobile onNavigate={closeMenu} />
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
          <a href="/login" onClick={closeMenu} className="inline-flex h-11 items-center justify-center rounded-xl border border-input font-semibold text-primary" data-testid="link-login-mobile">تسجيل الدخول</a>
          <a href="/login" onClick={closeMenu} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground" data-testid="button-header-start-mobile">ابدأ مجاناً</a>
        </div>
      </nav>}
    </header>
  );
}

function NavLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  return <ul className={mobile ? 'grid grid-cols-2 gap-1' : 'flex items-center gap-1'}>
    {LINKS.map((l) => <li key={l.id}>
      <a href={l.href} onClick={onNavigate} className={`nav-link relative inline-flex items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mobile ? 'h-11 w-full px-3' : 'h-10 px-3'}`} data-testid={`link-nav-${l.id}${mobile ? '-mobile' : ''}`}>{l.label}</a>
    </li>)}
  </ul>;
}

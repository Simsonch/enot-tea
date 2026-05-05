'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ShoppingCart } from 'lucide-react';
import { getCartTotalQuantity, useCartStore } from '@/src/entities/cart';
import { Badge, Card, CardHeader, CardTitle, buttonVariants } from '@/src/shared/ui';
import { cn } from '@/src/shared/lib/utils';
import { useIsScrolled } from '@/src/shared/lib/use-is-scrolled';

const headerNavButtonClass =
  'storefront-glass-nav-btn focus-visible:ring-0 focus-visible:ring-offset-0';

export function HeaderNav() {
  const itemCount = useCartStore((state) => getCartTotalQuantity(state.items));
  const isScrolled = useIsScrolled();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function updateHeaderBottom() {
      const current = headerRef.current;
      if (!current) return;
      const computedTop = parseFloat(getComputedStyle(current).top) || 0;
      document.documentElement.style.setProperty(
        '--header-bottom',
        `${current.offsetHeight + computedTop}px`,
      );
    }

    updateHeaderBottom();
    const observer = new ResizeObserver(updateHeaderBottom);
    const initial = headerRef.current;
    if (initial) observer.observe(initial);
    window.addEventListener('resize', updateHeaderBottom);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeaderBottom);
      document.documentElement.style.removeProperty('--header-bottom');
    };
  }, []);

  return (
    <header ref={headerRef} className="sticky top-3 z-30">
      <Card
        className={cn(
          'border text-white shadow-sm transition-colors',
          isScrolled ? 'border-[color:var(--brand-glass-border)] bg-[#0b120d]' : 'storefront-glass-panel',
        )}
      >
        <CardHeader className="gap-4 space-y-0 p-5 pb-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Link
                href="/"
                className="group flex min-w-0 items-center gap-3 rounded-lg outline-none ring-offset-2 ring-offset-transparent transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                <Image
                  alt="ЧаЕнот"
                  className="h-11 w-auto shrink-0 object-contain sm:h-12"
                  height={584}
                  src="/logo.svg"
                  width={426}
                />
                <CardTitle className="text-2xl leading-none text-brand-heading sm:text-xl">
                  ЧаЕнот
                </CardTitle>
              </Link>
              <Badge
                variant="secondary"
                className="w-fit border-white/15 bg-white/10 text-brand-muted"
              >
                Магазин премиумного китайского чая
              </Badge>
            </div>
            <nav
              className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end"
              aria-label="Основная навигация"
            >
              <Link
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className: cn(headerNavButtonClass, 'w-full justify-center sm:w-auto'),
                })}
                href="/"
              >
                Каталог
              </Link>
              <Link
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className: cn(headerNavButtonClass, 'w-full justify-center sm:w-auto'),
                })}
                href="/checkout"
              >
                Оформление заказа
              </Link>
              <Link
                href="/cart"
                aria-label={itemCount > 0 ? `Корзина, ${itemCount} шт.` : 'Корзина'}
                title="Корзина"
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className: cn(
                    headerNavButtonClass,
                    'relative inline-flex w-full min-h-9 items-center justify-center sm:w-10 sm:min-w-10 sm:px-0',
                  ),
                })}
              >
                <ShoppingCart className="size-5 shrink-0" aria-hidden />
                {itemCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-brand-accent px-1 text-[0.625rem] font-semibold leading-none text-brand-accent-foreground shadow-sm tabular-nums ring-2 ring-white/35">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                ) : null}
              </Link>
            </nav>
          </div>
        </CardHeader>
      </Card>
    </header>
  );
}

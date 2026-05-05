'use client';

import Link from 'next/link';
import { CartItemRow, getCartTotalMinor, useCartStore } from '@/src/entities/cart';
import { CartItemActions } from '@/src/features/update-cart-item';
import { formatPrice } from '@/src/shared/lib/format';
import { Card, CardContent, CardHeader, CardTitle, buttonVariants } from '@/src/shared/ui';
import { cn } from '@/src/shared/lib/utils';

export function CartWidget() {
  const items = useCartStore((state) => state.items);

  if (items.length === 0) {
    return (
      <Card className="storefront-glass-panel border text-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-brand-heading">Корзина пуста</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            className={buttonVariants({
              variant: 'outline',
              className: cn(
                'border-brand-accent text-brand-accent-foreground hover:bg-brand-accent/20 hover:text-brand-accent-foreground',
              ),
            })}
            href="/"
          >
            Перейти в каталог
          </Link>
        </CardContent>
      </Card>
    );
  }

  const totalMinor = getCartTotalMinor(items);

  return (
    <section className="space-y-4">
      <Card className="storefront-glass-panel border text-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-brand-heading">Корзина</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <CartItemRow
              key={item.product.id}
              item={item}
              actions={<CartItemActions productId={item.product.id} quantity={item.quantity} />}
            />
          ))}
        </CardContent>
      </Card>
      <Card className="storefront-glass-panel border text-white shadow-sm">
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base font-semibold text-brand-heading">Общая стоимость: {formatPrice(totalMinor)}</p>
          <Link
            className={buttonVariants({
              variant: 'default',
              className: 'bg-brand-primary text-brand-primary-foreground hover:bg-brand-primary/90',
            })}
            href="/checkout"
          >
            Перейти к оформлению заказа
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}

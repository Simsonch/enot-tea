'use client';

import Link from 'next/link';
import { CartItemRow, getCartTotalMinor, useCartStore } from '@/src/entities/cart';
import { CartItemActions } from '@/src/features/update-cart-item';
import { formatPrice } from '@/src/shared/lib/format';

export function CartWidget() {
  const items = useCartStore((state) => state.items);

  if (items.length === 0) {
    return (
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Cart is empty</h2>
        <Link href="/">Back to catalog</Link>
      </section>
    );
  }

  const totalMinor = getCartTotalMinor(items);

  return (
    <section className="card stack">
      <h2 style={{ margin: 0 }}>Cart</h2>
      {items.map((item) => (
        <CartItemRow
          key={item.product.id}
          item={item}
          actions={<CartItemActions productId={item.product.id} quantity={item.quantity} />}
        />
      ))}
      <p style={{ margin: 0, fontWeight: 700 }}>Total: {formatPrice(totalMinor)}</p>
      <Link href="/checkout">Proceed to checkout</Link>
    </section>
  );
}

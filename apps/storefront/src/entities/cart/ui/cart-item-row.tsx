import { ReactNode } from 'react';
import { formatPrice } from '@/src/shared/lib/format';
import { CartItem } from '../model/cart-store';

export function CartItemRow({ item, actions }: { item: CartItem; actions?: ReactNode }) {
  return (
    <article style={{ borderTop: '1px solid #ddd', paddingTop: 12 }}>
      <h3 style={{ margin: '0 0 8px' }}>{item.product.name}</h3>
      <p style={{ margin: '0 0 8px' }}>{formatPrice(item.product.priceMinor)}</p>
      {actions}
    </article>
  );
}

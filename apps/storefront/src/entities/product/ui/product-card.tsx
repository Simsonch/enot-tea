import { ReactNode } from 'react';
import { formatPrice } from '@/src/shared/lib/format';
import { Product } from '../model/types';

export function ProductCard({ product, actions }: { product: Product; actions?: ReactNode }) {
  return (
    <article className="card">
      <h3 style={{ marginTop: 0 }}>{product.name}</h3>
      <p style={{ margin: '8px 0' }}>{product.description ?? 'No description'}</p>
      <p style={{ margin: '8px 0', fontWeight: 600 }}>{formatPrice(product.priceMinor)}</p>
      {actions}
    </article>
  );
}

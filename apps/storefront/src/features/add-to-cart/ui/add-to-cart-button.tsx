'use client';

import { Product } from '@/src/entities/product';
import { useCartStore } from '@/src/entities/cart';

export function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);

  return (
    <button onClick={() => addItem(product)} type="button">
      Add to cart
    </button>
  );
}

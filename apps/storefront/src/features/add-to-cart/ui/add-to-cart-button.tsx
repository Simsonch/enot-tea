'use client';

import { Product } from '@/src/entities/product';
import { useCartStore } from '@/src/entities/cart';
import { Button } from '@/src/shared/ui';

export function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);

  return (
    <Button
      onClick={() => addItem(product)}
      size="sm"
      type="button"
      variant="brand"
    >
      Добавить в корзину
    </Button>
  );
}

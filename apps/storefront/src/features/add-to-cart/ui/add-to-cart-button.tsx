'use client';

import { Product } from '@/src/entities/product';
import { useCartStore } from '@/src/entities/cart';
import { Button } from '@/src/shared/ui';

export function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);

  return (
    <Button
      className="bg-brand-primary text-brand-primary-foreground hover:bg-brand-primary/90"
      onClick={() => addItem(product)}
      size="sm"
      type="button"
    >
      Добавить в корзину
    </Button>
  );
}

'use client';

import { useCartStore } from '@/src/entities/cart';
import { Button, Input, Label } from '@/src/shared/ui';

export function CartItemActions({ productId, quantity }: { productId: string; quantity: number }) {
  const removeItem = useCartStore((state) => state.removeItem);
  const setQuantity = useCartStore((state) => state.setQuantity);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={`qty-${productId}`}>Qty</Label>
        <Input
          className="w-20"
          id={`qty-${productId}`}
          min={1}
          onChange={(event) => setQuantity(productId, Number(event.target.value))}
          type="number"
          value={quantity}
        />
      </div>
      <Button onClick={() => removeItem(productId)} type="button" variant="outline">
        Удалить из корзины
      </Button>
    </div>
  );
}

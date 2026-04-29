'use client';

import { useCartStore } from '@/src/entities/cart';

export function CartItemActions({ productId, quantity }: { productId: string; quantity: number }) {
  const removeItem = useCartStore((state) => state.removeItem);
  const setQuantity = useCartStore((state) => state.setQuantity);

  return (
    <>
      <label>
        Qty:{' '}
        <input
          min={1}
          onChange={(event) => setQuantity(productId, Number(event.target.value))}
          type="number"
          value={quantity}
        />
      </label>
      <button onClick={() => removeItem(productId)} style={{ marginLeft: 8 }} type="button">
        Remove
      </button>
    </>
  );
}

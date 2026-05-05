'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { formatPrice } from '@/src/shared/lib/format';
import { Separator } from '@/src/shared/ui';
import { CartItem } from '../model/cart-store';

export function CartItemRow({ item, actions }: { item: CartItem; actions?: ReactNode }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(item.product.imageUrl) && !imageFailed;

  return (
    <article className="space-y-3">
      <Separator />
      <div className="flex gap-3 pt-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-black/25">
          {hasImage ? (
            <Image
              alt={item.product.name}
              className="object-cover"
              fill
              onError={() => setImageFailed(true)}
              sizes="64px"
              src={item.product.imageUrl as string}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-brand-muted">
              Нет изображения
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-brand-heading">{item.product.name}</h3>
          <p className="text-sm text-brand-muted">{formatPrice(item.product.priceMinor)}</p>
        </div>
      </div>
      {actions}
    </article>
  );
}

'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { formatPrice } from '@/src/shared/lib/format';
import { Badge, Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/src/shared/ui';
import { Product } from '../model/types';

export function ProductCard({ product, actions }: { product: Product; actions?: ReactNode }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(product.imageUrl) && !imageFailed;

  return (
    <Card className="storefront-glass-panel overflow-hidden border text-white shadow-sm">
      <div className="relative h-48 bg-black/25">
        {hasImage ? (
          <Image
            alt={product.name}
            className="object-cover"
            fill
            onError={() => setImageFailed(true)}
            sizes="(max-width: 768px) 100vw, 33vw"
            src={product.imageUrl as string}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-brand-muted">
            Нет изображения
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base text-brand-heading">{product.name}</CardTitle>
          <Badge className="border-brand-accent/55 text-brand-heading" variant="outline">
            {formatPrice(product.priceMinor)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-4 text-sm text-brand-muted">
        {product.description ?? 'Описание отсутствует'}
      </CardContent>
      {actions && <CardFooter>{actions}</CardFooter>}
    </Card>
  );
}

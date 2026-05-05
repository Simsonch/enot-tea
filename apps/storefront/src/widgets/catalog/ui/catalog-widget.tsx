'use client';

import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/src/entities/product';
import { AddToCartButton } from '@/src/features/add-to-cart';
import { fetchProducts } from '@/src/shared/api';
import { Card, CardDescription, CardHeader, CardTitle, Skeleton } from '@/src/shared/ui';
import { CatalogHeader } from './catalog-header';

export function CatalogWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetchProducts({ limit: 50, offset: 0, isActive: true }),
  });

  if (isLoading) {
    return (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="storefront-glass-panel border text-white shadow-sm">
            <Skeleton className="h-48 w-full rounded-b-none rounded-t-xl" />
            <CardHeader>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
          </Card>
        ))}
      </section>
    );
  }

  if (isError || !data) {
    return (
      <Card className="storefront-glass-panel border text-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-brand-heading">Не удалось загрузить каталог</CardTitle>
          <CardDescription className="text-brand-muted">
            Пожалуйста, обновите страницу и попробуйте снова.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <CatalogHeader />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((product) => (
          <ProductCard key={product.id} product={product} actions={<AddToCartButton product={product} />} />
        ))}
      </div>
    </section>
  );
}

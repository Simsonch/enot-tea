'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ProductCard } from '@/src/entities/product';
import { AddToCartButton } from '@/src/features/add-to-cart';
import { fetchProducts } from '@/src/shared/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  buttonVariants,
} from '@/src/shared/ui';
import { cn } from '@/src/shared/lib/utils';

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
      <Card className="storefront-glass-panel border text-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-brand-heading">Каталог</CardTitle>
          <CardDescription className="text-brand-muted">
            Выберите ваш чай и добавьте его в корзину.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            className={buttonVariants({
              variant: 'outline',
              className: cn(
                'border-brand-accent text-brand-accent-foreground hover:bg-brand-accent/20 hover:text-brand-accent-foreground',
              ),
            })}
            href="/cart"
          >
            Перейти в корзину
          </Link>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((product) => (
          <ProductCard key={product.id} product={product} actions={<AddToCartButton product={product} />} />
        ))}
      </div>
    </section>
  );
}

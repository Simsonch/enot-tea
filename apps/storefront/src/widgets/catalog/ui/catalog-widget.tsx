'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ProductCard } from '@/src/entities/product';
import { AddToCartButton } from '@/src/features/add-to-cart';
import { fetchProducts } from '@/src/shared/api';

export function CatalogWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetchProducts({ limit: 50, offset: 0, isActive: true }),
  });

  if (isLoading) {
    return <section className="card">Loading catalog...</section>;
  }

  if (isError || !data) {
    return <section className="card">Unable to load catalog. Please refresh.</section>;
  }

  return (
    <section className="stack">
      {data.map((product) => (
        <ProductCard key={product.id} product={product} actions={<AddToCartButton product={product} />} />
      ))}
      <Link href="/cart">Go to cart</Link>
    </section>
  );
}

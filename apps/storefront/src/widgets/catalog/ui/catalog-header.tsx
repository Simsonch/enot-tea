'use client';

import { CatalogFilter } from '@/src/features/catalog-filter';
import { cn } from '@/src/shared/lib/utils';
import { useIsScrolled } from '@/src/shared/lib/use-is-scrolled';
import { Breadcrumbs, Card, CardContent, CardHeader, CardTitle } from '@/src/shared/ui';

export function CatalogHeader() {
  const isScrolled = useIsScrolled();

  return (
    <Card
      className={cn(
        'sticky z-20 border text-white shadow-sm transition-colors',
        isScrolled ? 'border-[color:var(--brand-glass-border)] bg-[#0b120d]' : 'storefront-glass-panel',
      )}
      style={{ top: 'var(--header-bottom, 0px)' }}
    >
      <CardHeader className="gap-2 pb-3">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Главная', href: '/' },
              { label: 'Каталог', href: '/' },
              { label: 'Группа товара' },
            ]}
          />
        </div>
        <CardTitle className="text-brand-heading">Группа товара</CardTitle>
      </CardHeader>
      <CardContent>
        <CatalogFilter />
      </CardContent>
    </Card>
  );
}

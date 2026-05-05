import Link from 'next/link';

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Хлебные крошки">
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !isCurrent ? (
                <Link className="text-brand-muted/90 transition-colors hover:text-brand-heading" href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? 'page' : undefined} className={isCurrent ? 'font-medium text-brand-heading' : 'text-brand-muted/90'}>
                  {item.label}
                </span>
              )}
              {!isCurrent ? (
                <span aria-hidden="true" className="text-brand-muted/50">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

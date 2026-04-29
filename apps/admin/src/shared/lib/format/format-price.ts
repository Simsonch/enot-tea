export function formatPrice(minor: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'GEL',
  }).format(minor / 100);
}

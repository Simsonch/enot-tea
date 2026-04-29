import { CartItem } from './cart-store';

export function getCartTotalMinor(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.product.priceMinor * item.quantity, 0);
}

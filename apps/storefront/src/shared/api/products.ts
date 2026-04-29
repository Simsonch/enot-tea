import { ProductsControllerListParams, productsControllerList } from '@enot-tea/api-client';

export async function fetchProducts(params?: ProductsControllerListParams) {
  const response = await productsControllerList(params, { cache: 'no-store' });
  return response.data.items;
}

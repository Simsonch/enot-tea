import { CreateOrderDto, ordersControllerCreate } from '@enot-tea/api-client';

export async function postGuestOrder(payload: CreateOrderDto) {
  return ordersControllerCreate(payload);
}

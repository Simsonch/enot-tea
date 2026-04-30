import {
  authControllerLogin,
  LoginDto,
  ManualOrderLifecycleTransitionDto,
  OrderResponseDto,
  OrdersControllerListParams,
  OrdersListResponseDto,
  ordersControllerCancel,
  ordersControllerConfirmDelivered,
  ordersControllerConfirmPayment,
  ordersControllerGetById,
  ordersControllerHandOffToDelivery,
  ordersControllerList,
  ordersControllerMarkInvoiceSent,
  ordersControllerResendNotification,
} from '@enot-tea/api-client';

type ApiResponse = {
  status: number;
  data: unknown;
};

export type OrderAction =
  | 'invoice-sent'
  | 'payment-confirmed'
  | 'handoff-to-delivery'
  | 'delivered'
  | 'cancel';

function authOptions(token: string): RequestInit {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export function describeApiError(response: ApiResponse) {
  const data = response.data as
    | { code?: string; message?: string; errors?: Array<{ field: string; messages: string[] }> }
    | undefined;

  if (data?.code === 'VALIDATION_ERROR' && data.errors?.length) {
    return data.errors.map((error) => `${error.field}: ${error.messages.join(', ')}`).join('; ');
  }

  if (data?.code === 'INVALID_ORDER_STATUS_TRANSITION') {
    return 'Недопустимый переход статуса для текущего состояния заказа.';
  }

  if (data?.code === 'INVENTORY_INVARIANT_VIOLATION') {
    return 'Нельзя выполнить действие из-за неконсистентного остатка склада.';
  }

  if (response.status === 401) {
    return 'Сессия истекла или токен недействителен. Войдите снова.';
  }

  if (response.status === 403) {
    return 'Операция доступна только владельцу.';
  }

  return data?.message ?? 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

function ensureSuccess<T>(response: ApiResponse, expectedStatus: number): T {
  if (response.status !== expectedStatus) {
    throw new Error(describeApiError(response));
  }

  return response.data as T;
}

export async function loginOwner(payload: LoginDto) {
  const response = await authControllerLogin(payload);
  return ensureSuccess<{ accessToken: string; email: string; ownerId: string }>(response, 200);
}

export async function fetchOrders(token: string, params: OrdersControllerListParams) {
  const response = await ordersControllerList(params, authOptions(token));
  return ensureSuccess<OrdersListResponseDto>(response, 200);
}

export async function fetchOrder(token: string, orderId: string) {
  const response = await ordersControllerGetById(orderId, authOptions(token));
  return ensureSuccess<OrderResponseDto>(response, 200);
}

export async function runOrderAction(
  token: string,
  orderId: string,
  action: OrderAction,
  payload: ManualOrderLifecycleTransitionDto = {},
) {
  const options = authOptions(token);
  const response = await {
    cancel: () => ordersControllerCancel(orderId, payload, options),
    delivered: () => ordersControllerConfirmDelivered(orderId, payload, options),
    'handoff-to-delivery': () => ordersControllerHandOffToDelivery(orderId, payload, options),
    'invoice-sent': () => ordersControllerMarkInvoiceSent(orderId, payload, options),
    'payment-confirmed': () => ordersControllerConfirmPayment(orderId, payload, options),
  }[action]();

  return ensureSuccess<OrderResponseDto>(response, 200);
}

export async function resendOrderNotification(token: string, orderId: string) {
  const response = await ordersControllerResendNotification(orderId, authOptions(token));
  return ensureSuccess<OrderResponseDto>(response, 200);
}

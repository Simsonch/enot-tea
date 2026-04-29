import { ApiBusinessConflictBodyDto, ApiValidationErrorBodyDto, CreateOrderDto } from '@enot-tea/api-client';
import { postGuestOrder } from '@/src/shared/api';
import { CheckoutError } from './types';

export async function submitOrder(payload: CreateOrderDto): Promise<{ orderId: string }> {
  try {
    const response = await postGuestOrder(payload);

    if (response.status === 201) {
      return { orderId: response.data.id };
    }

    if (response.status === 400) {
      throw buildValidationError(response.data);
    }

    if (response.status === 409) {
      throw buildConflictError(response.data);
    }

    throw {
      kind: 'unknown',
      message: 'Unexpected response from API.',
    } satisfies CheckoutError;
  } catch (error) {
    if (isCheckoutError(error)) {
      throw error;
    }

    throw {
      kind: 'network',
      message: 'Network error. Please try again.',
    } satisfies CheckoutError;
  }
}

function buildValidationError(data: ApiValidationErrorBodyDto): CheckoutError {
  const fields = Object.fromEntries((data.errors ?? []).map((item) => [item.field, item.messages]));
  return {
    kind: 'validation',
    message: data.message || 'Please check form fields.',
    fields,
  };
}

function buildConflictError(data: ApiBusinessConflictBodyDto): CheckoutError {
  if (data.code === 'INSUFFICIENT_STOCK') {
    return {
      kind: 'stock',
      message: data.message || 'Some products are out of stock.',
    };
  }

  return {
    kind: 'unknown',
    message: data.message || 'Order request cannot be completed.',
  };
}

function isCheckoutError(error: unknown): error is CheckoutError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const value = error as { kind?: string; message?: string };
  return typeof value.kind === 'string' && typeof value.message === 'string';
}

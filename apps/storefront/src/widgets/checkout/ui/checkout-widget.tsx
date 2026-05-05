'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCartTotalMinor, useCartStore } from '@/src/entities/cart';
import { CheckoutError, submitOrder } from '@/src/features/checkout-order';
import { formatPrice } from '@/src/shared/lib/format';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/src/shared/ui';

type FormState = {
  customerFullName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
};

const initialForm: FormState = {
  customerFullName: '',
  customerEmail: '',
  customerPhone: '',
  shippingAddress: '',
};

export function CheckoutWidget() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<CheckoutError | null>(null);
  const totalMinor = useMemo(() => getCartTotalMinor(items), [items]);

  if (items.length === 0) {
    return (
      <Card className="storefront-glass-panel border text-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-brand-heading">Оформление заказа</CardTitle>
          <CardDescription className="text-brand-muted">Ваша корзина пуста.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await submitOrder({
        customerFullName: form.customerFullName,
        customerEmail: form.customerEmail,
        customerPhone: form.customerPhone || undefined,
        shippingAddress: form.shippingAddress,
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      clearCart();
      router.push(`/thank-you/${result.orderId}`);
    } catch (err) {
      setError(err as CheckoutError);
    } finally {
      setSubmitting(false);
    }
  }

  const fieldErrors = error?.kind === 'validation' ? error.fields : {};

  return (
    <Card className="storefront-glass-panel border text-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-brand-heading">Оформление заказа</CardTitle>
        <CardDescription className="text-brand-muted">
          Общая стоимость: {formatPrice(totalMinor)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        <form className="grid gap-4" onSubmit={onSubmit}>
        <Field
          id="customer-full-name"
          error={fieldErrors.customerFullName?.[0]}
          label="Полное имя"
          onChange={(value) => setForm((prev) => ({ ...prev, customerFullName: value }))}
          required
          value={form.customerFullName}
        />
        <Field
          id="customer-email"
          error={fieldErrors.customerEmail?.[0]}
          label="Email"
          onChange={(value) => setForm((prev) => ({ ...prev, customerEmail: value }))}
          required
          type="email"
          value={form.customerEmail}
        />
        <Field
          id="customer-phone"
          error={fieldErrors.customerPhone?.[0]}
          label="Телефон (необязательно)"
          onChange={(value) => setForm((prev) => ({ ...prev, customerPhone: value }))}
          value={form.customerPhone}
        />
        <Field
          id="shipping-address"
          error={fieldErrors.shippingAddress?.[0]}
          label="Адрес доставки"
          onChange={(value) => setForm((prev) => ({ ...prev, shippingAddress: value }))}
          required
          value={form.shippingAddress}
        />
        <Button
          disabled={submitting}
          type="submit"
          variant="brand"
        >
          {submitting ? 'Отправка...' : 'Оформить заказ'}
        </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
      {error && <small className="text-xs text-destructive">{error}</small>}
    </div>
  );
}

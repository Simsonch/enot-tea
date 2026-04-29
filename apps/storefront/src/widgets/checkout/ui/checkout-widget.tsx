'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCartTotalMinor, useCartStore } from '@/src/entities/cart';
import { CheckoutError, submitOrder } from '@/src/features/checkout-order';
import { formatPrice } from '@/src/shared/lib/format';

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
      <section className="card">
        <h2>Checkout</h2>
        <p>Your cart is empty.</p>
      </section>
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
    <section className="card stack">
      <h2 style={{ margin: 0 }}>Checkout</h2>
      <p style={{ margin: 0 }}>Total: {formatPrice(totalMinor)}</p>
      {error && <p style={{ color: '#c22', margin: 0 }}>{error.message}</p>}
      <form className="stack" onSubmit={onSubmit}>
        <Field
          error={fieldErrors.customerFullName?.[0]}
          label="Full name"
          onChange={(value) => setForm((prev) => ({ ...prev, customerFullName: value }))}
          required
          value={form.customerFullName}
        />
        <Field
          error={fieldErrors.customerEmail?.[0]}
          label="Email"
          onChange={(value) => setForm((prev) => ({ ...prev, customerEmail: value }))}
          required
          type="email"
          value={form.customerEmail}
        />
        <Field
          error={fieldErrors.customerPhone?.[0]}
          label="Phone (optional)"
          onChange={(value) => setForm((prev) => ({ ...prev, customerPhone: value }))}
          value={form.customerPhone}
        />
        <Field
          error={fieldErrors.shippingAddress?.[0]}
          label="Shipping address"
          onChange={(value) => setForm((prev) => ({ ...prev, shippingAddress: value }))}
          required
          value={form.shippingAddress}
        />
        <button disabled={submitting} type="submit">
          {submitting ? 'Submitting...' : 'Submit order'}
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        required={required}
        style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        type={type}
        value={value}
      />
      {error && <small style={{ color: '#c22' }}>{error}</small>}
    </label>
  );
}

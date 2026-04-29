import Link from 'next/link';

export function ThankYouScreen({ orderId }: { orderId: string }) {
  return (
    <section className="card stack">
      <h2 style={{ margin: 0 }}>Thank you for your order</h2>
      <p style={{ margin: 0 }}>
        Order id: <strong>{orderId}</strong>
      </p>
      <Link href="/">Back to catalog</Link>
    </section>
  );
}

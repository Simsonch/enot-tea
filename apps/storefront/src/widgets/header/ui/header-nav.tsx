import Link from 'next/link';

export function HeaderNav() {
  return (
    <header className="card">
      <h1 style={{ margin: '0 0 8px' }}>Enot Tea</h1>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link href="/">Catalog</Link>
        <Link href="/cart">Cart</Link>
        <Link href="/checkout">Checkout</Link>
      </nav>
    </header>
  );
}

import { OrderDetail } from '@/src/widgets/admin-shell';

export default async function OrderRoute({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <OrderDetail orderId={orderId} />;
}

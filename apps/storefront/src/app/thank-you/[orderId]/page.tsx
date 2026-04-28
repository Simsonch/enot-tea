import { ThankYouScreen } from '@/src/screens/thank-you-screen';

export default async function ThankYouRoute({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return <ThankYouScreen orderId={orderId} />;
}

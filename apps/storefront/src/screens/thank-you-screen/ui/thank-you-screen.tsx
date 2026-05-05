import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, buttonVariants } from '@/src/shared/ui';

export function ThankYouScreen({ orderId }: { orderId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Спасибо за ваш заказ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          ID заказа: <strong className="text-foreground">{orderId}</strong>
        </p>
        <Link className={buttonVariants({ variant: 'outline' })} href="/">
          Перейти в каталог
        </Link>
      </CardContent>
    </Card>
  );
}

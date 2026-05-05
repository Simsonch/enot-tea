'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ProductsControllerCreateBody } from '@enot-tea/api-client';
import { createProduct } from '@/src/shared/api/admin-api';
import { readOwnerToken } from '@/src/shared/lib/auth-token';
import { Alert, AlertDescription } from '@/src/shared/ui/alert';
import { Button } from '@/src/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/shared/ui/card';
import { Input } from '@/src/shared/ui/input';
import { Label } from '@/src/shared/ui/label';

type MessageState = {
  text: string;
  variant: 'default' | 'destructive';
};

function parseStrictNonNegativeInt(raw: string) {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

export function ProductCreate() {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [priceMinor, setPriceMinor] = useState('');
  const [description, setDescription] = useState('');
  const [productType, setProductType] = useState('');
  const [category, setCategory] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [promotionLabel, setPromotionLabel] = useState('');
  const [discountedPriceMinor, setDiscountedPriceMinor] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState<MessageState | null>(null);

  useEffect(() => {
    setToken(readOwnerToken());
  }, []);

  const createMutation = useMutation({
    mutationFn: async (payload: ProductsControllerCreateBody) => createProduct(token ?? '', payload),
    onSuccess: (product) => {
      setSku('');
      setName('');
      setPriceMinor('');
      setDescription('');
      setProductType('');
      setCategory('');
      setDiscountPercent('');
      setPromotionLabel('');
      setDiscountedPriceMinor('');
      setIsActive(true);
      setImage(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      setMessage({ text: `Товар "${product.name}" создан.`, variant: 'default' });
    },
    onError: (error) => {
      setMessage({
        text: error instanceof Error ? error.message : 'Не удалось создать товар.',
        variant: 'destructive',
      });
    },
  });

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImage(event.target.files?.[0] ?? null);
  }

  function validateForm() {
    if (!sku.trim() || !name.trim()) {
      return 'Заполните SKU и название товара.';
    }

    const parsedPriceMinor = parseStrictNonNegativeInt(priceMinor);
    if (parsedPriceMinor === null) {
      return 'Цена должна быть целым числом не меньше 0.';
    }

    if (!image) {
      return 'Добавьте изображение товара.';
    }

    if (discountPercent.trim()) {
      const parsedDiscountPercent = parseStrictNonNegativeInt(discountPercent);
      if (parsedDiscountPercent === null || parsedDiscountPercent > 100) {
        return 'Скидка должна быть целым числом от 0 до 100.';
      }
    }

    if (discountedPriceMinor.trim()) {
      const parsedDiscountedPriceMinor = parseStrictNonNegativeInt(discountedPriceMinor);
      if (parsedDiscountedPriceMinor === null) {
        return 'Цена со скидкой должна быть целым числом не меньше 0.';
      }
    }

    return null;
  }

  function buildPayload(): ProductsControllerCreateBody {
    const parsedPriceMinor = parseStrictNonNegativeInt(priceMinor);
    if (parsedPriceMinor === null || !image) {
      throw new Error('Форма содержит некорректные данные.');
    }

    const payload: ProductsControllerCreateBody = {
      sku: sku.trim(),
      name: name.trim(),
      priceMinor: parsedPriceMinor,
      image,
      isActive,
    };

    if (description.trim()) {
      payload.description = description.trim();
    }
    if (productType.trim()) {
      payload.productType = productType.trim();
    }
    if (category.trim()) {
      payload.category = category.trim();
    }
    if (promotionLabel.trim()) {
      payload.promotionLabel = promotionLabel.trim();
    }
    if (discountPercent.trim()) {
      const parsedDiscountPercent = parseStrictNonNegativeInt(discountPercent);
      if (parsedDiscountPercent !== null) {
        payload.discountPercent = parsedDiscountPercent;
      }
    }
    if (discountedPriceMinor.trim()) {
      const parsedDiscountedPriceMinor = parseStrictNonNegativeInt(discountedPriceMinor);
      if (parsedDiscountedPriceMinor !== null) {
        payload.discountedPriceMinor = parsedDiscountedPriceMinor;
      }
    }

    return payload;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setMessage({ text: validationError, variant: 'destructive' });
      return;
    }

    createMutation.mutate(buildPayload());
  }

  if (!token) {
    return (
      <main className="flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Требуется вход</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button variant="link" className="p-0">
                <ArrowLeft className="mr-2 size-4" />
                Вернуться к логину
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <Link href="/">
        <Button variant="link" className="p-0">
          <ArrowLeft className="mr-2 size-4" />
          К заказам
        </Button>
      </Link>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Добавление товара</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input id="sku" value={sku} onChange={(event) => setSku(event.target.value)} maxLength={64} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={255}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="priceMinor">Цена (minor) *</Label>
                <Input
                  id="priceMinor"
                  type="number"
                  min={0}
                  step={1}
                  value={priceMinor}
                  onChange={(event) => setPriceMinor(event.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">Категория</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  maxLength={128}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="productType">Тип товара</Label>
                <Input
                  id="productType"
                  value={productType}
                  onChange={(event) => setProductType(event.target.value)}
                  maxLength={128}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="promotionLabel">Промо-лейбл</Label>
                <Input
                  id="promotionLabel"
                  value={promotionLabel}
                  onChange={(event) => setPromotionLabel(event.target.value)}
                  maxLength={128}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="discountPercent">Скидка (%)</Label>
                <Input
                  id="discountPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="discountedPriceMinor">Цена со скидкой (minor)</Label>
                <Input
                  id="discountedPriceMinor"
                  type="number"
                  min={0}
                  step={1}
                  value={discountedPriceMinor}
                  onChange={(event) => setDiscountedPriceMinor(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Описание</Label>
              <Input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="isActive">Статус</Label>
              <select
                id="isActive"
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                value={isActive ? 'true' : 'false'}
                onChange={(event) => setIsActive(event.target.value === 'true')}
              >
                <option value="true">Активен</option>
                <option value="false">Неактивен</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="image">Изображение *</Label>
              <Input
                id="image"
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleImageChange}
                required
              />
            </div>

            {message ? (
              <Alert variant={message.variant}>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Создать товар
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

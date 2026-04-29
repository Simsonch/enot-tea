export type CheckoutError =
  | {
      kind: 'validation';
      message: string;
      fields: Record<string, string[]>;
    }
  | {
      kind: 'stock';
      message: string;
    }
  | {
      kind: 'network';
      message: string;
    }
  | {
      kind: 'unknown';
      message: string;
    };

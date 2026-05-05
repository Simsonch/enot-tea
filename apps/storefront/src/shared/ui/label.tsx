import * as React from 'react';
import { cn } from '@/src/shared/lib/utils';

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-sm font-medium leading-none', className)} {...props} />;
}

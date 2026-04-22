import type { ValidationError } from 'class-validator';

export type FieldValidationItem = {
  field: string;
  messages: string[];
};

/**
 * Собирает плоский список полей с сообщениями из дерева class-validator.
 */
export function formatValidationFieldErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldValidationItem[] {
  const out: FieldValidationItem[] = [];
  for (const err of errors) {
    const field = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints && Object.keys(err.constraints).length > 0) {
      out.push({
        field,
        messages: Object.values(err.constraints),
      });
    }
    if (err.children?.length) {
      out.push(...formatValidationFieldErrors(err.children, field));
    }
  }
  return out;
}

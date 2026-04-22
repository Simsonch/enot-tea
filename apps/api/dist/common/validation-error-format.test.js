import test from 'node:test';
import assert from 'node:assert/strict';
import { formatValidationFieldErrors } from './validation-error-format.js';
test('formatValidationFieldErrors: вложенные поля с точечными путями', () => {
    const errors = [
        {
            property: 'items',
            children: [
                {
                    property: '0',
                    children: [
                        {
                            property: 'quantity',
                            constraints: { min: 'min message' },
                            children: [],
                        },
                    ],
                },
            ],
        },
    ];
    const flat = formatValidationFieldErrors(errors);
    assert.equal(flat.length, 1);
    const first = flat[0];
    assert.ok(first);
    assert.equal(first.field, 'items.0.quantity');
    assert.deepEqual(first.messages, ['min message']);
});
//# sourceMappingURL=validation-error-format.test.js.map
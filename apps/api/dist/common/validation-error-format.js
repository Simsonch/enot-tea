/**
 * Собирает плоский список полей с сообщениями из дерева class-validator.
 */
export function formatValidationFieldErrors(errors, parentPath = '') {
    const out = [];
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
//# sourceMappingURL=validation-error-format.js.map
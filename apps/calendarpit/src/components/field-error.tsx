/**
 * Shows a form field's first validation error, announced to screen readers
 * as a `role="alert"` message. Renders nothing when `errors` has no truthy
 * entry.
 *
 * Pass `id` when a control should reference the message through
 * `aria-describedby`. Set that attribute only while an error is shown, so it
 * never points at an element that is not rendered.
 */
export function FieldError({
  errors,
  id,
}: {
  errors: unknown[];
  /** Element id for the message, so a control can reference it. */
  id?: string;
}) {
  const [first] = errors;
  return first ? (
    <span id={id} className='error-message' role='alert'>
      {String(first)}
    </span>
  ) : null;
}

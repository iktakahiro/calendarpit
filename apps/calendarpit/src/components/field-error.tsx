/** Shows a form field's first validation error, announced to screen readers. */
export function FieldError({ errors }: { errors: unknown[] }) {
  const [first] = errors;
  return first ? (
    <span className='error-message' role='alert'>
      {String(first)}
    </span>
  ) : null;
}

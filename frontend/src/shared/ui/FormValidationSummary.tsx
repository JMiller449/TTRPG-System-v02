export function FormValidationSummary({
  visible,
  message = "Complete all required fields.",
  id
}: {
  visible: boolean;
  message?: string;
  id?: string;
}): JSX.Element | null {
  if (!visible) {
    return null;
  }

  return (
    <p className="form-validation-summary error-text" id={id} role="alert">
      {message}
    </p>
  );
}

import { useCallback, useMemo, useState } from "react";

export function useFormValidationAttempt(): {
  attempted: boolean;
  validate: (valid: boolean) => boolean;
  reset: () => void;
} {
  const [attempted, setAttempted] = useState(false);

  const validate = useCallback((valid: boolean): boolean => {
    setAttempted(!valid);
    return valid;
  }, []);

  const reset = useCallback((): void => setAttempted(false), []);

  return useMemo(() => ({ attempted, validate, reset }), [attempted, reset, validate]);
}

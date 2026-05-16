import type { Address } from "@isonia/types";
import { AlertCircleIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChangeEvent, FocusEvent } from "react";
import { useEffect, useId, useMemo } from "react";
import {
  validateAddressInput,
  type AddressValidationResult,
} from "./address-utils";

export interface AddressInputProps {
  readonly allowZeroAddress?: boolean;
  readonly autoComplete?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly id?: string;
  readonly label?: string;
  readonly name?: string;
  readonly normalizeOnBlur?: boolean;
  readonly onChange: (
    value: string,
    validation: AddressValidationResult,
  ) => void;
  readonly onNormalizedAddressChange?: (
    value: Address | undefined,
    validation: AddressValidationResult,
  ) => void;
  readonly onBlur?: () => void;
  readonly onValidationChange?: (validation: AddressValidationResult) => void;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly showFeedback?: boolean;
  readonly size?: "normal" | "compact";
  readonly value: string;
}

export function AddressInput({
  allowZeroAddress = false,
  autoComplete = "off",
  className,
  disabled = false,
  error,
  id,
  label,
  name,
  normalizeOnBlur = false,
  onBlur,
  onChange,
  onNormalizedAddressChange,
  onValidationChange,
  placeholder = "0x...",
  required = false,
  showFeedback = true,
  size = "normal",
  value,
}: AddressInputProps): JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const feedbackId = `${inputId}-feedback`;
  const validation = useMemo(
    () => validateAddressInput(value, { allowZeroAddress, required }),
    [allowZeroAddress, required, value],
  );
  const isInvalid = Boolean(error) || (
    validation.status !== "empty" && validation.status !== "valid"
  );
  const tone = error ? "danger" : showFeedback ? validation.tone : "neutral";
  const feedback = error ?? validation.message;

  useEffect(() => {
    onValidationChange?.(validation);
  }, [onValidationChange, validation]);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextValue = event.target.value;
    const nextValidation = validateAddressInput(nextValue, {
      allowZeroAddress,
      required,
    });

    onChange(nextValue, nextValidation);
    onNormalizedAddressChange?.(
      nextValidation.normalizedAddress,
      nextValidation,
    );
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>): void {
    onBlur?.();

    if (!normalizeOnBlur || !validation.normalizedAddress) {
      return;
    }

    if (event.target.value === validation.normalizedAddress) {
      return;
    }

    const nextValidation = validateAddressInput(validation.normalizedAddress, {
      allowZeroAddress,
      required,
    });

    onChange(validation.normalizedAddress, nextValidation);
    onNormalizedAddressChange?.(
      nextValidation.normalizedAddress,
      nextValidation,
    );
  }

  return (
    <div
      className={[
        "address-field",
        `address-field-${size}`,
        `iso-state-${tone}`,
        error ? "address-field-invalid" : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label ? (
        <label className="address-field-label" htmlFor={inputId}>
          {label}
          {required ? (
            <span aria-hidden="true" className="field-required-marker">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <div
        className={[
          "address-input-shell",
          `address-input-${validation.status}`,
        ].join(" ")}
      >
        <input
          aria-describedby={feedbackId}
          aria-invalid={isInvalid}
          autoComplete={autoComplete}
          className="address-input"
          disabled={disabled}
          id={inputId}
          name={name}
          placeholder={placeholder}
          required={required}
          spellCheck={false}
          type="text"
          value={value}
          onBlur={handleBlur}
          onChange={handleChange}
        />
        <AddressInputStatusMark
          invalid={isInvalid}
          message={feedback}
          validation={validation}
        />
      </div>
      <span className="address-input-feedback" id={feedbackId}>
        {showFeedback ? feedback : ""}
      </span>
    </div>
  );
}

function AddressInputStatusMark({
  invalid,
  message,
  validation,
}: {
  readonly invalid: boolean;
  readonly message: string;
  readonly validation: AddressValidationResult;
}): JSX.Element {
  if (validation.status === "valid" && !invalid) {
    return (
      <span
        aria-label="Valid address"
        className="address-input-mark"
        role="img"
      >
        <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={1.9} />
      </span>
    );
  }

  if (invalid || validation.status !== "empty") {
    return (
      <span
        aria-label={message || "Invalid address"}
        className="address-input-mark"
        role="img"
      >
        <HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={1.9} />
      </span>
    );
  }

  return <span aria-hidden="true" className="address-input-mark" />;
}

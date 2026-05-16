import type { Address } from "@isonia/types";
import type {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  FocusEvent,
  MouseEvent,
} from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AddressChip } from "./AddressChip";
import {
  deduplicateAddressItems,
  parseAddressListInput,
  type ParsedAddressListItem,
} from "./address-utils";

export interface MultiAddressValidationSummary {
  readonly duplicateCount: number;
  readonly invalidCount: number;
  readonly isValid: boolean;
  readonly messages: readonly string[];
  readonly normalizedAddresses: readonly Address[];
  readonly removedDuplicateCount: number;
  readonly totalCount: number;
  readonly validCount: number;
}

export interface MultiAddressInputProps {
  readonly allowZeroAddress?: boolean;
  readonly autoComplete?: string;
  readonly className?: string;
  readonly deduplicate?: boolean;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly id?: string;
  readonly label?: string;
  readonly max?: number;
  readonly min?: number;
  readonly normalizeOutput?: boolean;
  readonly onChange: (
    value: readonly string[],
    summary: MultiAddressValidationSummary,
  ) => void;
  readonly onBlur?: () => void;
  readonly onValidationChange?: (
    summary: MultiAddressValidationSummary,
  ) => void;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly showFeedback?: boolean;
  readonly size?: "normal" | "compact";
  readonly value: readonly string[];
}

export function MultiAddressInput({
  allowZeroAddress = false,
  autoComplete = "off",
  className,
  deduplicate = true,
  disabled = false,
  error,
  id,
  label,
  max,
  min,
  normalizeOutput = true,
  onBlur,
  onChange,
  onValidationChange,
  placeholder = "Paste or type addresses",
  required = false,
  showFeedback = true,
  size = "normal",
  value,
}: MultiAddressInputProps): JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const summaryId = `${inputId}-summary`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftValue, setDraftValue] = useState("");
  const parsedItems = useMemo(
    () => parseAddressListInput(value, { allowZeroAddress, required: false }),
    [allowZeroAddress, value],
  );
  const duplicateResult = useMemo(
    () =>
      deduplicateAddressItems(parsedItems, {
        removeDuplicates: false,
      }),
    [parsedItems],
  );
  const displayItems = deduplicate ? parsedItems : duplicateResult.items;
  const summary = useMemo(
    () =>
      summarizeAddressItems({
        duplicateCount: duplicateResult.duplicateCount,
        items: displayItems,
        max,
        min,
        removedDuplicateCount: 0,
        required,
      }),
    [
      displayItems,
      duplicateResult.duplicateCount,
      max,
      min,
      required,
    ],
  );
  const inputTone = error
    ? "danger"
    : showFeedback && !summary.isValid
      ? "warning"
      : "neutral";

  useEffect(() => {
    onValidationChange?.(summary);
  }, [onValidationChange, summary]);

  function addRawInput(rawInput: string): void {
    const nextItems = parseAddressListInput(rawInput, {
      allowZeroAddress,
      required: false,
    });

    if (nextItems.length === 0) {
      return;
    }

    const existingKeys = new Set(
      parseAddressListInput(value, { allowZeroAddress, required: false })
        .map((item) => item.validation.normalizedAddress?.toLowerCase())
        .filter((item): item is string => item !== undefined),
    );
    const nextValues = [...value];
    let removedDuplicateCount = 0;

    for (const item of nextItems) {
      const normalizedAddress = item.validation.normalizedAddress;

      if (!normalizedAddress) {
        nextValues.push(item.rawInput);
        continue;
      }

      const normalizedKey = normalizedAddress.toLowerCase();

      if (deduplicate && existingKeys.has(normalizedKey)) {
        removedDuplicateCount += 1;
        continue;
      }

      existingKeys.add(normalizedKey);
      nextValues.push(normalizeOutput ? normalizedAddress : item.rawInput);
    }

    const nextParsedItems = parseAddressListInput(nextValues, {
      allowZeroAddress,
      required: false,
    });
    const nextDuplicateResult = deduplicateAddressItems(nextParsedItems, {
      removeDuplicates: false,
    });
    const nextSummary = summarizeAddressItems({
      duplicateCount: nextDuplicateResult.duplicateCount,
      items: deduplicate ? nextParsedItems : nextDuplicateResult.items,
      max,
      min,
      removedDuplicateCount,
      required,
    });

    setDraftValue("");
    onChange(nextValues, nextSummary);
  }

  function removeItem(item: ParsedAddressListItem): void {
    const nextValues = value.filter((_, index) => index !== item.index);
    const nextParsedItems = parseAddressListInput(nextValues, {
      allowZeroAddress,
      required: false,
    });
    const nextDuplicateResult = deduplicateAddressItems(nextParsedItems, {
      removeDuplicates: false,
    });

    onChange(
      nextValues,
      summarizeAddressItems({
        duplicateCount: nextDuplicateResult.duplicateCount,
        items: deduplicate ? nextParsedItems : nextDuplicateResult.items,
        max,
        min,
        removedDuplicateCount: 0,
        required,
      }),
    );
  }

  function commitDraft(): void {
    addRawInput(draftValue);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    setDraftValue(event.target.value);
  }

  function handleShellClick(event: MouseEvent<HTMLDivElement>): void {
    if (disabled) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      inputRef.current?.focus();
      return;
    }

    if (target.closest("button, a, input, select, textarea, [role='button']")) {
      return;
    }

    inputRef.current?.focus();
  }

  function handleBlur(_: FocusEvent<HTMLInputElement>): void {
    onBlur?.();
    commitDraft();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>): void {
    if (disabled) {
      return;
    }

    const pastedText = event.clipboardData.getData("text");

    if (!pastedText) {
      return;
    }

    event.preventDefault();
    addRawInput(`${draftValue} ${pastedText}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Backspace" && draftValue.length === 0 && value.length > 0) {
      event.preventDefault();
      removeItem({ ...displayItems[displayItems.length - 1], index: value.length - 1 });
      return;
    }

    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      event.preventDefault();
      commitDraft();
    }
  }

  return (
    <div
      className={[
        "address-field",
        "multi-address-field",
        `address-field-${size}`,
        `iso-state-${inputTone}`,
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
          "multi-address-input-shell",
          summary.isValid ? "multi-address-input-valid" : "multi-address-input-invalid",
        ].join(" ")}
        onClick={handleShellClick}
        onPaste={handlePaste}
      >
        {displayItems.map((item) => (
          <AddressChip
            duplicate={item.isDuplicate}
            key={`${item.rawInput}-${item.index}`}
            message={
              item.isDuplicate
                ? "This address already appears in the list."
                : item.validation.message
            }
            removeLabel={`Remove ${item.rawInput}`}
            size={size}
            status={item.validation.status}
            value={item.validation.normalizedAddress ?? item.rawInput}
            onRemove={disabled ? undefined : () => removeItem(item)}
          />
        ))}
        <input
          aria-describedby={summaryId}
          autoComplete={autoComplete}
          className="multi-address-input"
          disabled={disabled}
          id={inputId}
          ref={inputRef}
          placeholder={displayItems.length > 0 ? "" : placeholder}
          spellCheck={false}
          type="text"
          value={draftValue}
          onBlur={handleBlur}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </div>
      <span className="address-input-feedback" id={summaryId}>
        {showFeedback ? error ?? formatSummary(summary) : ""}
      </span>
    </div>
  );
}

function summarizeAddressItems({
  duplicateCount,
  items,
  max,
  min,
  removedDuplicateCount,
  required,
}: {
  readonly duplicateCount: number;
  readonly items: readonly ParsedAddressListItem[];
  readonly max?: number;
  readonly min?: number;
  readonly removedDuplicateCount: number;
  readonly required: boolean;
}): MultiAddressValidationSummary {
  const normalizedAddresses = items
    .map((item) => item.validation.normalizedAddress)
    .filter((address): address is Address => address !== undefined);
  const totalCount = items.length;
  const validCount = normalizedAddresses.length;
  const invalidCount = items.filter((item) => !item.validation.isValid).length;
  const messages: string[] = [];

  if (required && validCount === 0) {
    messages.push("At least one address is required.");
  }

  if (min !== undefined && validCount < min) {
    messages.push(`Add at least ${min} valid ${pluralize("address", min)}.`);
  }

  if (max !== undefined && validCount > max) {
    messages.push(`Use at most ${max} valid ${pluralize("address", max)}.`);
  }

  if (invalidCount > 0) {
    messages.push(`${invalidCount} invalid ${pluralize("item", invalidCount)}.`);
  }

  if (duplicateCount > 0) {
    messages.push(`${duplicateCount} duplicate ${pluralize("address", duplicateCount)}.`);
  }

  if (removedDuplicateCount > 0) {
    messages.push(
      `${removedDuplicateCount} duplicate ${pluralize(
        "address",
        removedDuplicateCount,
      )} removed.`,
    );
  }

  return {
    duplicateCount,
    invalidCount,
    isValid: messages.length === 0,
    messages,
    normalizedAddresses,
    removedDuplicateCount,
    totalCount,
    validCount,
  };
}

function formatSummary(summary: MultiAddressValidationSummary): string {
  if (summary.messages.length > 0) {
    return summary.messages.join(" ");
  }

  if (summary.validCount === 0) {
    return "Enter one or more addresses.";
  }

  return `${summary.validCount} valid ${pluralize(
    "address",
    summary.validCount,
  )}.`;
}

function pluralize(value: string, count: number): string {
  return count === 1 ? value : `${value}s`;
}

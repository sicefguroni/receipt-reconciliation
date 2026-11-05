"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = { value: string; label: string; disabled?: boolean };

export function Select({
  name,
  label,
  defaultValue = "",
  options,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: readonly Option[];
  required?: boolean;
}) {
  const id = useId();
  const [enhanced, setEnhanced] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 });
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const selected = options.find((option) => option.value === value);

  useEffect(() => setEnhanced(true), []);

  useEffect(() => {
    const form = native.current?.form;
    const reset = () => {
      setValue(defaultValue);
      setOpen(false);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const maxHeight = Math.min(320, Math.max(below, above));
      setPosition({
        top: below >= Math.min(320, above) ? rect.bottom + 6 : rect.top - maxHeight - 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: Math.min(rect.width, window.innerWidth - 16),
        maxHeight,
      });
    };
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !menu.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    place();
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (open)
      menu.current
        ?.querySelectorAll<HTMLElement>('[role="option"]')
        [active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    const index = options.findIndex((option) => option.value === value && !option.disabled);
    setActive(index >= 0 ? index : options.findIndex((option) => !option.disabled));
    setOpen(true);
  };

  const choose = (option: Option) => {
    if (option.disabled) return;
    setValue(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <span className="select-control">
      {/* Retain native form submission, reset and required-field validation. */}
      <select
        ref={native}
        className={enhanced ? "sr-only" : undefined}
        tabIndex={enhanced ? -1 : undefined}
        aria-hidden={enhanced || undefined}
        aria-label={label}
        name={name}
        value={value}
        required={required}
        onChange={(event) => setValue(event.target.value)}
        onInvalid={(event) => {
          if (!enhanced) return;
          event.preventDefault();
          show();
          trigger.current?.focus();
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {enhanced ? (
        <button
          ref={trigger}
          type="button"
          className="select-trigger"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-haspopup="listbox"
          aria-required={required}
          aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
          onClick={() => (open ? setOpen(false) : show())}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            } else if (["Enter", " "].includes(event.key)) {
              event.preventDefault();
              if (open && options[active]) choose(options[active]);
              else show();
            } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              if (!open) {
                show();
                return;
              }
              const enabled = options.flatMap((option, index) => (option.disabled ? [] : [index]));
              const index = enabled.indexOf(active);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? enabled.length - 1
                    : (index + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) %
                      enabled.length;
              if (enabled[next] !== undefined) setActive(enabled[next]);
            } else if (
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              event.preventDefault();
              const now = Date.now();
              search.current = {
                text:
                  (now - search.current.time < 700 ? search.current.text : "") +
                  event.key.toLowerCase(),
                time: now,
              };
              const index = options.findIndex(
                (option) =>
                  !option.disabled && option.label.toLowerCase().startsWith(search.current.text),
              );
              if (!open) show();
              if (index >= 0) setActive(index);
            }
          }}
        >
          <span className={value ? undefined : "muted"}>
            {selected?.label ?? "Choose an option"}
          </span>
          <ChevronDown size={17} aria-hidden="true" />
        </button>
      ) : null}
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={label}
            className="select-menu"
            style={position}
          >
            {options.map((option, index) => (
              <button
                type="button"
                tabIndex={-1}
                disabled={option.disabled}
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                className={`select-option${active === index ? " focused" : ""}`}
                onPointerDown={(event) => event.preventDefault()}
                onPointerMove={() => {
                  if (!option.disabled) setActive(index);
                }}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === value ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}

export const PAYMENT_OPTIONS = [
  { value: "company_card", label: "Company card" },
  { value: "personal_card", label: "Personal card" },
  { value: "bank", label: "Bank account" },
  { value: "unknown", label: "Not known yet" },
];

"use client";

import { Check, ChevronDown, LoaderCircle, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { PEOPLE } from "@/config/people";
import { switchActor } from "./actions";

function initials(label: string): string {
  if (label.startsWith("Accounting")) return "AU";
  return label
    .split(" ")
    .map((word) => word[0])
    .join("");
}

function ActorTrigger({
  open,
  label,
  onClick,
}: {
  open: boolean;
  label: string;
  onClick: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      className="actor-trigger"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls="actor-options"
      onClick={onClick}
      disabled={pending}
    >
      <span className="actor-avatar">{initials(label)}</span>
      <span className="actor-current">
        <small>{pending ? "Switching…" : "Acting as"}</small>
        <strong>{label}</strong>
      </span>
      {pending ? (
        <LoaderCircle className="actor-loader" aria-hidden="true" size={17} />
      ) : (
        <ChevronDown className="actor-chevron" aria-hidden="true" size={17} />
      )}
    </button>
  );
}

export function ActorSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = PEOPLE.find((person) => person.id === current) ?? PEOPLE[0];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    });
  }, [open]);

  const choose = (id: string) => {
    if (inputRef.current) inputRef.current.value = id;
    setOpen(false);
    rootRef.current?.requestSubmit();
  };

  const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const options = [...(rootRef.current?.querySelectorAll<HTMLElement>(".actor-option") ?? [])];
    const currentIndex = options.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      rootRef.current?.querySelector<HTMLElement>(".actor-trigger")?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1) % options.length
            : (currentIndex - 1 + options.length) % options.length;
    options[nextIndex]?.focus();
  };

  return (
    <form ref={rootRef} action={switchActor} className="actor">
      <input ref={inputRef} type="hidden" name="actor" defaultValue={selected.id} />
      <ActorTrigger open={open} label={selected.label} onClick={() => setOpen((value) => !value)} />
      {open ? (
        <div
          id="actor-options"
          className="actor-menu"
          role="listbox"
          aria-label="Choose who is acting"
          onKeyDown={moveFocus}
        >
          <div className="actor-menu-head">
            <span className="actor-menu-icon">
              <UserRound aria-hidden="true" size={16} />
            </span>
            <span>
              <strong>Switch workspace role</strong>
              <small>Approvals follow the selected person</small>
            </span>
          </div>
          <div className="actor-option-list">
            {PEOPLE.map((person) => {
              const isSelected = person.id === selected.id;
              return (
                <button
                  type="button"
                  key={person.id}
                  className="actor-option"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(person.id)}
                >
                  <span className="actor-avatar">{initials(person.label)}</span>
                  <span>
                    <strong>{person.label}</strong>
                    <small>
                      {person.id === "accounts" ? "Reviewer · can approve" : "Submitter"}
                    </small>
                  </span>
                  {isSelected ? (
                    <Check className="actor-check" aria-hidden="true" size={17} />
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="actor-menu-note">Demo role switcher · no real sign-in</p>
        </div>
      ) : null}
    </form>
  );
}

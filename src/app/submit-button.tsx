"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

// Day 4 (C1): "it feels hanging when interacting". Every action is a plain server form; this
// is the one piece of client code. While its form is submitting, the pressed button says what
// is happening and every button in that form is disabled, so a second click cannot submit
// again. With JavaScript off it is an ordinary submit button.

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string };

export function SubmitButton({ children, pendingText = "Saving…", disabled, ...props }: Props) {
  const { pending, data } = useFormStatus();
  const name = typeof props.name === "string" ? props.name : undefined;
  // Several buttons can share a form (one per action): only the pressed one changes its text.
  const pressed =
    pending && (name === undefined || props.value === undefined || data?.get(name) === props.value);
  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pressed || undefined}
    >
      {pressed ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

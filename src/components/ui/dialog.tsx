"use client";

import { XIcon } from "@phosphor-icons/react/ssr";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";

import { Button } from "@/src/components/ui/button";
import { FormMessage } from "@/src/components/ui/feedback";
import { SubmitButton } from "@/src/components/ui/submit-button";
import { emptyActionState, type ActionState } from "@/src/lib/forms";

type Trigger = Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
  label: ReactNode;
};

/**
 * Native <dialog> opened with showModal(): the browser supplies the focus trap,
 * Escape to close, the inert background, and focus restoration to the trigger.
 * Below `sm` it docks to the bottom edge as a sheet. Scroll locking is the
 * `html:has(dialog[open])` rule in globals.css.
 */
export function Dialog({
  trigger,
  title,
  description,
  children,
  dialogRef,
}: {
  trigger: Trigger;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  dialogRef?: React.RefObject<HTMLDialogElement | null>;
}) {
  const ownRef = useRef<HTMLDialogElement>(null);
  const ref = dialogRef ?? ownRef;
  const titleId = useId();
  const descriptionId = useId();
  const { label, ...triggerProps } = trigger;

  return (
    <>
      <Button {...triggerProps} onClick={() => ref.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        // Clicking the backdrop targets the dialog element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="bg-surface text-ink backdrop:bg-brand-navy-shade/70 m-auto w-[min(32rem,calc(100%-2rem))] max-w-none p-0 shadow-(--shadow-overlay) max-sm:mb-0 max-sm:w-full max-sm:pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex max-h-[85dvh] flex-col gap-5 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 id={titleId} className="type-section">
                {title}
              </h2>
              {description ? (
                <div id={descriptionId} className="text-muted text-sm">
                  {description}
                </div>
              ) : null}
            </div>
            <form method="dialog">
              <button
                aria-label="Close"
                className="text-muted hover:text-ink-strong -mt-2 -mr-2 grid size-11 place-items-center"
              >
                <XIcon aria-hidden weight="bold" className="size-5" />
              </button>
            </form>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}

/**
 * A dialog wrapping one server action. It closes when the server reports
 * success and otherwise keeps the form, its values, and the error on screen.
 */
export function ActionDialog({
  trigger,
  title,
  description,
  action,
  hidden = {},
  submitLabel,
  submitVariant = "primary",
  pendingLabel,
  children,
}: {
  trigger: Trigger;
  title: string;
  description?: ReactNode;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  submitLabel: string;
  submitVariant?: "primary" | "critical";
  pendingLabel?: string;
  /** A function receives the last result, to keep typed values after an error. */
  children?: ReactNode | ((state: ActionState) => ReactNode);
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(action, emptyActionState);

  useEffect(() => {
    if (state.done) ref.current?.close();
  }, [state.done]);

  return (
    <Dialog
      trigger={trigger}
      title={title}
      description={description}
      dialogRef={ref}
    >
      <form action={formAction} className="flex flex-col gap-5">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {typeof children === "function" ? children(state) : children}
        <FormMessage error={state.error} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => ref.current?.close()}
            className="max-sm:w-full"
          >
            Cancel
          </Button>
          <SubmitButton
            variant={submitVariant}
            pendingLabel={pendingLabel}
            className="max-sm:w-full"
          >
            {submitLabel}
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

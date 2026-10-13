import { useEffect, useRef, type ReactNode } from "react";

import { XIcon } from "./Icons";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md";
};

// Wrapper around the native <dialog> element.
// The browser handles focus trapping, the Escape key and the backdrop.
export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = "md",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();

      // Start keyboard users in the first form field, if there is one
      dialog
        .querySelector<HTMLElement>(".modal-body input, .modal-body select")
        ?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal-${size}`}
      aria-labelledby="modal-title"
      onClose={onClose}
      onCancel={(event) => {
        // Let React state drive closing so the form resets properly
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicking the backdrop (outside the panel) closes the dialog
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="modal-panel">
          <div className="modal-header">
            <div>
              <h2 id="modal-title">{title}</h2>
              {description && (
                <p className="modal-description">{description}</p>
              )}
            </div>

            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Close"
            >
              <XIcon size={18} />
            </button>
          </div>

          {children}
        </div>
      )}
    </dialog>
  );
}

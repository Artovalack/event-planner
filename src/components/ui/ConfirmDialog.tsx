'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type ConfirmDialogProps = {
    title: string;
    description: ReactNode;
    confirmLabel: string;
    error?: string | null;
    onConfirm: () => Promise<boolean | void>;
    onClose: () => void;
};

export default function ConfirmDialog({
    title,
    description,
    confirmLabel,
    error,
    onConfirm,
    onClose,
}: ConfirmDialogProps) {
    const [busy, setBusy] = useState(false);
    const [unexpectedError, setUnexpectedError] = useState<string | null>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);
    const busyRef = useRef(false);
    const onCloseRef = useRef(onClose);
    busyRef.current = busy;
    onCloseRef.current = onClose;

    useEffect(() => {
        previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        cancelButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busyRef.current) {
                onCloseRef.current();
            } else if (event.key === 'Tab') {
                const firstButton = cancelButtonRef.current;
                const lastButton = confirmButtonRef.current;
                if (!firstButton || !lastButton) return;
                if (event.shiftKey && document.activeElement === firstButton) {
                    event.preventDefault();
                    lastButton.focus();
                } else if (!event.shiftKey && document.activeElement === lastButton) {
                    event.preventDefault();
                    firstButton.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocusedRef.current?.focus();
        };
    }, []);

    const confirm = async () => {
        if (busy) return;
        setBusy(true);
        setUnexpectedError(null);
        try {
            const completed = await onConfirm();
            if (completed !== false) onCloseRef.current();
        } catch (caughtError) {
            setUnexpectedError(caughtError instanceof Error ? caughtError.message : 'Unable to complete this action.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="confirm-dialog-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !busy) onClose();
            }}
        >
            <section
                className="confirm-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-description"
            >
                <div className="confirm-dialog-icon"><AlertTriangle size={22} aria-hidden="true" /></div>
                <h2 id="confirm-dialog-title">{title}</h2>
                <div className="confirm-dialog-description" id="confirm-dialog-description">{description}</div>
                {(error || unexpectedError) && <p className="confirm-dialog-error" role="alert">{error || unexpectedError}</p>}
                <div className="confirm-dialog-actions">
                    <button
                        ref={cancelButtonRef}
                        className="secondary-button"
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                    >
                        Cancel
                    </button>
                    <button
                        ref={confirmButtonRef}
                        className="confirm-dialog-confirm"
                        type="button"
                        onClick={() => void confirm()}
                        disabled={busy}
                    >
                        {busy ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </section>
        </div>
    );
}

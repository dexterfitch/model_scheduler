/**
 * Confirmation and message windows for the whole app, used instead of the browser's
 * own pop-ups so they can be styled, read by screen readers and tested.
 */

import React, { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const DialogContext = createContext(null);

/** Holds the one open window and offers confirm and notify to every page. */
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState('');
  const resolver = useRef(null);
  const titleId = useId();

  /** Opens a window and resolves with the answer when it closes. */
  const open = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setNote('');
    setDialog(options);
  }), []);

  /** Closes the window with the given answer. */
  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  };

  /**
   * What pages call: confirm asks a yes-or-no question (true if confirmed, or { note } when
   * it was asked with a noteLabel, offering an optional note); notify shows a message with
   * an OK button.
   */
  const value = useMemo(() => ({
    confirm: (options) => open({ kind: 'confirm', ...options }),
    notify: (options) => open({ kind: 'notify', ...(typeof options === 'string' ? { message: options } : options) }),
  }), [open]);

  const isConfirm = dialog?.kind === 'confirm';

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal show={!!dialog} onHide={() => close(false)} centered aria-labelledby={titleId}>
        {dialog && (
          <>
            <Modal.Header closeButton>
              <Modal.Title id={titleId} as="h2" className="h5">
                {dialog.title || (isConfirm ? 'Are you sure?' : 'Notice')}
              </Modal.Title>
            </Modal.Header>
            {(dialog.message || dialog.noteLabel) && (
              <Modal.Body>
                {dialog.message}
                {dialog.noteLabel && (
                  <Form.Group controlId="dialog-note" className={dialog.message ? 'mt-3' : ''}>
                    <Form.Label>{dialog.noteLabel}</Form.Label>
                    <Form.Control as="textarea" rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
                  </Form.Group>
                )}
              </Modal.Body>
            )}
            <Modal.Footer>
              {isConfirm ? (
                <>
                  <Button variant="outline-secondary" onClick={() => close(false)}>
                    {dialog.cancelLabel || 'Go Back'}
                  </Button>
                  <Button variant={dialog.danger ? 'danger' : 'primary'} onClick={() => close(dialog.noteLabel ? { note: note.trim() } : true)}>
                    {dialog.confirmLabel || 'Confirm'}
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={() => close(true)}>OK</Button>
              )}
            </Modal.Footer>
          </>
        )}
      </Modal>
    </DialogContext.Provider>
  );
}

/** The confirm and notify functions, for any page inside DialogProvider. */
export const useDialog = () => {
  const dialogs = useContext(DialogContext);
  if (!dialogs) throw new Error('useDialog must be used inside <DialogProvider>');
  return dialogs;
};

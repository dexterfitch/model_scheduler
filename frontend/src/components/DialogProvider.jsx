import React, { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

// App-wide replacement for the browser's confirm() and alert() popups:
// styled, accessible windows with clearly labelled buttons.
//
//   const { confirm, notify } = useDialog();
//   if (!(await confirm({ title: 'Cancel this class?', message: '…', confirmLabel: 'Cancel Class', danger: true }))) return;
//   await notify({ title: "Couldn't save", message: 'The server said why.' });
const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);
  const titleId = useId();

  const open = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setDialog(options);
  }), []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  };

  const value = useMemo(() => ({
    // Resolves true if they confirm, false if they go back or close the window
    confirm: (options) => open({ kind: 'confirm', ...options }),
    // Resolves once they close the message
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
            {dialog.message && <Modal.Body>{dialog.message}</Modal.Body>}
            <Modal.Footer>
              {isConfirm ? (
                <>
                  <Button variant="outline-secondary" onClick={() => close(false)}>
                    {dialog.cancelLabel || 'Go Back'}
                  </Button>
                  <Button variant={dialog.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
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

export const useDialog = () => {
  const dialogs = useContext(DialogContext);
  if (!dialogs) throw new Error('useDialog must be used inside <DialogProvider>');
  return dialogs;
};
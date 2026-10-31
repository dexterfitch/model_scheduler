/**
 * A success message pinned to the bottom of the screen, so it's seen even when the
 * page is scrolled down (often the case on phones). It stays until it's closed.
 */

import React from 'react';
import { Alert } from 'react-bootstrap';
import styles from './StatusToast.module.css';

/**
 * The message, if any, in a status area that's always on the page so screen readers announce it.
 */
function StatusToast({ message, onClose, children }) {
  return (
    <div role="status" className={styles.toast}>
      {message && (
        <Alert variant="success" dismissible onClose={onClose} className="shadow mb-0">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span>{message}</span>
            {children}
          </div>
        </Alert>
      )}
    </div>
  );
}

export default StatusToast;

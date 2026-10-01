import React from 'react';
import Modal from './Modal';

export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm action', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false }) {
  return <Modal open={open} onClose={busy ? undefined : onClose} title={title} className="admin-ui-confirm-dialog" footer={<><button type="button" className="admin-secondary-button" onClick={onClose} disabled={busy}>{cancelLabel}</button><button type="button" className={danger ? 'admin-danger-button' : 'admin-primary-button'} onClick={onConfirm} disabled={busy}>{busy ? 'Saving...' : confirmLabel}</button></>}>
    <p>{message}</p>
  </Modal>;
}
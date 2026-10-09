import React from 'react';
import Modal from './Modal';
import { useTranslation } from '../../../contexts/UiContext';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, cancelLabel, danger = false, busy = false }) {
  const { t } = useTranslation();
  return <Modal open={open} onClose={busy ? undefined : onClose} title={title || t('adminUi.confirmAction')} className="admin-ui-confirm-dialog" footer={<><button type="button" className="admin-secondary-button" onClick={onClose} disabled={busy}>{cancelLabel || t('adminUi.cancel')}</button><button type="button" className={danger ? 'admin-danger-button' : 'admin-primary-button'} onClick={onConfirm} disabled={busy}>{busy ? t('adminUi.saving') : confirmLabel || t('adminUi.confirm')}</button></>}>
    <p>{message}</p>
  </Modal>;
}
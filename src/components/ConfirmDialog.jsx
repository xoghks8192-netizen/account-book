export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = '삭제', busy = false, tone = 'delete' }) {
  return (
    <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label={message} onClick={(e) => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button disabled={busy} className="confirm-btn cancel" onClick={onCancel}>취소</button>
          <button disabled={busy} className={`confirm-btn ${tone}`} onClick={onConfirm}>{busy ? '처리 중…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = '삭제' }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>취소</button>
          <button className="confirm-btn delete" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

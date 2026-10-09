export default function EditActions({ onSave, saving = false }) {
  return <div className="edit-actions">
    <button type="button" className="edit-action primary" onClick={onSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
    <button type="button" className="edit-action secondary" data-modal-dismiss disabled={saving}>취소</button>
  </div>
}

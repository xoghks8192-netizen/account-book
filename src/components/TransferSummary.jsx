import Modal from './Modal'
import { useMoney } from '../lib/privacy'
import { summarizeResults } from '../lib/ledgerView'
import { formatLedgerDate } from '../lib/displayText'

export default function TransferSummary({ rows, owner, monthLabel, onClose }) {
  const money = useMoney()
  const transfers = rows.filter(t => t.transfer_id || t.category === '배우자 이체')
  const summary = summarizeResults(transfers)
  return <Modal title={`${owner} · 이체 내역`} onClose={onClose}>
    <p className="view-note">{monthLabel} · 부부 사이에서 이동한 돈만 따로 보여줘요. 기존 월 합계는 바꾸지 않습니다.</p>
    <div className="transfer-totals"><div>보낸 이체<strong>−{money(summary.sent)}원</strong></div><div>받은 이체<strong>+{money(summary.received)}원</strong></div></div>
    {['expense','income'].map(type => <section key={type} className="transfer-section">
      <h4>{type === 'expense' ? '보낸 내역' : '받은 내역'}</h4>
      {transfers.filter(t => t.type === type).length === 0 && <p className="view-note">해당 내역이 없어요.</p>}
      {transfers.filter(t => t.type === type).map(t => <div key={t.id} className="transfer-summary-row">
        <span>{formatLedgerDate(t.date, true)}<small>{t.transfer_id ? '연결된 배우자 이체' : '기존 이체 · 연결 정보 없음'}</small></span>
        <strong>{type === 'income' ? '+' : '−'}{money(t.amount)}원</strong>
      </div>)}
    </section>)}
    <p className="view-note">‘배우자 이체’로 기록된 내역 기준이며, 연결 정보가 없는 과거 내역은 상대방 기록을 추정해서 채우지 않습니다.</p>
  </Modal>
}

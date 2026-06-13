function formatAmount(n) {
  return n.toLocaleString('ko-KR')
}

export default function TransactionList({ transactions, onDelete }) {
  if (transactions.length === 0) {
    return (
      <div className="list">
        <div className="empty">이번 달 내역이 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="list">
      <h3>내역</h3>
      {transactions.map((tx) => (
        <div className="tx-item" key={tx.id}>
          <div className="tx-info">
            <span className="category">{tx.category}</span>
            <span className="meta">
              {tx.date}
              {tx.owner ? ` · ${tx.owner}` : ''}
              {tx.memo ? ` · ${tx.memo}` : ''}
            </span>
          </div>
          <div className="tx-amount">
            <span className={`amount ${tx.type}`}>
              {tx.type === 'income' ? '+' : '-'}
              {formatAmount(tx.amount)}원
            </span>
            <button
              onClick={() => {
                if (window.confirm('이 내역을 삭제할까요?')) onDelete(tx.id)
              }}
              title="삭제"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

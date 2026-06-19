import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { defaultLiquidity } from '../assetMeta'
import AssetForm from './AssetForm'
import AssetItem from './AssetItem'
import AssetChart from './AssetChart'
import Collapsible from './Collapsible'
import AssetForecast from './AssetForecast'
import NetWorthChart from './NetWorthChart'
import Modal from './Modal'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function AssetsPage({ currentUser, owners, householdId, categories, onAddCategory, onRemoveCategory, onMoveCategory, onToast }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ownerFilter, setOwnerFilter] = useState('전체')
  const [summaryModal, setSummaryModal] = useState(null)
  const [lastMonthTotal, setLastMonthTotal] = useState(null)
  const [reordering, setReordering] = useState(false)
  const [assetOrder, setAssetOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`asset_order_${householdId}`) || '[]') } catch { return [] }
  })

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('household_id', householdId)
        .order('category', { ascending: true })
        .order('id', { ascending: true })
      if (cancelled) return
      if (error) setError(error.message)
      else setAssets(data)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [householdId])

  async function handleAdd(asset) {
    const { data, error } = await supabase
      .from('assets')
      .insert({ ...asset, household_id: householdId })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    setAssets((prev) => [...prev, data])
    onToast?.('✓ 자산이 추가되었습니다')
  }

  async function handleUpdate(id, fields) {
    const { data, error } = await supabase
      .from('assets')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    setAssets((prev) => prev.map((a) => (a.id === id ? data : a)))
    onToast?.('✓ 자산이 수정되었습니다')
  }

  async function handleDelete(id) {
    const { data, error } = await supabase
      .from('assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    setAssets((prev) => prev.map((a) => (a.id === id ? data : a)))
    onToast?.('🗑 자산이 삭제되었습니다')
  }

  async function handleRestore(id) {
    if (!window.confirm('이 자산을 복구할까요?')) return
    const { data, error } = await supabase
      .from('assets')
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single()
    if (error) {
      setError(error.message)
      return
    }
    setAssets((prev) => prev.map((a) => (a.id === id ? data : a)))
    onToast?.('✓ 자산이 복구되었습니다')
  }

  async function handlePermanentDelete(id) {
    if (!window.confirm('이 자산을 완전히 삭제할까요? 복구할 수 없습니다.')) return
    const { error } = await supabase.from('assets').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setAssets((prev) => prev.filter((a) => a.id !== id))
    onToast?.('🗑 자산이 영구 삭제되었습니다')
  }

  const activeAssets = assets.filter((a) => !a.deleted_at)
  const deletedAssets = assets.filter((a) => a.deleted_at)

  // 비상금: 본인 소유 또는 공동만 표시, 상대방 비상금은 완전히 제외
  const myAssets = activeAssets.filter(
    (a) => a.category !== '비상금' || a.owner === currentUser || a.owner === '공동',
  )
  const myEmergencyAssets = myAssets.filter((a) => a.category === '비상금')
  // 총자산/유동성 계산에서 비상금 제외 (역산 방지)
  const nonEmergencyAssets = myAssets.filter((a) => a.category !== '비상금')
  const visible = ownerFilter === '전체' ? nonEmergencyAssets : nonEmergencyAssets.filter((a) => a.owner === ownerFilter)
  const total = visible.reduce((s, a) => s + Number(a.amount), 0)
  const emergencyTotal = myEmergencyAssets
    .filter((a) => ownerFilter === '전체' || a.owner === ownerFilter)
    .reduce((s, a) => s + Number(a.amount), 0)

  function moveAsset(id, direction, groupItems) {
    const ids = groupItems.map((a) => a.id)
    const idx = ids.indexOf(id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === ids.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const newIds = [...ids]
    ;[newIds[idx], newIds[swapIdx]] = [newIds[swapIdx], newIds[idx]]
    const allIds = assets.filter((a) => !a.deleted_at).map((a) => a.id)
    const orderMap = new Map(assetOrder.map((id, i) => [id, i]))
    // Rebuild full order: replace positions for this group
    const newOrder = allIds.map((aid) => {
      const groupPos = newIds.indexOf(aid)
      return groupPos !== -1 ? aid : aid
    })
    // Just store the group's new order, merged with existing
    const merged = [...assetOrder.filter((oid) => !ids.includes(oid)), ...newIds]
    setAssetOrder(merged)
    localStorage.setItem(`asset_order_${householdId}`, JSON.stringify(merged))
  }

  function sortByOrder(items) {
    if (assetOrder.length === 0) return items
    return [...items].sort((a, b) => {
      const ai = assetOrder.indexOf(a.id)
      const bi = assetOrder.indexOf(b.id)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }

  function groupByCategory(items) {
    return items.reduce((acc, a) => {
      acc[a.category] = acc[a.category] || []
      acc[a.category].push(a)
      return acc
    }, {})
  }

  const liquidAssets = visible.filter((a) => (a.liquidity ?? defaultLiquidity(a.category)) === '유동')
  const nonLiquidAssets = visible.filter((a) => (a.liquidity ?? defaultLiquidity(a.category)) === '비유동')
  const liquidTotal = liquidAssets.reduce((s, a) => s + Number(a.amount), 0)
  const nonLiquidTotal = nonLiquidAssets.reduce((s, a) => s + Number(a.amount), 0)

  const liquidGrouped = groupByCategory(liquidAssets)
  const nonLiquidGrouped = groupByCategory(nonLiquidAssets)

  const chartData = Object.entries(groupByCategory(visible))
    .map(([category, items]) => [category, items.reduce((s, a) => s + Number(a.amount), 0)])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])

  const householdTotal = nonEmergencyAssets.reduce((s, a) => s + Number(a.amount), 0)
  const householdLiquidTotal = nonEmergencyAssets
    .filter((a) => (a.liquidity ?? defaultLiquidity(a.category)) === '유동')
    .reduce((s, a) => s + Number(a.amount), 0)
  const householdNonLiquidTotal = nonEmergencyAssets
    .filter((a) => (a.liquidity ?? defaultLiquidity(a.category)) === '비유동')
    .reduce((s, a) => s + Number(a.amount), 0)

  useEffect(() => {
    if (!householdId || loading) return
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('net_worth_snapshots')
      .upsert(
        {
          household_id: householdId,
          snapshot_date: today,
          total: householdTotal,
          liquid_total: householdLiquidTotal,
          non_liquid_total: householdNonLiquidTotal,
        },
        { onConflict: 'household_id,snapshot_date' },
      )
  }, [householdId, loading, householdTotal, householdLiquidTotal, householdNonLiquidTotal])

  useEffect(() => {
    if (!householdId) return
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    supabase
      .from('net_worth_snapshots')
      .select('total, snapshot_date')
      .eq('household_id', householdId)
      .lt('snapshot_date', firstOfMonth)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setLastMonthTotal(data.total) })
  }, [householdId])

  const summaryModalConfigs = {
    총자산: { title: '총 자산', items: visible, total },
    비상금: {
      title: '비상금',
      items: myEmergencyAssets.filter((a) => ownerFilter === '전체' || a.owner === ownerFilter),
      total: emergencyTotal,
    },
    유동자산: { title: '💧 유동자산', items: liquidAssets, total: liquidTotal },
    비유동자산: { title: '🔒 비유동자산', items: nonLiquidAssets, total: nonLiquidTotal },
  }

  const activeModal = summaryModal ? summaryModalConfigs[summaryModal] : null

  return (
    <div>
      <div className="owner-tabs">
        {['전체', ...owners].map((o) => (
          <button
            key={o}
            className={ownerFilter === o ? 'active' : ''}
            onClick={() => setOwnerFilter(o)}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="summary">
        <div className="summary-item balance clickable" onClick={() => setSummaryModal('총자산')}>
          <div className="label">총 자산</div>
          <div className="value">{formatAmount(total)}</div>
          {lastMonthTotal !== null && (
            <div style={{ fontSize: 11, fontWeight: 700, color: householdTotal >= lastMonthTotal ? '#ff5c5c' : '#6cb6ff', marginTop: 2 }}>
              {householdTotal >= lastMonthTotal ? '+' : ''}{formatAmount(householdTotal - lastMonthTotal)}원
            </div>
          )}
        </div>
        <div className="summary-item income clickable" onClick={() => setSummaryModal('비상금')}>
          <div className="label">비상금</div>
          <div className="value">{formatAmount(emergencyTotal)}</div>
        </div>
      </div>

      <div className="summary">
        <div className="summary-item income clickable" onClick={() => setSummaryModal('유동자산')}>
          <div className="label">유동자산</div>
          <div className="value">{formatAmount(liquidTotal)}</div>
        </div>
        <div className="summary-item expense clickable" onClick={() => setSummaryModal('비유동자산')}>
          <div className="label">비유동자산</div>
          <div className="value">{formatAmount(nonLiquidTotal)}</div>
        </div>
      </div>

      {activeModal && (
        <Modal title={activeModal.title} onClose={() => setSummaryModal(null)}>
          {activeModal.items.length === 0 ? (
            <div className="empty-state">
            <div className="empty-state-icon">🌿</div>
            <div className="empty-state-title">아직 자산이 없어요</div>
            <div className="empty-state-desc">자산 항목 추가로 첫 번째 자산을 등록해볼까요?</div>
          </div>
          ) : (
            Object.entries(groupByCategory(activeModal.items)).map(([category, items]) => (
              <div key={category}>
                <div className="modal-section-title">
                  {category} · {formatAmount(items.reduce((s, a) => s + Number(a.amount), 0))}원
                </div>
                {items.map((a) => (
                  <div key={a.id} className="modal-row">
                    <span className="modal-row-name">
                      {a.name}
                      <span className="modal-row-meta">{a.owner}</span>
                    </span>
                    <span className="modal-row-amount">{formatAmount(a.amount)}원</span>
                  </div>
                ))}
              </div>
            ))
          )}
          <div className="modal-total-row">
            <span>합계</span>
            <span className="modal-row-amount">{formatAmount(activeModal.total)}원</span>
          </div>
        </Modal>
      )}

      <AssetChart data={chartData} total={total} />

      <NetWorthChart householdId={householdId} />

      {ownerFilter === '전체' || ownerFilter === '공동' || ownerFilter === currentUser ? (
        <Collapsible title="자산 항목 추가">
          <AssetForm key={ownerFilter} onAdd={handleAdd} owners={owners} categories={categories} onAddCategory={onAddCategory} onRemoveCategory={onRemoveCategory} onMoveCategory={onMoveCategory} defaultOwner={ownerFilter === '전체' ? owners[0] : ownerFilter} />
        </Collapsible>
      ) : null}

      {error && <div className="container" style={{ color: '#e0524c' }}>오류: {error}</div>}

      {loading ? (
        <div className="container">불러오는 중...</div>
      ) : visible.length === 0 ? (
        <div className="form">
          <div className="empty-state">
            <div className="empty-state-icon">🌿</div>
            <div className="empty-state-title">아직 자산이 없어요</div>
            <div className="empty-state-desc">자산 항목 추가로 첫 번째 자산을 등록해볼까요?</div>
          </div>
        </div>
      ) : (
        <>
          {liquidAssets.length > 0 && (
            <Collapsible title={`💧 유동자산 · ${formatAmount(liquidTotal)}원`} headerExtra={<button type="button" className={`reorder-toggle-btn${reordering ? ' active' : ''}`} onClick={() => setReordering((v) => !v)}>{reordering ? '완료' : '⇅ 순서'}</button>}>
              {Object.entries(liquidGrouped).map(([category, items]) => {
                const sorted = sortByOrder(items)
                return (
                  <div key={category}>
                    <h3>
                      {category} · {formatAmount(items.reduce((s, a) => s + Number(a.amount), 0))}원
                    </h3>
                    {sorted.map((asset, idx) => reordering ? (
                      <div key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                          <button className="reorder-btn" onClick={() => moveAsset(asset.id, 'up', sorted)} disabled={idx === 0}>▲</button>
                          <button className="reorder-btn" onClick={() => moveAsset(asset.id, 'down', sorted)} disabled={idx === sorted.length - 1}>▼</button>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <AssetItem asset={asset} owners={owners} onUpdate={handleUpdate} onDelete={handleDelete} />
                        </div>
                      </div>
                    ) : (
                      <AssetItem key={asset.id} asset={asset} owners={owners} onUpdate={handleUpdate} onDelete={handleDelete} />
                    ))}
                  </div>
                )
              })}
            </Collapsible>
          )}

          {nonLiquidAssets.length > 0 && (
            <Collapsible title={`🔒 비유동자산 · ${formatAmount(nonLiquidTotal)}원`} headerExtra={<button type="button" className={`reorder-toggle-btn${reordering ? ' active' : ''}`} onClick={() => setReordering((v) => !v)}>{reordering ? '완료' : '⇅ 순서'}</button>}>
              {Object.entries(nonLiquidGrouped).map(([category, items]) => {
                const sorted = sortByOrder(items)
                return (
                  <div key={category}>
                    <h3>
                      {category} · {formatAmount(items.reduce((s, a) => s + Number(a.amount), 0))}원
                    </h3>
                    {sorted.map((asset, idx) => reordering ? (
                      <div key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                          <button className="reorder-btn" onClick={() => moveAsset(asset.id, 'up', sorted)} disabled={idx === 0}>▲</button>
                          <button className="reorder-btn" onClick={() => moveAsset(asset.id, 'down', sorted)} disabled={idx === sorted.length - 1}>▼</button>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <AssetItem asset={asset} owners={owners} onUpdate={handleUpdate} onDelete={handleDelete} />
                        </div>
                      </div>
                    ) : (
                      <AssetItem key={asset.id} asset={asset} owners={owners} onUpdate={handleUpdate} onDelete={handleDelete} />
                    ))}
                  </div>
                )
              })}
            </Collapsible>
          )}
        </>
      )}

      {!loading && deletedAssets.length > 0 && (
        <div className="list">
          <Collapsible title={`🗑 삭제된 자산 (${deletedAssets.length})`} className="section-collapsible">
            {deletedAssets.map((asset) => (
              <div key={asset.id} className="tx-item">
                <div className="tx-info">
                  <span className="category">{asset.name}</span>
                  <span className="meta">
                    {asset.category} · {asset.owner} · {formatAmount(asset.amount)}원
                  </span>
                </div>
                <div className="tx-amount" style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleRestore(asset.id)}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      background: '#fdeef3',
                      color: '#b88a9c',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: '"Jua", sans-serif',
                      padding: '6px 14px',
                      cursor: 'pointer',
                    }}
                  >
                    복구
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(asset.id)}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      background: '#ffe3e3',
                      color: '#e0524c',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: '"Jua", sans-serif',
                      padding: '6px 14px',
                      cursor: 'pointer',
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </Collapsible>
        </div>
      )}

      <AssetForecast
        total={total}
        liquidTotal={liquidTotal}
        nonLiquidTotal={nonLiquidTotal}
        chartData={chartData}
        householdId={householdId}
      />
    </div>
  )
}

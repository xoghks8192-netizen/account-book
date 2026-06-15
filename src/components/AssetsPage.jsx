import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { defaultLiquidity } from '../assetMeta'
import AssetForm from './AssetForm'
import AssetItem from './AssetItem'
import AssetChart from './AssetChart'
import Collapsible from './Collapsible'
import AssetForecast from './AssetForecast'
import NetWorthChart from './NetWorthChart'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function AssetsPage({ currentUser, owners, householdId, categories, onAddCategory, onRemoveCategory, onMoveCategory }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ownerFilter, setOwnerFilter] = useState('전체')

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
  }

  async function handlePermanentDelete(id) {
    if (!window.confirm('이 자산을 완전히 삭제할까요? 복구할 수 없습니다.')) return
    const { error } = await supabase.from('assets').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }

  const activeAssets = assets.filter((a) => !a.deleted_at)
  const deletedAssets = assets.filter((a) => a.deleted_at)

  const myAssets = activeAssets.filter(
    (a) => a.category !== '비상금' || a.owner === currentUser || a.owner === '공동',
  )
  const visible = ownerFilter === '전체' ? myAssets : myAssets.filter((a) => a.owner === ownerFilter)
  const total = visible.reduce((s, a) => s + Number(a.amount), 0)
  const emergencyTotal = myAssets
    .filter((a) => a.category === '비상금' && (ownerFilter === '전체' || a.owner === ownerFilter))
    .reduce((s, a) => s + Number(a.amount), 0)

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

  const householdTotal = myAssets.reduce((s, a) => s + Number(a.amount), 0)
  const householdLiquidTotal = myAssets
    .filter((a) => (a.liquidity ?? defaultLiquidity(a.category)) === '유동')
    .reduce((s, a) => s + Number(a.amount), 0)
  const householdNonLiquidTotal = myAssets
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

  return (
    <div>
      <div className="summary">
        <div className="summary-item balance">
          <div className="label">총 자산</div>
          <div className="value">{formatAmount(total)}</div>
        </div>
        <div className="summary-item income">
          <div className="label">비상금</div>
          <div className="value">{formatAmount(emergencyTotal)}</div>
        </div>
      </div>

      <div className="summary">
        <div className="summary-item income">
          <div className="label">유동자산</div>
          <div className="value">{formatAmount(liquidTotal)}</div>
        </div>
        <div className="summary-item expense">
          <div className="label">비유동자산</div>
          <div className="value">{formatAmount(nonLiquidTotal)}</div>
        </div>
      </div>

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

      <AssetChart data={chartData} total={total} />

      <NetWorthChart householdId={householdId} />

      {ownerFilter === '전체' || ownerFilter === '공동' || ownerFilter === currentUser ? (
        <Collapsible title="자산 항목 추가">
          <AssetForm onAdd={handleAdd} owners={owners} categories={categories} onAddCategory={onAddCategory} onRemoveCategory={onRemoveCategory} onMoveCategory={onMoveCategory} />
        </Collapsible>
      ) : null}

      {error && <div className="container" style={{ color: '#e0524c' }}>오류: {error}</div>}

      {loading ? (
        <div className="container">불러오는 중...</div>
      ) : visible.length === 0 ? (
        <div className="list">
          <div className="empty">자산 항목이 없습니다.</div>
        </div>
      ) : (
        <div className="list">
          {liquidAssets.length > 0 && (
            <Collapsible title={`💧 유동자산 · ${formatAmount(liquidTotal)}원`} className="section-collapsible">
              {Object.entries(liquidGrouped).map(([category, items]) => (
                <div key={category}>
                  <h3>
                    {category} · {formatAmount(items.reduce((s, a) => s + Number(a.amount), 0))}원
                  </h3>
                  {items.map((asset) => (
                    <AssetItem key={asset.id} asset={asset} owners={owners} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
              ))}
            </Collapsible>
          )}

          {nonLiquidAssets.length > 0 && (
            <Collapsible title={`🔒 비유동자산 · ${formatAmount(nonLiquidTotal)}원`} className="section-collapsible">
              {Object.entries(nonLiquidGrouped).map(([category, items]) => (
                <div key={category}>
                  <h3>
                    {category} · {formatAmount(items.reduce((s, a) => s + Number(a.amount), 0))}원
                  </h3>
                  {items.map((asset) => (
                    <AssetItem key={asset.id} asset={asset} owners={owners} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
              ))}
            </Collapsible>
          )}
        </div>
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

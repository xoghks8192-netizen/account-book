import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { OWNERS, defaultLiquidity } from '../assetMeta'
import AssetForm from './AssetForm'
import AssetItem from './AssetItem'
import AssetChart from './AssetChart'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function AssetsPage() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ownerFilter, setOwnerFilter] = useState('전체')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('assets')
        .select('*')
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
  }, [])

  async function handleAdd(asset) {
    const { data, error } = await supabase.from('assets').insert(asset).select().single()
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
    const { error } = await supabase.from('assets').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setAssets((prev) => prev.filter((a) => a.id !== id))
  }

  const visible = ownerFilter === '전체' ? assets : assets.filter((a) => a.owner === ownerFilter)
  const total = visible.reduce((s, a) => s + Number(a.amount), 0)
  const emergencyTotal = assets
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
        {['전체', ...OWNERS].map((o) => (
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

      <AssetForm onAdd={handleAdd} />

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
            <>
              <div className="section-title">💧 유동자산 · {formatAmount(liquidTotal)}원</div>
              {Object.entries(liquidGrouped).map(([category, items]) => (
                <div key={category}>
                  <h3>
                    {category} · {formatAmount(items.reduce((s, a) => s + Number(a.amount), 0))}원
                  </h3>
                  {items.map((asset) => (
                    <AssetItem key={asset.id} asset={asset} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
              ))}
            </>
          )}

          {nonLiquidAssets.length > 0 && (
            <>
              <div className="section-title">🔒 비유동자산 · {formatAmount(nonLiquidTotal)}원</div>
              {Object.entries(nonLiquidGrouped).map(([category, items]) => (
                <div key={category}>
                  <h3>
                    {category} · {formatAmount(items.reduce((s, a) => s + Number(a.amount), 0))}원
                  </h3>
                  {items.map((asset) => (
                    <AssetItem key={asset.id} asset={asset} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

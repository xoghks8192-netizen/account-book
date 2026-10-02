import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="container" role="alert">
        <section className="form" style={{ margin: '32px 0' }}>
          <h2 style={{ fontSize: 19 }}>화면을 불러오지 못했어요</h2>
          <p>일시적인 오류가 발생했어요. 다시 불러온 뒤 확인해주세요.</p>
          <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>
            저장된 내역은 삭제되지 않지만, 아직 저장하지 않은 입력은 사라질 수 있어요.
          </p>
          <button className="submit-btn" onClick={() => window.location.reload()}>
            다시 불러오기
          </button>
        </section>
      </main>
    )
  }
}

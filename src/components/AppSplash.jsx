export default function AppSplash() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-gradient)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 99999 }}>
      <div style={{ fontSize: 56, lineHeight: 1 }}>💜</div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 22, color: 'var(--balance-color)', letterSpacing: '0.02em' }}>우리 가계부</div>
      <div style={{ width: 40, height: 3, borderRadius: 99, background: 'var(--form-border)', overflow: 'hidden', marginTop: 8 }}>
        <div style={{ height: '100%', width: '100%', background: 'var(--active-gradient)', borderRadius: 99, animation: 'splashBar 1s ease-in-out infinite alternate' }} />
      </div>
      <style>{`@keyframes splashBar { from { transform: translateX(-100%) } to { transform: translateX(100%) } }`}</style>
    </div>
  )
}

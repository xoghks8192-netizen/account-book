export default function HeaderIcon({ name }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'calendar' && <><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-11 4h2m2 0h2m-6 3h2"/></>}
    {name === 'edit' && <><path d="m15 4 5 5M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></>}
    {name === 'delete' && <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></>}
    {name === 'refresh' && <><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 11-1l3 6M4 12l3 6a7 7 0 0 0 11-1"/></>}
    {name === 'chevron' && <path d="m6 9 6 6 6-6"/>}
    {name === 'moon' && <path d="M20.8 13.2A9 9 0 0 1 10.8 3.2 9 9 0 1 0 20.8 13.2Z" />}
    {name === 'sun' && <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></>}
    {name === 'settings' && <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="var(--form-bg)"/><circle cx="15" cy="17" r="2.5" fill="var(--form-bg)"/></>}
    {(name === 'eye' || name === 'eye-off') && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{name === 'eye-off' && <path d="m3 3 18 18"/>}</>}
  </svg>
}

'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body style={{ background: '#070908', color: '#fff', fontFamily: 'system-ui' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Algo deu errado</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem', textAlign: 'center' }}>
            {error.message || 'Ocorreu um erro inesperado.'}
          </p>
          <button
            onClick={reset}
            style={{
              background: '#f97316',
              color: '#070908',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.75rem 1.5rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}

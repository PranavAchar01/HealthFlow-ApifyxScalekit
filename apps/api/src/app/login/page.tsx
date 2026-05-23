"use client"

export default function LoginPage() {
  const handleLogin = async () => {
    const res = await fetch('/api/auth/login')
    const { authUrl } = await res.json()
    window.location.href = authUrl  // full navigation required for OAuth
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏥</div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
          HealthFlow
        </h1>
        <p style={{ margin: '0 0 32px', color: '#64748b', fontSize: '0.9rem' }}>
          Secure clinical access — sign in with your role credentials
        </p>

        <button
          onClick={handleLogin}
          style={{
            display: 'block',
            width: '100%',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            padding: '14px 24px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '1rem',
          }}
        >
          Sign in with ScaleKit
        </button>

        <div style={{ marginTop: '32px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0 0 12px' }}>
            Access is role-scoped. You will be routed to your clinical view automatically.
          </p>
          <div style={{ textAlign: 'left', fontSize: '0.78rem', color: '#64748b' }}>
            {[
              { name: 'Shanay', role: '911 Dispatcher' },
              { name: 'Nithin', role: 'Paramedic' },
              { name: 'Sahiel', role: 'Nurse' },
              { name: 'Pranav', role: 'Doctor' },
            ].map(u => (
              <div key={u.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontWeight: 500 }}>{u.name}</span>
                <span style={{ color: '#94a3b8' }}>{u.role}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', color: '#94a3b8' }}>Password: <code>HealthFlow2025!</code></div>
          </div>
        </div>
      </div>
    </div>
  )
}

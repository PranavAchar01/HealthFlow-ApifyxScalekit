
const ROLES = [
  {
    title: "911 Dispatcher",
    email: "shanaygaitonde@gmail.com",
    port: 3005,
    code: "DISPATCH",
    desc: "Receive emergency calls, dispatch paramedics",
  },
  {
    title: "Paramedic",
    email: "nithin.alaska@gmail.com",
    port: 3002,
    code: "FIELD",
    desc: "Field assessment, AI pipeline trigger",
  },
  {
    title: "Nurse",
    email: "sahielbose@gmail.com",
    port: 3004,
    code: "TRIAGE",
    desc: "Vitals entry, triage, doctor handoff",
  },
  {
    title: "Physician",
    email: "achar.pranav@gmail.com",
    port: 3003,
    code: "PHYSICIAN",
    desc: "AI diagnosis review, order approval",
  },
];

export default function Landing() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #fff; color: #0a0a0a; }
        body { font-family: system-ui, -apple-system, sans-serif; }
        a { text-decoration: none; color: inherit; }

        .mono { font-family: 'Courier New', Courier, monospace; }
        .serif { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 300; }

        .role-row { transition: background 0.12s; cursor: default; }
        .role-row:hover { background: #1565c0; }
        .role-row:hover .role-title { color: #fff; }
        .role-row:hover .role-desc { color: #bbcfff; }
        .role-row:hover .role-email { color: #d0e4ff; }
        .role-row:hover .role-port { color: #fff; }
        .role-row:hover .role-badge { border-color: #90caf9; color: #90caf9; }

        .sso-btn { transition: background 0.12s; width: 100%; border: none; cursor: pointer; font-family: system-ui, -apple-system, sans-serif; }
        .sso-btn:hover { background: #1565c0 !important; }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .caret { display: inline-block; width: 3px; height: 0.85em; background: #1976d2; vertical-align: middle; margin-left: 6px; animation: blink 1s step-end infinite; }
      `}</style>

      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>

        {/* Top accent */}
        <div style={{ height: 4, background: "#1976d2", flexShrink: 0 }} />

        {/* Header */}
        <header style={{
          flexShrink: 0,
          borderBottom: "1px solid #e0e0e0",
          padding: "0 2.5rem",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem" }}>
            <span className="mono" style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#0a0a0a" }}>HealthFlow</span>
            <span style={{ fontSize: "0.65rem", color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase" }}>Clinical Intelligence Platform</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: 7, height: 7, background: "#4caf50", display: "inline-block" }} />
            <span style={{ fontSize: "0.62rem", letterSpacing: "0.1em", color: "#aaa", textTransform: "uppercase" }}>All Systems Online</span>
          </div>
        </header>

        {/* Body: two columns */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

          {/* LEFT PANEL */}
          <div style={{
            width: "45%",
            borderRight: "1px solid #e0e0e0",
            display: "flex",
            flexDirection: "column",
            padding: "3rem 2.5rem",
            background: "#fff",
          }}>

            {/* Version tag */}
            <div className="mono" style={{ fontSize: "0.62rem", letterSpacing: "0.18em", color: "#ccc", textTransform: "uppercase", marginBottom: "2rem" }}>
              v2.4.1 — Demo Environment
            </div>

            {/* Big headline */}
            <h1 className="serif" style={{
              fontSize: "clamp(3rem, 5vw, 5rem)",
              fontWeight: 300,
              lineHeight: 1.0,
              letterSpacing: "0.01em",
              marginBottom: "2rem",
              flex: "0 0 auto",
              color: "#0a0a0a",
            }}>
              Emergency<br />
              care,<br />
              <span style={{ color: "#1976d2" }}>end-to-end.</span>
              <span className="caret" />
            </h1>

            {/* Description */}
            <div style={{ marginBottom: "auto", maxWidth: 400 }}>
              <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "#555", fontWeight: 400 }}>
                From the first 911 call to physician sign-off —
              </p>
              <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "#555", fontWeight: 400, marginTop: "0.5rem" }}>
                every handoff, every vitals check, every AI inference is tracked in a{" "}
                <span style={{ fontWeight: 700, color: "#0a0a0a", borderBottom: "2px solid #1976d2", paddingBottom: "1px" }}>single real-time pipeline</span>{" "}
                across four roles.
              </p>
            </div>

            {/* Sign-in block */}
            <div style={{ marginTop: "3rem" }}>
              <div className="mono" style={{
                fontSize: "0.62rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#bbb",
                marginBottom: "1rem",
                paddingBottom: "0.75rem",
                borderBottom: "1px solid #e8e8e8",
              }}>
                Authentication
              </div>

              <p style={{ fontSize: "0.88rem", color: "#777", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                Sign in with your role email. Each account grants access to one station in the care pipeline.
              </p>

              <a href="/auth/login" style={{ display: "block", marginBottom: "1rem" }}>
                <button className="sso-btn" style={{
                  display: "block",
                  padding: "1rem 1.5rem",
                  background: "#1976d2",
                  color: "#fff",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  textAlign: "left",
                }}>
                  Continue with SSO →
                </button>
              </a>

              <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.75rem", color: "#bbb" }}>
                <span>Scalekit SSO</span>
                <span>·</span>
                <span>HIPAA-ready</span>
                <span>·</span>
                <span>OAuth 2.0</span>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — role table */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f7f9ff" }}>

            {/* Table header */}
            <div style={{
              flexShrink: 0,
              display: "grid",
              gridTemplateColumns: "110px 1fr 1fr 80px",
              borderBottom: "1px solid #e0e0e0",
              padding: "0 2rem",
              height: 44,
              alignItems: "center",
              background: "#eef2fb",
            }}>
              {["Role", "Account", "Email", "Port"].map(h => (
                <span key={h} style={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "#aab", fontWeight: 600 }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {ROLES.map((r, i) => (
                <div
                  key={r.title}
                  className="role-row"
                  style={{
                    flex: 1,
                    display: "grid",
                    gridTemplateColumns: "110px 1fr 1fr 80px",
                    padding: "0 2rem",
                    alignItems: "center",
                    borderBottom: i < ROLES.length - 1 ? "1px solid #e8ecf8" : "none",
                  }}
                >
                  <div>
                    <span className="role-badge mono" style={{
                      fontSize: "0.58rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      border: "1px solid #1976d2",
                      color: "#1976d2",
                      padding: "3px 7px",
                      display: "inline-block",
                      transition: "border-color 0.12s, color 0.12s",
                    }}>
                      {r.code}
                    </span>
                  </div>

                  <div>
                    <div className="role-title" style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.25rem", transition: "color 0.12s", color: "#0a0a0a" }}>
                      {r.title}
                    </div>
                    <div className="role-desc" style={{ fontSize: "0.78rem", color: "#888", transition: "color 0.12s" }}>
                      {r.desc}
                    </div>
                  </div>

                  <div className="role-email" style={{ fontSize: "0.8rem", color: "#555", transition: "color 0.12s" }}>
                    {r.email}
                  </div>

                  <div className="role-port mono" style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1976d2", transition: "color 0.12s" }}>
                    :{r.port}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          flexShrink: 0,
          borderTop: "1px solid #e0e0e0",
          padding: "0 2.5rem",
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fff",
        }}>
          <span style={{ fontSize: "0.72rem", color: "#ccc" }}>
            HealthFlow · {new Date().getFullYear()}
          </span>
          <span style={{ fontSize: "0.72rem", color: "#ccc" }}>
            LangChain · Claude · Supabase · Scalekit
          </span>
        </footer>

        {/* Bottom accent */}
        <div style={{ height: 4, background: "#1976d2", flexShrink: 0 }} />
      </div>
    </>
  );
}

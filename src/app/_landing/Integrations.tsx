"use client";
const G = "#00e88a";

const flow = [
  {
    icon: "🎓",
    label: "Seu Produto",
    sub: "Curso, e-book ou mentoria",
    bg: "#6366f1",
    dark: false,
  },
  {
    icon: "F",
    label: "Flowyn",
    sub: "Checkout + split nativo",
    bg: G,
    dark: true,
  },
  {
    icon: "💳",
    label: "Asaas",
    sub: "Pagamento & repasse",
    bg: "#635bff",
    dark: false,
  },
  {
    icon: "✓",
    label: "Afiliado pago",
    sub: "Comissão automática",
    bg: "#0a0a0a",
    dark: false,
  },
];

export default function Integrations() {
  return (
    <section style={{ background: "#f7f7f7", padding: "100px clamp(24px,5vw,64px)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: G,
            display: "block",
            marginBottom: 12,
          }}
        >
          Infraestrutura
        </span>
        <h2
          style={{
            fontWeight: 800,
            fontSize: "clamp(26px,4vw,46px)",
            letterSpacing: "-0.04em",
            marginBottom: 12,
            color: "#0a0a0a",
          }}
        >
          Tudo integrado. Zero fricção.
        </h2>
        <p
          style={{
            fontSize: 16,
            fontWeight: 300,
            color: "#777",
            marginBottom: 56,
            maxWidth: 480,
            margin: "0 auto 56px",
          }}
        >
          Do checkout ao repasse para criadores e afiliados — via Asaas,
          com split automático e sem uma linha de código.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 0,
          }}
        >
          {flow.map((s, i) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e8e8e8",
                  borderRadius: 18,
                  padding: "24px 28px",
                  textAlign: "center",
                  minWidth: 120,
                  transition: "transform 0.25s, box-shadow 0.25s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(-4px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "0 12px 32px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "none";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: s.bg,
                    color: s.dark ? "#0a0a0a" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 18,
                    margin: "0 auto 10px",
                  }}
                >
                  {s.icon}
                </div>
                <div
                  style={{ fontWeight: 700, fontSize: 14, color: "#0a0a0a", marginBottom: 4 }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 12, color: "#999", fontWeight: 300 }}>{s.sub}</div>
              </div>
              {i < flow.length - 1 && (
                <div style={{ padding: "0 10px", fontSize: 18, color: "#ccc" }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

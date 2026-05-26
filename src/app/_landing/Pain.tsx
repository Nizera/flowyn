"use client";
const G = "#00e88a";

const metrics = [
  { label: "Vendas hoje", value: "R$1.840", delta: "+23%", icon: "📈" },
  { label: "Afiliados ativos", value: "23", delta: "+5 hoje", icon: "👥" },
];

const recentSales = [
  { name: "Lucas M.", product: "Excel Pro", value: "R$97", time: "2min" },
  { name: "Carla S.", product: "Copy Master", value: "R$297", time: "8min" },
  { name: "Rafael P.", product: "Excel Pro", time: "14min", value: "R$97" },
];

const features = [
  {
    icon: "⚡",
    title: "Checkout Nativo com Order Bump",
    sub: "Cada produto tem checkout próprio com oferta adicional que aumenta o ticket médio automaticamente.",
  },
  {
    icon: "🛡",
    title: "Split Financeiro Automático",
    sub: "O Asaas separa a comissão do afiliado e o repasse ao criador em tempo real — zero intervenção manual.",
  },
  {
    icon: "🔄",
    title: "Comissão Recorrente Real",
    sub: "Nos MicroSaaS da Flowyn, afiliados recebem 75% todo mês enquanto o assinante estiver ativo.",
  },
];

export default function Pain() {
  return (
    <section
      style={{
        background: "#0a0a0a",
        color: "#fff",
        padding: "100px clamp(24px,5vw,64px)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 64,
          alignItems: "center",
        }}
      >
        {/* left */}
        <div>
          <h2
            style={{
              fontWeight: 800,
              fontSize: "clamp(30px,4vw,52px)",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            Venda mais.{" "}
            <span style={{ color: G }}>Automatize tudo.</span>
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 17,
              fontWeight: 300,
              lineHeight: 1.7,
              marginBottom: 36,
            }}
          >
            Chega de calcular comissões na planilha e enviar acessos
            manualmente. A Flowyn cuida de todo o fluxo — do checkout ao
            repasse — enquanto você foca no conteúdo.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {features.map((f) => (
              <div key={f.title} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, fontWeight: 300 }}>
                    {f.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* right — mini dashboard */}
        <div
          style={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          {/* dashboard header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: G,
                  boxShadow: `0 0 8px ${G}`,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                Meu Painel · Hoje
              </span>
            </div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>14 Mai</span>
          </div>

          {/* metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.04)" }}>
            {metrics.map((m) => (
              <div
                key={m.label}
                style={{
                  background: "#111",
                  padding: "20px 20px 16px",
                }}
              >
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
                  {m.icon} {m.label}
                </div>
                <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: "-0.04em", color: "#fff" }}>
                  {m.value}
                </div>
                <div style={{ fontSize: 11, color: G, marginTop: 4, fontWeight: 600 }}>{m.delta}</div>
              </div>
            ))}
          </div>

          {/* products + order bump */}
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              display: "flex",
              gap: 12,
            }}
          >
            <div
              style={{
                flex: 1,
                background: "#0d0d0d",
                borderRadius: 12,
                padding: "10px 14px",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
                📦 Produtos
              </div>
              <div style={{ fontWeight: 700, fontSize: 20, color: "#fff" }}>3</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>publicados</div>
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(0,232,138,0.05)",
                borderRadius: 12,
                padding: "10px 14px",
                border: "1px solid rgba(0,232,138,0.15)",
              }}
            >
              <div style={{ fontSize: 11, color: G, marginBottom: 4 }}>⚡ Order Bump</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: G }}>+18%</div>
              <div style={{ fontSize: 11, color: G, opacity: 0.6 }}>ticket médio</div>
            </div>
          </div>

          {/* recent sales feed */}
          <div style={{ padding: "14px 20px" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Vendas recentes
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentSales.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#0d0d0d",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: `hsl(${i * 120},60%,40%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {s.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{s.product}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: G }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{s.time} atrás</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

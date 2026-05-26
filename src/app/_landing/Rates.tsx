const G = "#00e88a";

const platforms = [
  { name: "Hotmart", fee: "9,9%", extra: "+ R$1 fixo", color: "#ff6b35" },
  { name: "Eduzz", fee: "10%", extra: "+ R$0,99", color: "#e63946" },
  { name: "Kiwify", fee: "9,99%", extra: "por transação", color: "#7b2d8b" },
  { name: "Monetizze", fee: "9,9%", extra: "+ R$1 fixo", color: "#e9c46a" },
];

export default function Rates() {
  return (
    <section style={{ background: "#f7f7f7", padding: "100px clamp(24px,5vw,64px)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
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
            Taxas
          </span>
          <h2
            style={{
              fontWeight: 800,
              fontSize: "clamp(28px,4vw,50px)",
              letterSpacing: "-0.04em",
              color: "#0a0a0a",
              marginBottom: 14,
            }}
          >
            A menor taxa do mercado.{" "}
            <span style={{ color: G }}>Garantido.</span>
          </h2>
          <p
            style={{
              fontSize: 17,
              fontWeight: 300,
              color: "#666",
              maxWidth: 480,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Enquanto as outras plataformas ficam com quase 10% de cada venda,
            na Flowyn você fica com mais do que ganhou.
          </p>
        </div>

        {/* comparison table */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #ebebeb",
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          {/* header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              padding: "14px 24px",
              background: "#fafafa",
              borderBottom: "1px solid #ebebeb",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em" }}>Plataforma</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em" }}>Taxa por Venda</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em" }}>Em R$1.000 vendidos</span>
          </div>

          {/* competitors */}
          {platforms.map((p) => {
            const feeNum = parseFloat(p.fee.replace(",", ".")) / 100;
            const lost = (1000 * feeNum + (p.extra.includes("R$1") ? 1 : p.extra.includes("0,99") ? 0.99 : 0)).toFixed(2);
            return (
              <div
                key={p.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  padding: "18px 24px",
                  borderBottom: "1px solid #f5f5f5",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: p.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 15, color: "#333" }}>{p.name}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "#e63946" }}>{p.fee}</span>
                  <span style={{ fontSize: 12, color: "#aaa", marginLeft: 6 }}>{p.extra}</span>
                </div>
                <span style={{ fontWeight: 600, fontSize: 15, color: "#aaa" }}>
                  −R$ {lost} perdidos
                </span>
              </div>
            );
          })}

          {/* Flowyn highlight row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              padding: "22px 24px",
              background: "rgba(0,232,138,0.06)",
              borderTop: "2px solid rgba(0,232,138,0.3)",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: G,
                  boxShadow: `0 0 8px ${G}`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 800, fontSize: 16, color: "#0a0a0a" }}>Flowyn</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: G,
                  color: "#0a0a0a",
                  padding: "2px 8px",
                  borderRadius: 6,
                  marginLeft: 4,
                }}
              >
                MENOR TAXA
              </span>
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 20, color: G }}>3,9%</span>
              <span style={{ fontSize: 12, color: "#666", marginLeft: 6 }}>+ R$1,00</span>
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: 16, color: G }}>−R$ 40,00</span>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "rgba(0,232,138,0.7)",
                  marginTop: 2,
                }}
              >
                você economiza até R$60 por R$1k
              </span>
            </div>
          </div>
        </div>

        {/* bottom callout */}
        <div
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
            gap: 16,
          }}
        >
          {[
            { icon: "💳", label: "Pagamento único ou recorrente" },
            { icon: "🔄", label: "Split automático via Asaas" },
            { icon: "📦", label: "Sem mensalidade fixa" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: 16,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 14, color: "#333" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

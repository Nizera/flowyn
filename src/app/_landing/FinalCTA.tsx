import Link from "next/link";
const G = "#00e88a";

export default function FinalCTA() {
  return (
    <section
      style={{
        background: "#0a0a0a",
        padding: "120px clamp(24px,5vw,64px)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 700,
          height: 400,
          background:
            "radial-gradient(ellipse at bottom, rgba(0,232,138,0.18) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", maxWidth: 680, margin: "0 auto" }}>
        <h2
          style={{
            fontWeight: 800,
            fontSize: "clamp(34px,6vw,66px)",
            letterSpacing: "-0.04em",
            color: "#fff",
            lineHeight: 1.05,
            marginBottom: 20,
          }}
        >
          Pronto para crescer<br />
          <em style={{ fontStyle: "italic", color: G }}>sem</em> limite?
        </h2>
        <p
          style={{
            fontSize: 17,
            fontWeight: 300,
            color: "rgba(255,255,255,0.45)",
            marginBottom: 44,
            lineHeight: 1.7,
          }}
        >
          Crie seus infoprodutos, afilie-se aos MicroSaaS da Flowyn ou faça os dois.
          A plataforma é gratuita para começar.
        </p>
        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/register"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 40px",
              borderRadius: 16,
              background: G,
              color: "#0a0a0a",
              fontWeight: 700,
              fontSize: 16,
              textDecoration: "none",
              transition: "all 0.25s",
              boxShadow: `0 0 32px rgba(0,232,138,0.3)`,
            }}
          >
            Criar Conta Gratuita →
          </Link>
          <Link
            href="/market"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 36px",
              borderRadius: 16,
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              fontWeight: 500,
              fontSize: 16,
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.12)",
              transition: "all 0.25s",
            }}
          >
            Ver Vitrine de Produtos
          </Link>
        </div>
        <p style={{ marginTop: 24, fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
          Sem mensalidade · Comissões automáticas via Asaas · Cancele quando quiser
        </p>
      </div>
    </section>
  );
}

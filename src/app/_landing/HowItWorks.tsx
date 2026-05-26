"use client";
const G = "#00e88a";

const steps = [
  {
    icon: "01",
    title: "Crie ou explore",
    desc: "Publique cursos, e-books e mentorias com checkout customizado — ou navegue na vitrine e escolha um MicroSaaS da Flowyn para promover como afiliado.",
  },
  {
    icon: "02",
    title: "Configure e divulgue",
    desc: "Defina comissões, adicione order bumps e gere seu link rastreável. Compartilhe e veja as conversões chegando em tempo real.",
  },
  {
    icon: "03",
    title: "Receba e escale",
    desc: "O Asaas cuida do split automático a cada venda. Criadores e afiliados recebem sua parte sem nenhuma intervenção manual.",
  },
];

export default function HowItWorks() {
  return (
    <section style={{ background: "#f7f7f7", padding: "100px clamp(24px,5vw,64px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
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
            Como funciona
          </span>
          <h2
            style={{
              fontWeight: 800,
              fontSize: "clamp(28px,4vw,48px)",
              letterSpacing: "-0.04em",
              color: "#0a0a0a",
            }}
          >
            Três passos. Você no controle.
          </h2>
          <p
            style={{
              fontSize: 17,
              fontWeight: 300,
              color: "#666",
              marginTop: 14,
              maxWidth: 480,
              margin: "14px auto 0",
              lineHeight: 1.6,
            }}
          >
            Do cadastro à primeira venda ou comissão em menos de uma hora.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 24,
          }}
        >
          {steps.map((s) => (
            <div
              key={s.icon}
              style={{
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: 20,
                padding: "36px 32px",
                position: "relative",
                overflow: "hidden",
                transition: "transform 0.25s ease, box-shadow 0.25s ease",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform =
                  "translateY(-5px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  "0 16px 48px rgba(0,0,0,0.09)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "none";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 80,
                  color: "rgba(0,0,0,0.04)",
                  letterSpacing: "-0.05em",
                  lineHeight: 1,
                  position: "absolute",
                  top: 8,
                  right: 16,
                }}
              >
                {s.icon}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 13,
                  color: G,
                  marginBottom: 14,
                  letterSpacing: "0.04em",
                }}
              >
                {s.icon}
              </div>
              <h3
                style={{
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: "-0.03em",
                  marginBottom: 12,
                  color: "#0a0a0a",
                }}
              >
                {s.title}
              </h3>
              <p style={{ fontSize: 15, fontWeight: 300, color: "#666", lineHeight: 1.68 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

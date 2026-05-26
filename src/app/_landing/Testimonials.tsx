"use client";
const testimonials = [
  {
    text: "Publiquei meu curso de Excel em 20 minutos. Na primeira semana já tinha 3 afiliados promovendo e fechei 11 vendas sem gastar R$1 em anúncios. A área de membros da Flowyn é incrível.",
    name: "Lucas Mendes",
    role: "Criador de conteúdo — Excel Pro",
    initials: "LM",
    color: "#5865f2",
  },
  {
    text: "Como afiliada, promover os MicroSaaS da Flowyn mudou tudo. Vendo uma vez e recebo 75% todo mês enquanto o cliente renovar. Em 6 meses construí R$4.200/mês de renda recorrente.",
    name: "Carol Azevedo",
    role: "Afiliada Flowyn — Top Performer",
    initials: "CA",
    color: "#e91e8c",
  },
  {
    text: "Meu e-book de copywriting saiu de zero para R$8k/mês em 3 meses usando só a rede de afiliados da Flowyn. O split automático via Asaas me poupa horas de conciliação financeira.",
    name: "Rafael Prado",
    role: "Produtor — Escola de Copy",
    initials: "RP",
    color: "#00b86e",
  },
];

export default function Testimonials() {
  return (
    <section style={{ background: "#fff", padding: "100px clamp(24px,5vw,64px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#00e88a",
              display: "block",
              marginBottom: 12,
            }}
          >
            Depoimentos
          </span>
          <h2
            style={{
              fontWeight: 800,
              fontSize: "clamp(26px,4vw,46px)",
              letterSpacing: "-0.04em",
              color: "#0a0a0a",
            }}
          >
            Quem usou, não volta atrás.
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))",
            gap: 24,
          }}
        >
          {testimonials.map((t) => (
            <div
              key={t.name}
              style={{
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: 20,
                padding: "28px 28px",
                transition: "transform 0.25s, box-shadow 0.25s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform =
                  "translateY(-4px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  "0 12px 40px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "none";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <div style={{ color: "#FFB800", fontSize: 14, marginBottom: 16, letterSpacing: 2 }}>
                ★ ★ ★ ★ ★
              </div>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 300,
                  color: "#444",
                  lineHeight: 1.72,
                  marginBottom: 24,
                }}
              >
                &ldquo;{t.text}&rdquo;
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: t.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#0a0a0a" }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#999", fontWeight: 300 }}>
                    {t.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

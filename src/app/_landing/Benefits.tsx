"use client";
import { useState } from "react";
const G = "#00e88a";

const criadorBenefits = [
  "Wizard de criação passo a passo — produto no ar em minutos",
  "Checkout customizado com banner, vídeo e order bump nativo",
  "Afiliados promovem seu produto por comissão — você paga só na venda",
  "Split Asaas automático: criador e afiliado recebem na mesma hora",
  "Área de membros integrada para hospedar vídeos e PDFs",
];

const afilBenefits = [
  "Comissão recorrente: nos MicroSaaS da Flowyn, 75% todo mês",
  "Afilie-se a qualquer infoproduto da plataforma com 1 clique",
  "Link rastreável e dashboard de conversões em tempo real",
  "Saque automático via Asaas — sem burocracia",
  "Combine promoção de SaaS + cursos para maximizar a renda",
];

function MetricCard({
  label,
  value,
  sub,
  green,
}: {
  label: string;
  value: string;
  sub: string;
  green?: boolean;
}) {
  return (
    <div
      style={{
        background: "#0d0d0d",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: "18px 20px",
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 28,
          letterSpacing: "-0.04em",
          color: green ? G : "#fff",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
        {sub}
      </div>
    </div>
  );
}

export default function Benefits() {
  const [tab, setTab] = useState<"criador" | "afil">("criador");
  const isCriador = tab === "criador";

  return (
    <section
      style={{
        background: "#0a0a0a",
        color: "#fff",
        padding: "100px clamp(24px,5vw,64px)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2
            style={{
              fontWeight: 800,
              fontSize: "clamp(28px,4vw,50px)",
              letterSpacing: "-0.04em",
              marginBottom: 32,
            }}
          >
            Feito para os dois lados.
          </h2>
          <div
            style={{
              display: "inline-flex",
              background: "#111",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: 4,
              gap: 4,
            }}
          >
            {(["criador", "afil"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "10px 28px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  transition: "all 0.22s",
                  background: tab === t ? G : "transparent",
                  color: tab === t ? "#0a0a0a" : "rgba(255,255,255,0.45)",
                }}
              >
                {t === "criador" ? "Para Criadores" : "Para Afiliados"}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            {isCriador ? (
              <>
                <h3
                  style={{
                    fontWeight: 800,
                    fontSize: "clamp(24px,3vw,40px)",
                    letterSpacing: "-0.04em",
                    marginBottom: 12,
                  }}
                >
                  Publique e venda<br />
                  seu <span style={{ color: G }}>infoproduto.</span>
                </h3>
                <p
                  style={{
                    color: "rgba(255,255,255,0.42)",
                    fontSize: 16,
                    fontWeight: 300,
                    lineHeight: 1.7,
                    marginBottom: 28,
                  }}
                >
                  Crie cursos, e-books e mentorias com checkout nativo, order bumps e
                  área de membros hospedada na Flowyn. Sua rede de afiliados trabalha
                  por você.
                </p>
              </>
            ) : (
              <>
                <h3
                  style={{
                    fontWeight: 800,
                    fontSize: "clamp(24px,3vw,40px)",
                    letterSpacing: "-0.04em",
                    marginBottom: 12,
                  }}
                >
                  Renda recorrente<br />
                  <span style={{ color: G }}>real.</span> De verdade.
                </h3>
                <p
                  style={{
                    color: "rgba(255,255,255,0.42)",
                    fontSize: 16,
                    fontWeight: 300,
                    lineHeight: 1.7,
                    marginBottom: 28,
                  }}
                >
                  Promova infoprodutos ou os MicroSaaS exclusivos da Flowyn e receba
                  comissão recorrente toda vez que o cliente renovar.
                </p>
              </>
            )}
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {(isCriador ? criadorBenefits : afilBenefits).map((b) => (
                <li
                  key={b}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    fontSize: 15,
                    fontWeight: 300,
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  <span style={{ color: G, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* metric cards */}
          <div
            style={{
              background: "#111",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 24,
              padding: 28,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {isCriador ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <MetricCard label="Receita do Mês" value="R$8.3k" sub="↑ 34% vs mês anterior" green />
                  <MetricCard label="Afiliados Ativos" value="47" sub="↑ 12 novos" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <MetricCard label="Custo por venda" value="R$0" sub="Zero anúncios" />
                  <MetricCard label="Vendas totais" value="312" sub="Automáticas" />
                </div>
                <div
                  style={{
                    background: "rgba(0,232,138,0.05)",
                    border: "1px solid rgba(0,232,138,0.12)",
                    borderRadius: 12,
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: 13,
                    color: G,
                  }}
                >
                  ✓ Order bump ativado — +18% no ticket médio
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <MetricCard label="Comissão mensal" value="R$4.2k" sub="↑ 28% vs mês anterior" green />
                  <MetricCard label="Assinaturas ativas" value="89" sub="Todos renovando" />
                </div>
                <MetricCard
                  label="Projeção anual (sem novas vendas)"
                  value="R$50.4k"
                  sub="Apenas com a base atual"
                  green
                />
                <div
                  style={{
                    background: "rgba(0,232,138,0.05)",
                    border: "1px solid rgba(0,232,138,0.12)",
                    borderRadius: 12,
                    padding: "12px 16px",
                    textAlign: "center",
                    fontSize: 13,
                    color: G,
                  }}
                >
                  ✓ Comissão de 75% nos MicroSaaS da Flowyn
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

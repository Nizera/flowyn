"use client";
import Link from "next/link";
const G = "#00e88a";
export default function Hero() {
  return (
    <section className="hero-grid" style={{
      paddingTop: 140, paddingBottom: 100,
      textAlign: "center", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 800, height: 500,
        background: "radial-gradient(ellipse, rgba(0,232,138,0.09) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 clamp(20px, 5vw, 40px)", position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px",
          borderRadius: 999, background: "#f0fdf7", border: `1px solid rgba(0,232,138,0.3)`,
          fontSize: 13, fontWeight: 500, color: "#0a0a0a", marginBottom: 36,
        }}>
          <span className="dot-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: G, flexShrink: 0 }} />
          Plataforma ao vivo — centenas de produtores ativos
        </div>
        <h1 style={{
          fontWeight: 800,
          fontSize: "clamp(40px, 6.5vw, 76px)", letterSpacing: "-0.04em",
          lineHeight: 1.02, marginBottom: 28, color: "#0a0a0a",
        }}>
          Seu SaaS vendendo<br />sozinho, <span style={{ color: G }}>24 horas</span><br />por dia.
        </h1>
        <p style={{
          fontSize: "clamp(16px, 2vw, 19px)", fontWeight: 300, color: "#666",
          lineHeight: 1.7, maxWidth: 520, margin: "0 auto 44px",
        }}>
          Checkout, split financeiro e acesso automático para o seu cliente — tudo conectado em minutos, sem código.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register?type=producer" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "14px 32px", borderRadius: 14, background: "#0a0a0a",
            color: "#fff", fontWeight: 600, fontSize: 15, textDecoration: "none",
            boxShadow: "0 8px 32px rgba(0,0,0,0.20)", transition: "all 0.25s",
          }}>Sou Produtor →</Link>
          <Link href="/register?type=affiliate" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "14px 32px", borderRadius: 14, background: "transparent",
            color: "#0a0a0a", fontWeight: 600, fontSize: 15, textDecoration: "none",
            border: "1.5px solid #d4d4d8", transition: "all 0.25s",
          }}>Quero ser Afiliado</Link>
        </div>
        <p style={{ marginTop: 22, fontSize: 13, color: "#aaa", fontWeight: 400 }}>
          Sem mensalidade · Comece grátis · Cancele quando quiser
        </p>
      </div>
    </section>
  );
}

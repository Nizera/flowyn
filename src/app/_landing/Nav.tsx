"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
const G = "#00e88a";
export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      height: scrolled ? "52px" : "64px",
      background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 clamp(24px, 5vw, 64px)",
      transition: "height 0.3s ease, box-shadow 0.3s ease",
      boxShadow: scrolled ? "0 1px 24px rgba(0,0,0,0.07)" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <img src="/logo.png" alt="Flowyn" style={{ height: 80, width: 'auto' }} />
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: "#666", textDecoration: "none" }}>Entrar</Link>
        <Link href="/register" style={{
          fontSize: 14, fontWeight: 600, background: "#0a0a0a", color: "#fff",
          padding: "9px 22px", borderRadius: 12, textDecoration: "none",
          boxShadow: "0 2px 12px rgba(0,0,0,0.18)", transition: "all 0.2s",
        }}>Começar Grátis</Link>
      </div>
    </nav>
  );
}

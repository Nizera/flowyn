const G = "#00e88a";
export default function Footer() {
  return (
    <footer style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "40px clamp(24px,5vw,64px)", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <img src="/logo2.png" alt="Flowyn" style={{ height: 64, width: 'auto', opacity: 0.8 }} />
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", fontWeight: 300 }}>
        © {new Date().getFullYear()} Flowyn. Todos os direitos reservados.
      </p>
    </footer>
  );
}

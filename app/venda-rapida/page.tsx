export default function VendaRapidaPage() {
  return (
    <main className="login">
      <section className="login-card">
        <h1 className="page-title">Venda Rápida</h1>
        <p className="muted">Protótipo inicial do fluxo de balcão.</p>
        <div className="cards" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {["Xerox P&B", "Xerox Colorida", "Impressão P&B", "Impressão Colorida", "Scanner", "Encadernação"].map((item) => (
            <button key={item} className="btn secondary" style={{ minHeight: 75 }}>{item}</button>
          ))}
        </div>
      </section>
    </main>
  );
}
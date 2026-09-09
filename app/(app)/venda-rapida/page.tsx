const ITENS = [
  'Xerox P&B',
  'Xerox Colorida',
  'Impressão P&B',
  'Impressão Colorida',
  'Scanner',
  'Encadernação',
];

export default function VendaRapidaPage() {
  return (
    <div className="page">
      <h1 className="page-title">Venda Rápida</h1>
      <p className="muted">Protótipo inicial do fluxo de balcão.</p>

      <div className="vr-grid">
        {ITENS.map((item) => (
          <button key={item} type="button" className="vr-tile">
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

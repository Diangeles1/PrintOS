// Skeletons de carregamento — usados pelos loading.tsx dos segmentos.

export function ListaSkeleton({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="page sk-wrap" aria-hidden="true">
      <div className="sk sk-title" />
      <div className="sk sk-line" style={{ width: 260, height: 12, marginBottom: 20 }} />
      <div className="sk sk-line" style={{ width: '100%', maxWidth: 380, height: 40, marginBottom: 18 }} />
      <div className="table-wrap" style={{ padding: 10 }}>
        {Array.from({ length: linhas }).map((_, i) => (
          <div key={i} className="sk sk-row" />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="page sk-wrap" aria-hidden="true">
      <div className="sk sk-title" />
      <div className="sk sk-line" style={{ width: 220, height: 12, marginBottom: 22 }} />
      <div className="cards">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="sk sk-card" />
        ))}
      </div>
      <div className="sk sk-line" style={{ width: 180, height: 18, margin: '18px 0 12px' }} />
      <div className="table-wrap" style={{ padding: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="sk sk-row" />
        ))}
      </div>
    </div>
  );
}

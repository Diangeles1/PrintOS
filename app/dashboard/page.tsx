import Link from "next/link";
import Sidebar from "@/app/_components/Sidebar";

const orders = [
  ["#1045", "João Silva", "Em produção", "08/09"],
  ["#1044", "Maria Souza", "Pronto", "07/09"],
  ["#1043", "Empresa X", "Aguardando pagamento", "10/09"],
  ["#1042", "Carlos Lima", "Aguardando arte", "09/09"],
];

export default function DashboardPage() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <h1 className="page-title">Olá, João!</h1>
        <p className="muted">Aqui está o resumo de hoje.</p>
        <div className="cards">
          <Kpi title="Vendas hoje" value="R$ 1.842,50" />
          <Kpi title="Pedidos" value="37" />
          <Kpi title="Atrasados" value="3" />
          <Kpi title="Aguardando pagamento" value="7" />
        </div>
        <div className="actions">
          <Link className="btn" href="/venda-rapida">Venda rápida</Link>
          <Link className="btn secondary" href="/orcamentos">Novo orçamento</Link>
          <Link className="btn secondary" href="/producao">Produção</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Prazo</th></tr>
            </thead>
            <tbody>
              {orders.map(([id, customer, status, deadline]) => (
                <tr key={id}><td>{id}</td><td>{customer}</td><td>{status}</td><td>{deadline}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return <section className="card"><div className="muted">{title}</div><div className="kpi">{value}</div></section>;
}

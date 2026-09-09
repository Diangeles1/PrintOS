'use client';

import { usePathname } from 'next/navigation';

const TITULOS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/venda-rapida': 'Venda Rápida',
  '/orcamentos': 'Orçamentos',
  '/pedidos': 'Pedidos',
  '/producao': 'Produção',
  '/caixa': 'Caixa',
  '/clientes': 'Clientes',
  '/materiais': 'Materiais',
  '/configuracoes': 'Configurações',
};

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}

export default function Topbar({ user }: { user: { nome: string } }) {
  const pathname = usePathname();
  const secao =
    Object.entries(TITULOS).find(
      ([href]) => pathname === href || pathname.startsWith(`${href}/`),
    )?.[1] ?? 'PrintOS';

  return (
    <header className="ax-topbar">
      <div className="ax-crumb">
        <span>PrintOS</span>
        <i aria-hidden="true">/</i>
        <strong>{secao}</strong>
      </div>
      <div className="ax-topbar-user">
        Olá, {primeiroNome(user.nome)}
      </div>
    </header>
  );
}

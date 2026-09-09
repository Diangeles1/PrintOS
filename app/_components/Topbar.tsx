'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Zap } from 'lucide-react';

const TITULOS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/venda-rapida': 'Venda Rápida',
  '/orcamentos': 'Orçamentos',
  '/pedidos': 'Pedidos',
  '/producao': 'Produção',
  '/caixa': 'Caixa',
  '/clientes': 'Clientes',
  '/servicos': 'Serviços e Produtos',
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

      <div className="ax-topbar-actions">
        <Link href="/orcamentos" className="ax-quick">
          <FileText size={15} aria-hidden="true" />
          <span>Orçamento</span>
        </Link>
        <Link href="/venda-rapida" className="ax-quick ax-quick--primary">
          <Zap size={15} aria-hidden="true" />
          <span>Venda rápida</span>
        </Link>
        <span className="ax-topbar-user">Olá, {primeiroNome(user.nome)}</span>
      </div>
    </header>
  );
}

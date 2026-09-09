'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const LINKS: [string, string][] = [
  ['/dashboard', 'Dashboard'],
  ['/venda-rapida', 'Venda Rápida'],
  ['/orcamentos', 'Orçamentos'],
  ['/pedidos', 'Pedidos'],
  ['/producao', 'Produção'],
  ['/clientes', 'Clientes'],
  ['/materiais', 'Materiais'],
  ['/caixa', 'Caixa'],
  ['/configuracoes', 'Configurações'],
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        Print<span>OS</span>
      </div>
      <nav className="nav">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={pathname === href ? 'active' : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <button type="button" className="logout-btn" onClick={handleLogout}>
        Sair
      </button>
    </aside>
  );
}

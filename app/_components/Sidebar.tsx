'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  FileText,
  ClipboardList,
  Factory,
  Users,
  Boxes,
  Wallet,
  Settings,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Item = { href: string; label: string; icon: typeof LayoutDashboard };

const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: 'Operação',
    itens: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/venda-rapida', label: 'Venda Rápida', icon: Zap },
      { href: '/orcamentos', label: 'Orçamentos', icon: FileText },
      { href: '/pedidos', label: 'Pedidos', icon: ClipboardList },
      { href: '/producao', label: 'Produção', icon: Factory },
      { href: '/caixa', label: 'Caixa', icon: Wallet },
    ],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/materiais', label: 'Materiais', icon: Boxes },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [{ href: '/configuracoes', label: 'Configurações', icon: Settings }],
  },
];

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function Sidebar({ user }: { user: { nome: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="ax-sidebar">
      <Link href="/dashboard" className="ax-brand">
        <span className="ax-brand-name">
          Print<span>OS</span>
        </span>
        <i className="ax-brand-sq" aria-hidden="true" />
      </Link>

      <nav className="ax-nav">
        {GRUPOS.map((grupo) => (
          <div className="ax-nav-group" key={grupo.titulo}>
            <p className="ax-nav-title">{grupo.titulo}</p>
            {grupo.itens.map(({ href, label, icon: Icon }) => {
              const ativo = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`ax-nav-link${ativo ? ' is-active' : ''}`}
                  aria-current={ativo ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="ax-user">
        <div className="ax-user-info">
          <span className="ax-avatar" aria-hidden="true">
            {iniciais(user.nome)}
          </span>
          <span className="ax-user-text">
            <strong>{user.nome}</strong>
            {user.email && <small>{user.email}</small>}
          </span>
        </div>
        <button type="button" className="ax-logout" onClick={handleLogout}>
          <LogOut size={16} strokeWidth={2} aria-hidden="true" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

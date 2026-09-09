import Link from 'next/link';
import { Manrope } from 'next/font/google';
import { ShieldAlert, Users, ScrollText, ArrowUpRight } from 'lucide-react';

import { requireSuperadmin } from '@/lib/admin/guard';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--pl-font',
  display: 'swap',
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireSuperadmin();

  return (
    <div className={`adm-root ${manrope.variable}`}>
      <aside className="adm-side">
        <div className="adm-brand">
          <ShieldAlert size={18} aria-hidden="true" />
          <span>
            Print<b>OS</b> · Console
          </span>
        </div>
        <nav className="adm-nav">
          <Link href="/admin" className="adm-nav-link">
            <Users size={16} aria-hidden="true" /> Contas
          </Link>
          <Link href="/admin/auditoria" className="adm-nav-link">
            <ScrollText size={16} aria-hidden="true" /> Auditoria
          </Link>
        </nav>
        <div className="adm-side-foot">
          <span className="adm-me">{email}</span>
          <Link href="/dashboard" className="adm-sair">
            Sair do console <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <main className="adm-main">
        <div className="adm-warn">
          Modo administrador — você está vendo e editando dados de <b>todas as gráficas</b>. Toda
          ação fica registrada.
        </div>
        {children}
      </main>
    </div>
  );
}

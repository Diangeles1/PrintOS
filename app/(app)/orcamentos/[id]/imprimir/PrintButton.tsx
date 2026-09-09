'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';

export default function PrintButton({ voltarHref }: { voltarHref: string }) {
  return (
    <div className="doc-actions">
      <Link href={voltarHref} className="btn secondary">
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar
      </Link>
      <button type="button" className="btn" onClick={() => window.print()}>
        <Printer size={16} aria-hidden="true" />
        Imprimir / Salvar PDF
      </button>
    </div>
  );
}

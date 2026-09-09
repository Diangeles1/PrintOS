'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Link2, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

import type { Aprovacao } from './PedidoEditor';

const RES: Record<string, { rotulo: string; classe: string }> = {
  aprovado: { rotulo: 'Cliente aprovou a arte', classe: 'pd-apv-res--ok' },
  alteracao: { rotulo: 'Cliente pediu alteração', classe: 'pd-apv-res--alt' },
  recusado: { rotulo: 'Cliente recusou a arte', classe: 'pd-apv-res--no' },
};

function novoToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function dataHora(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AprovacaoLink({
  pedidoId,
  aprovacaoInicial,
  appUrl,
  clienteNome,
}: {
  pedidoId: string;
  aprovacaoInicial: Aprovacao | null;
  appUrl: string;
  clienteNome: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [aprov, setAprov] = useState<Aprovacao | null>(aprovacaoInicial);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const link = aprov ? `${appUrl}/aprovar/${aprov.token}` : '';
  const ativo = aprov && !aprov.revogado;
  const pendente = ativo && aprov!.status === 'pendente';
  const respondido = ativo && aprov!.status !== 'pendente';

  async function gerar() {
    setErro(null);
    setOcupado(true);
    // limpa link anterior (mantém 1 por pedido)
    if (aprov) await supabase.from('pedido_aprovacoes').delete().eq('id', aprov.id);
    const token = novoToken();
    const { data, error } = await supabase
      .from('pedido_aprovacoes')
      .insert({ pedido_id: pedidoId, token })
      .select(
        'id, token, status, comentario, respondente, respondido_em, revogado, expira_em, created_at',
      )
      .single();
    setOcupado(false);
    if (error || !data) {
      setErro(`Não foi possível gerar o link. ${error?.message ?? ''}`);
      return;
    }
    setAprov(data as Aprovacao);
    setCopiado(false);
    router.refresh();
  }

  async function cancelar() {
    if (!aprov) return;
    setOcupado(true);
    const { error } = await supabase.from('pedido_aprovacoes').delete().eq('id', aprov.id);
    setOcupado(false);
    if (error) {
      setErro(`Não foi possível cancelar. ${error.message}`);
      return;
    }
    setAprov(null);
    router.refresh();
  }

  function copiar() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  const msgWhats = encodeURIComponent(
    `Olá${clienteNome ? ` ${clienteNome}` : ''}! Segue a arte do seu pedido para conferência:\n${link}\n\nÉ só abrir, revisar com calma e responder: Aprovar, Solicitar alteração ou Recusar.`,
  );

  return (
    <section className="pd-apv">
      <div className="pd-apv-top">
        <h2 className="cx-h2" style={{ margin: 0 }}>
          <Link2 size={15} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />
          Aprovação do cliente
        </h2>
        {!ativo && (
          <button type="button" className="btn secondary" onClick={gerar} disabled={ocupado || !appUrl}>
            {ocupado ? <Loader2 size={15} className="cl-spin" aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
            Gerar link
          </button>
        )}
      </div>

      {!appUrl && (
        <p className="pd-apv-hint pd-apv-hint--warn">
          Configure <code>NEXT_PUBLIC_APP_URL</code> para gerar links que abrem fora da rede local.
        </p>
      )}

      {!ativo && appUrl && (
        <p className="pd-apv-hint">
          Gera um link público com a arte deste pedido. Você manda pro cliente no WhatsApp; ele abre,
          confere e responde <strong>Aprovar</strong>, <strong>Solicitar alteração</strong> ou{' '}
          <strong>Recusar</strong>. A resposta volta pra cá. Aprovando, o pedido vai pra produção
          automaticamente.
        </p>
      )}

      {ativo && (
        <div className="pd-apv-box">
          <div className="pd-apv-link">
            <input className="cl-input" value={link} readOnly onFocus={(e) => e.target.select()} />
            <button type="button" className="pd-apv-copy" onClick={copiar}>
              {copiado ? <Check size={14} /> : <Copy size={14} />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <div className="pd-apv-acoes">
            <a
              className="btn"
              href={`https://wa.me/?text=${msgWhats}`}
              target="_blank"
              rel="noreferrer"
            >
              Enviar no WhatsApp
            </a>
            {pendente && (
              <button type="button" className="pd-apv-x" onClick={cancelar} disabled={ocupado}>
                <Trash2 size={14} aria-hidden="true" />
                Cancelar link
              </button>
            )}
            {respondido && (
              <button type="button" className="pd-apv-x" onClick={gerar} disabled={ocupado}>
                <RefreshCw size={14} aria-hidden="true" />
                Gerar novo link
              </button>
            )}
          </div>

          {pendente && (
            <p className="pd-apv-hint">
              Aguardando o cliente responder · link expira {dataHora(aprov!.expira_em)}.
            </p>
          )}

          {respondido && (
            <div className={`pd-apv-res ${RES[aprov!.status].classe}`}>
              <strong>{RES[aprov!.status].rotulo}</strong>
              {aprov!.comentario && <p className="pd-apv-res-msg">“{aprov!.comentario}”</p>}
              <p className="pd-apv-res-meta">
                {aprov!.respondente ? `${aprov!.respondente} · ` : ''}
                {dataHora(aprov!.respondido_em)}
              </p>
            </div>
          )}
        </div>
      )}

      {erro && <p className="cl-form-err" style={{ marginTop: 8 }}>{erro}</p>}
    </section>
  );
}

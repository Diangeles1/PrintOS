'use client';

import { useState } from 'react';

export type ArteArquivo = { id: string; nome: string; mime: string; url: string | null };

type Status = 'pendente' | 'aprovado' | 'recusado' | 'alteracao';
type Decisao = 'aprovado' | 'recusado' | 'alteracao';

const RESULTADO: Record<Decisao, { titulo: string; classe: string; ico: string }> = {
  aprovado: { titulo: 'Arte aprovada', classe: 'apv-res--ok', ico: '✓' },
  alteracao: { titulo: 'Alteração solicitada', classe: 'apv-res--alt', ico: '↻' },
  recusado: { titulo: 'Arte recusada', classe: 'apv-res--no', ico: '✕' },
};

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
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

export default function AprovacaoView({
  token,
  empresaNome,
  empresaLogo,
  pedidoNumero,
  clienteNome,
  arquivos,
  statusInicial,
  comentario,
  respondente,
  respondidoEm,
}: {
  token: string;
  empresaNome: string;
  empresaLogo: string | null;
  pedidoNumero: number | null;
  clienteNome: string | null;
  arquivos: ArteArquivo[];
  statusInicial: Status;
  comentario: string | null;
  respondente: string | null;
  respondidoEm: string | null;
}) {
  const [status, setStatus] = useState<Status>(statusInicial);
  const [modo, setModo] = useState<Decisao | null>(null);
  const [nome, setNome] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [comentEnviado, setComentEnviado] = useState<string | null>(comentario);
  const [respEnviado, setRespEnviado] = useState<string | null>(respondente);
  const [quando, setQuando] = useState<string | null>(respondidoEm);

  const imagens = arquivos.filter((a) => a.mime.startsWith('image/') && a.url);
  const outros = arquivos.filter((a) => !(a.mime.startsWith('image/') && a.url));

  async function enviar(decisao: Decisao) {
    setErro(null);
    if (decisao !== 'aprovado' && texto.trim().length < 3) {
      setErro('Escreva o que precisa ser ajustado.');
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(`/api/aprovacao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, comentario: texto.trim(), respondente: nome.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(data.erro || 'Não foi possível enviar. Tente de novo.');
        setEnviando(false);
        return;
      }
      setComentEnviado(texto.trim() || null);
      setRespEnviado(nome.trim() || null);
      setQuando(new Date().toISOString());
      setStatus(decisao);
    } catch {
      setErro('Sem conexão. Tente de novo.');
    }
    setEnviando(false);
  }

  const respondido = status !== 'pendente';

  return (
    <div className="apv-root">
      <div className="apv-card">
        <header className="apv-head">
          {empresaLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="apv-logo" src={empresaLogo} alt={empresaNome} />
          ) : (
            <span className="apv-logo-txt" aria-hidden="true">
              {iniciais(empresaNome)}
            </span>
          )}
          <div className="apv-head-info">
            <strong>{empresaNome}</strong>
            <span>
              {pedidoNumero ? `Pedido #${pedidoNumero}` : 'Pedido'}
              {clienteNome ? ` · ${clienteNome}` : ''}
            </span>
          </div>
        </header>

        <h1 className="apv-titulo">Confira a arte do seu pedido</h1>
        <p className="apv-sub">
          Dê uma olhada com atenção nos textos, telefones, cores e medidas. Depois responda abaixo.
        </p>

        <div className="apv-artes">
          {imagens.length === 0 && outros.length === 0 && (
            <p className="apv-vazio">A gráfica ainda não anexou a arte a este link.</p>
          )}
          {imagens.map((a) => (
            <a key={a.id} href={a.url ?? '#'} target="_blank" rel="noreferrer" className="apv-arte">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url ?? ''} alt={a.nome} />
              <span>{a.nome} · toque para ampliar</span>
            </a>
          ))}
          {outros.map((a) => (
            <a
              key={a.id}
              href={a.url ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="apv-arte apv-arte--file"
            >
              <span className="apv-file-ico">{a.mime.includes('pdf') ? 'PDF' : 'arquivo'}</span>
              <span>{a.nome} · toque para abrir</span>
            </a>
          ))}
        </div>

        {respondido ? (
          <div className={`apv-res ${RESULTADO[status as Decisao].classe}`}>
            <div className="apv-res-ico" aria-hidden="true">
              {RESULTADO[status as Decisao].ico}
            </div>
            <div>
              <strong>{RESULTADO[status as Decisao].titulo}</strong>
              {comentEnviado && <p className="apv-res-msg">“{comentEnviado}”</p>}
              <p className="apv-res-meta">
                {respEnviado ? `${respEnviado} · ` : ''}
                {dataHora(quando)}
              </p>
              <p className="apv-res-nota">
                A gráfica já recebeu sua resposta. Pode fechar esta página.
              </p>
            </div>
          </div>
        ) : (
          <div className="apv-acao">
            {modo === null ? (
              <>
                <button
                  type="button"
                  className="apv-btn apv-btn--ok"
                  onClick={() => setModo('aprovado')}
                >
                  Aprovar arte
                </button>
                <div className="apv-acao-sec">
                  <button
                    type="button"
                    className="apv-btn apv-btn--alt"
                    onClick={() => {
                      setModo('alteracao');
                      setErro(null);
                    }}
                  >
                    Solicitar alteração
                  </button>
                  <button
                    type="button"
                    className="apv-btn apv-btn--no"
                    onClick={() => {
                      setModo('recusado');
                      setErro(null);
                    }}
                  >
                    Recusar
                  </button>
                </div>
              </>
            ) : (
              <div className="apv-form">
                <p className="apv-form-tit">
                  {modo === 'aprovado'
                    ? 'Confirmar aprovação da arte?'
                    : modo === 'alteracao'
                      ? 'O que precisa mudar?'
                      : 'Por que está recusando?'}
                </p>

                <label className="apv-lbl">
                  Seu nome (opcional)
                  <input
                    className="apv-input"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Quem está respondendo"
                    maxLength={120}
                  />
                </label>

                {modo !== 'aprovado' && (
                  <label className="apv-lbl">
                    Detalhes
                    <textarea
                      className="apv-input apv-textarea"
                      rows={4}
                      value={texto}
                      onChange={(e) => {
                        setTexto(e.target.value);
                        if (erro) setErro(null);
                      }}
                      placeholder={
                        modo === 'alteracao'
                          ? 'Ex.: trocar o telefone para (79) 99999-0000, deixar o fundo mais escuro.'
                          : 'Conte o motivo para a gráfica entender.'
                      }
                      maxLength={2000}
                    />
                  </label>
                )}

                {modo === 'aprovado' && (
                  <label className="apv-lbl">
                    Observação (opcional)
                    <textarea
                      className="apv-input apv-textarea"
                      rows={2}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder="Algum detalhe que a gráfica deva saber"
                      maxLength={2000}
                    />
                  </label>
                )}

                {erro && <p className="apv-erro">{erro}</p>}

                <div className="apv-form-acoes">
                  <button
                    type="button"
                    className="apv-btn apv-btn--ghost"
                    onClick={() => {
                      setModo(null);
                      setErro(null);
                    }}
                    disabled={enviando}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    className={`apv-btn ${
                      modo === 'aprovado'
                        ? 'apv-btn--ok'
                        : modo === 'alteracao'
                          ? 'apv-btn--alt'
                          : 'apv-btn--no'
                    }`}
                    onClick={() => enviar(modo)}
                    disabled={enviando}
                  >
                    {enviando
                      ? 'Enviando…'
                      : modo === 'aprovado'
                        ? 'Confirmar aprovação'
                        : modo === 'alteracao'
                          ? 'Enviar pedido de alteração'
                          : 'Enviar recusa'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="apv-rodape">
          Enviado por <strong>{empresaNome}</strong> · powered by Print<b>OS</b>
        </p>
      </div>
    </div>
  );
}

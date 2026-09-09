'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Loader2 } from 'lucide-react';

type EmpresaCampos = { nome: string; documento: string; telefone: string; endereco: string };

export default function ContaAcoes({
  userId,
  email,
  ehProprio,
  banido,
  emailConfirmado,
  displayName,
  empresa,
}: {
  userId: string;
  email: string;
  ehProprio: boolean;
  banido: boolean;
  emailConfirmado: boolean;
  displayName: string;
  empresa: EmpresaCampos;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);
  const [link, setLink] = useState<{ rotulo: string; url: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [nome, setNome] = useState(displayName);
  const [emp, setEmp] = useState<EmpresaCampos>(empresa);
  const [confirmaApagar, setConfirmaApagar] = useState('');

  async function acao(nomeAcao: string, extra: Record<string, unknown> = {}) {
    setBusy(nomeAcao);
    setMsg(null);
    setLink(null);
    try {
      const r = await fetch('/api/admin/acao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PrintOS-Admin': '1' },
        body: JSON.stringify({ acao: nomeAcao, userId, ...extra }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setMsg({ tipo: 'err', texto: j.erro || `Falhou (HTTP ${r.status}).` });
      } else {
        setMsg({ tipo: 'ok', texto: j.msg || 'Feito.' });
        if (j.link) setLink({ rotulo: j.linkRotulo || 'Link', url: j.link });
        router.refresh();
      }
    } catch (e) {
      setMsg({ tipo: 'err', texto: String(e) });
    }
    setBusy(null);
  }

  const B = ({ id, children, danger }: { id: string; children: React.ReactNode; danger?: boolean }) => (
    <button
      type="button"
      className={`adm-btn${danger ? ' adm-btn--danger' : ''}`}
      onClick={() => acao(id)}
      disabled={busy !== null}
    >
      {busy === id ? <Loader2 size={14} className="adm-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );

  return (
    <section className="adm-box adm-acoes">
      <h2>Ações</h2>

      {ehProprio && (
        <p className="adm-proprio">Esta é a sua conta — ações de suspensão e exclusão ficam ocultas.</p>
      )}

      <div className="adm-acoes-linha">
        {!ehProprio &&
          (banido ? (
            <B id="desbanir">Reativar acesso</B>
          ) : (
            <B id="banir" danger>Suspender acesso</B>
          ))}
        {!emailConfirmado && <B id="confirmar_email">Confirmar e-mail manualmente</B>}
        <B id="reset_senha">Gerar link de redefinição de senha</B>
        <B id="magiclink">Gerar link de acesso (entrar como)</B>
      </div>

      {link && (
        <div className="adm-link">
          <span>{link.rotulo}:</span>
          <code>{link.url}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(link.url).then(() => setCopiado(true));
            }}
          >
            {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}

      <div className="adm-editbloco">
        <label className="adm-field">
          <span>Nome exibido</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} />
        </label>
        <button
          type="button"
          className="adm-btn"
          disabled={busy !== null || nome.trim() === displayName}
          onClick={() => acao('salvar_nome', { displayName: nome.trim() })}
        >
          Salvar nome
        </button>
      </div>

      <div className="adm-editbloco">
        <div className="adm-editgrid">
          {(['nome', 'documento', 'telefone', 'endereco'] as const).map((k) => (
            <label className="adm-field" key={k}>
              <span>{k === 'nome' ? 'Empresa' : k[0].toUpperCase() + k.slice(1)}</span>
              <input value={emp[k]} onChange={(e) => setEmp({ ...emp, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="adm-btn"
          disabled={busy !== null}
          onClick={() => acao('salvar_empresa', { empresa: emp })}
        >
          Salvar dados da empresa
        </button>
      </div>

      {!ehProprio && (
      <div className="adm-perigo">
        <strong>Apagar conta</strong>
        <p>Remove o login e TODOS os dados desta gráfica. Não tem volta.</p>
        <div className="adm-editbloco">
          <label className="adm-field">
            <span>Digite {email} para confirmar</span>
            <input value={confirmaApagar} onChange={(e) => setConfirmaApagar(e.target.value)} />
          </label>
          <button
            type="button"
            className="adm-btn adm-btn--danger"
            disabled={busy !== null || confirmaApagar.trim().toLowerCase() !== email.toLowerCase()}
            onClick={() => acao('apagar_conta', { confirmacao: confirmaApagar.trim() })}
          >
            Apagar definitivamente
          </button>
        </div>
      </div>
      )}

      {msg && <p className={msg.tipo === 'ok' ? 'adm-msg-ok' : 'adm-msg-err'}>{msg.texto}</p>}
    </section>
  );
}

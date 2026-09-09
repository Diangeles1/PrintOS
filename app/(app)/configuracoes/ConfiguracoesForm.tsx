'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Plus, Smartphone, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type Empresa = {
  user_id: string;
  nome: string | null;
  documento: string | null;
  telefone: string | null;
  endereco: string | null;
  logo_url: string | null;
  orcamento_validade_dias: number;
  orcamento_condicoes: string | null;
};

export type WhatsNumero = { id: string; numero: string; apelido: string | null };

function formataNumero(n: string) {
  const d = n.replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    const resto = d.slice(4);
    return `+55 (${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
  }
  return `+${d}`;
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export default function ConfiguracoesForm({
  userId,
  empresa,
  fallbackNome,
  numeros,
  botNumero,
}: {
  userId: string;
  empresa: Empresa | null;
  fallbackNome: string;
  numeros: WhatsNumero[];
  botNumero: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [novoNum, setNovoNum] = useState('');
  const [novoApelido, setNovoApelido] = useState('');
  const [addingNum, setAddingNum] = useState(false);
  const [numErro, setNumErro] = useState<string | null>(null);

  async function addNumero(e: FormEvent) {
    e.preventDefault();
    const digits = novoNum.replace(/\D/g, '');
    if (!/^[1-9][0-9]{9,15}$/.test(digits)) {
      setNumErro('Número inválido. Use DDI + DDD + número, ex.: 5579999990000.');
      return;
    }
    setNumErro(null);
    setAddingNum(true);
    const { error } = await supabase
      .from('whatsapp_numeros')
      .insert({ numero: digits, apelido: novoApelido.trim() || null });
    setAddingNum(false);
    if (error) {
      setNumErro(
        error.code === '23505'
          ? 'Esse número já está vinculado a uma conta.'
          : `Não foi possível adicionar. ${error.message}`,
      );
      return;
    }
    setNovoNum('');
    setNovoApelido('');
    router.refresh();
  }

  async function removeNumero(id: string) {
    const { error } = await supabase.from('whatsapp_numeros').delete().eq('id', id);
    if (error) {
      window.alert(`Não foi possível remover. ${error.message}`);
      return;
    }
    router.refresh();
  }

  const [nome, setNome] = useState(empresa?.nome ?? fallbackNome);
  const [documento, setDocumento] = useState(empresa?.documento ?? '');
  const [telefone, setTelefone] = useState(empresa?.telefone ?? '');
  const [endereco, setEndereco] = useState(empresa?.endereco ?? '');
  const [validadeDias, setValidadeDias] = useState(
    String(empresa?.orcamento_validade_dias ?? 15),
  );
  const [condicoes, setCondicoes] = useState(empresa?.orcamento_condicoes ?? '');
  const [logoUrl, setLogoUrl] = useState(empresa?.logo_url ?? '');

  const [salvando, setSalvando] = useState(false);
  const [subindoLogo, setSubindoLogo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function caminhoDoUrl(url: string) {
    const parte = url.split('/logos/')[1];
    return parte ? decodeURIComponent(parte.split('?')[0]) : null;
  }

  async function onLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErro(null);
    setMsg(null);
    const ext = EXT[file.type];
    if (!ext) {
      setErro('Use uma imagem PNG, JPG, WEBP ou SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErro('A logo precisa ter no máximo 2 MB.');
      return;
    }
    setSubindoLogo(true);
    const path = `${userId}/logo-${Date.now()}.${ext}`;
    const up = await supabase.storage.from('logos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
    if (up.error) {
      setSubindoLogo(false);
      setErro(`Não foi possível enviar a logo. ${up.error.message}`);
      return;
    }
    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    const anterior = logoUrl ? caminhoDoUrl(logoUrl) : null;
    const save = await supabase.from('empresa').upsert({ user_id: userId, logo_url: data.publicUrl });
    setSubindoLogo(false);
    if (save.error) {
      setErro(`Logo enviada, mas não foi possível salvar. ${save.error.message}`);
      return;
    }
    if (anterior) await supabase.storage.from('logos').remove([anterior]);
    setLogoUrl(data.publicUrl);
    setMsg('Logo atualizada.');
    router.refresh();
  }

  async function removerLogo() {
    if (!logoUrl) return;
    setErro(null);
    setMsg(null);
    const path = caminhoDoUrl(logoUrl);
    const save = await supabase.from('empresa').upsert({ user_id: userId, logo_url: null });
    if (save.error) {
      setErro(`Não foi possível remover. ${save.error.message}`);
      return;
    }
    if (path) await supabase.storage.from('logos').remove([path]);
    setLogoUrl('');
    setMsg('Logo removida.');
    router.refresh();
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    setSalvando(true);
    const { error } = await supabase.from('empresa').upsert({
      user_id: userId,
      nome: nome.trim() || null,
      documento: documento.trim() || null,
      telefone: telefone.trim() || null,
      endereco: endereco.trim() || null,
      orcamento_validade_dias: Math.min(365, Math.max(0, Number(validadeDias) || 0)),
      orcamento_condicoes: condicoes.trim() || null,
    });
    setSalvando(false);
    if (error) {
      setErro(`Não foi possível salvar. ${error.message}`);
      return;
    }
    setMsg('Configurações salvas.');
    router.refresh();
  }

  return (
    <form className="cfg" onSubmit={salvar}>
      <section className="cfg-bloco">
        <h2 className="cfg-h2">Identidade da empresa</h2>
        <p className="cfg-hint">Aparece no cabeçalho dos orçamentos e documentos.</p>

        <div className="cfg-logo-row">
          <div className={`cfg-logo${logoUrl ? '' : ' is-vazio'}`}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo da empresa" />
            ) : (
              <span>Sem logo</span>
            )}
          </div>
          <div className="cfg-logo-acoes">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={onLogo}
            />
            <button
              type="button"
              className="btn secondary"
              onClick={() => fileRef.current?.click()}
              disabled={subindoLogo}
            >
              {subindoLogo ? (
                <Loader2 size={16} className="cl-spin" aria-hidden="true" />
              ) : (
                <ImagePlus size={16} aria-hidden="true" />
              )}
              {logoUrl ? 'Trocar logo' : 'Enviar logo'}
            </button>
            {logoUrl && (
              <button type="button" className="cfg-logo-remover" onClick={removerLogo}>
                <Trash2 size={14} aria-hidden="true" />
                Remover
              </button>
            )}
            <span className="cfg-logo-dica">PNG, JPG, WEBP ou SVG · até 2 MB</span>
          </div>
        </div>

        <div className="cfg-grid">
          <label className="cl-field">
            <span className="cl-label">Nome da empresa</span>
            <input className="cl-input" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="cl-field">
            <span className="cl-label">CNPJ / CPF</span>
            <input
              className="cl-input"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
            />
          </label>
          <label className="cl-field">
            <span className="cl-label">Telefone</span>
            <input
              className="cl-input"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </label>
          <label className="cl-field cfg-col2">
            <span className="cl-label">Endereço</span>
            <input
              className="cl-input"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro, cidade"
            />
          </label>
        </div>
      </section>

      <section className="cfg-bloco">
        <h2 className="cfg-h2">Padrão dos orçamentos</h2>
        <p className="cfg-hint">Usado ao criar um novo orçamento.</p>

        <div className="cfg-grid">
          <label className="cl-field">
            <span className="cl-label">Validade padrão (dias)</span>
            <input
              className="cl-input"
              type="number"
              min="0"
              max="365"
              value={validadeDias}
              onChange={(e) => setValidadeDias(e.target.value)}
            />
          </label>
          <label className="cl-field cfg-col2">
            <span className="cl-label">Condições padrão</span>
            <textarea
              className="cl-input cl-textarea"
              rows={4}
              value={condicoes}
              onChange={(e) => setCondicoes(e.target.value)}
              placeholder="Ex.: Prazo de entrega de 5 dias úteis. Pagamento: 50% na aprovação, 50% na entrega."
            />
          </label>
        </div>
      </section>

      <section className="cfg-bloco">
        <h2 className="cfg-h2">
          <Smartphone size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />
          Pedidos pelo WhatsApp
        </h2>
        <p className="cfg-hint">
          Encaminhe a mensagem do cliente para o número do PrintOS. O bot monta o pedido e você
          confirma com um toque — ele não conversa com o cliente.
        </p>

        {botNumero ? (
          <p className="cfg-bot">
            Contato do bot: <strong>{formataNumero(botNumero)}</strong> — salve nos contatos e
            encaminhe os pedidos.
          </p>
        ) : (
          <p className="cfg-bot cfg-bot--off">
            Número do bot ainda não configurado (variável <code>NEXT_PUBLIC_WHATSAPP_BOT_NUMERO</code>).
          </p>
        )}

        <div className="cfg-nums">
          {numeros.length === 0 && (
            <p className="cfg-nums-vazio">Nenhum número vinculado ainda.</p>
          )}
          {numeros.map((n) => (
            <div className="cfg-num" key={n.id}>
              <span className="cfg-num-info">
                <strong>{formataNumero(n.numero)}</strong>
                {n.apelido && <small>{n.apelido}</small>}
              </span>
              <button
                type="button"
                className="cfg-num-x"
                aria-label={`Remover ${n.numero}`}
                onClick={() => removeNumero(n.id)}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <div className="cfg-num-add">
          <input
            className="cl-input"
            value={novoNum}
            onChange={(e) => {
              setNovoNum(e.target.value);
              if (numErro) setNumErro(null);
            }}
            placeholder="55 79 99999-0000"
            inputMode="tel"
          />
          <input
            className="cl-input"
            value={novoApelido}
            onChange={(e) => setNovoApelido(e.target.value)}
            placeholder="Apelido (ex.: Balcão, Maria)"
          />
          <button
            type="button"
            className="btn secondary"
            onClick={addNumero}
            disabled={addingNum}
          >
            {addingNum ? (
              <Loader2 size={16} className="cl-spin" aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}
            Vincular
          </button>
        </div>
        {numErro && <p className="cl-form-err" style={{ marginTop: 8 }}>{numErro}</p>}
      </section>

      {erro && <p className="cl-form-err">{erro}</p>}
      {msg && (
        <p className="login-mensagem" style={{ fontSize: 13 }}>
          {msg}
        </p>
      )}

      <div className="cfg-acoes">
        <button type="submit" className="btn" disabled={salvando}>
          {salvando ? (
            <>
              <Loader2 size={16} className="cl-spin" aria-hidden="true" />
              Salvando…
            </>
          ) : (
            'Salvar configurações'
          )}
        </button>
      </div>
    </form>
  );
}

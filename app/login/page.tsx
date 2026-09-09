'use client';

import { useState, useEffect, FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Manrope } from 'next/font/google';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  ShieldCheck,
  CloudUpload,
  SlidersHorizontal,
  Package,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--pl-font',
  display: 'swap',
});

type Modo = 'entrar' | 'cadastro' | 'recuperar';
type Provedor = 'google' | 'azure';
type Erros = { email?: string; senha?: string; empresa?: string; nome?: string; geral?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEATURES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <CloudUpload size={20} strokeWidth={2} />,
    title: 'Envie',
    desc: 'Seus arquivos e provas digitais.',
  },
  {
    icon: <SlidersHorizontal size={20} strokeWidth={2} />,
    title: 'Acompanhe',
    desc: 'Sua produção em tempo real.',
  },
  {
    icon: <Package size={20} strokeWidth={2} />,
    title: 'Receba',
    desc: 'Seus pedidos organizados até a entrega.',
  },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="pl-wm-name">
        Print<span className="pl-os">OS</span>
      </span>
      <i className="pl-sq" aria-hidden="true" />
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [manterConectado, setManterConectado] = useState(true);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [oauth, setOauth] = useState<Provedor | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [mensagem, setMensagem] = useState<string | null>(null);

  const ocupado = carregando || oauth !== null;

  // O login social leva o usuário para fora da página. Se ele voltar pelo
  // botão "voltar" do navegador (bfcache) ou reabrir a aba, o estado de
  // carregamento continuaria travado e bloquearia o formulário — aqui a
  // gente limpa esse estado quando a página volta a ficar visível.
  useEffect(() => {
    // Callback do OAuth voltou com falha na troca do code por sessão.
    const params = new URLSearchParams(window.location.search);
    if (params.get('erro') === 'oauth') {
      setErros({ geral: 'Não foi possível concluir o login com o provedor. Tente novamente.' });
      window.history.replaceState(null, '', window.location.pathname);
    }

    const destravar = () => {
      setOauth(null);
      setCarregando(false);
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) destravar();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') destravar();
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  function limpar(campo: keyof Erros) {
    setErros((prev) => {
      if (!prev[campo] && !prev.geral) return prev;
      const next = { ...prev };
      delete next[campo];
      delete next.geral;
      return next;
    });
  }

  function irPara(novoModo: Modo) {
    setModo(novoModo);
    setErros({});
    setMensagem(null);
    setMostrarSenha(false);
  }

  async function handleEntrar(e: FormEvent) {
    e.preventDefault();
    setMensagem(null);
    const next: Erros = {};
    if (!email.trim()) next.email = 'Informe seu e-mail.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Digite um e-mail válido.';
    if (!senha) next.senha = 'Informe sua senha.';
    setErros(next);
    if (Object.keys(next).length) return;

    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setCarregando(false);
    if (error) {
      setErros({ geral: 'E-mail ou senha inválidos.' });
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  async function handleCriarConta(e: FormEvent) {
    e.preventDefault();
    setMensagem(null);
    const next: Erros = {};
    if (!nomeEmpresa.trim()) next.empresa = 'Informe o nome da sua gráfica.';
    if (!nomeCompleto.trim()) next.nome = 'Informe seu nome.';
    if (!email.trim()) next.email = 'Informe seu e-mail.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Digite um e-mail válido.';
    if (senha.length < 8) next.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    setErros(next);
    if (Object.keys(next).length) return;

    setCarregando(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { company_name: nomeEmpresa, full_name: nomeCompleto } },
    });
    setCarregando(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setErros({ geral: 'Não foi possível concluir o cadastro com esses dados.' });
      } else {
        setErros({ geral: error.message });
      }
      return;
    }
    setMensagem('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
    irPara('entrar');
  }

  async function handleRecuperar(e: FormEvent) {
    e.preventDefault();
    setMensagem(null);
    const next: Erros = {};
    if (!email.trim()) next.email = 'Informe seu e-mail.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Digite um e-mail válido.';
    setErros(next);
    if (Object.keys(next).length) return;

    setCarregando(true);
    // Passa pelo /auth/callback para trocar o code por sessão (fluxo PKCE)
    // antes de cair na tela de nova senha.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });
    setCarregando(false);
    setMensagem('Se esse e-mail existir, enviamos um link de recuperação.');
  }

  async function handleOAuth(provider: Provedor) {
    setErros({});
    setMensagem(null);
    setOauth(provider);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (error || !data?.url) {
      setOauth(null);
      setErros({
        geral: 'Não foi possível iniciar o login com esse provedor. Verifique se ele está habilitado.',
      });
      return;
    }
    // Em caso de sucesso o navegador é redirecionado para o provedor.
    // Se em alguns segundos isso não acontecer, destrava o botão.
    window.setTimeout(() => setOauth(null), 8000);
  }

  const titulo =
    modo === 'entrar'
      ? 'Bem-vindo de volta!'
      : modo === 'cadastro'
        ? 'Criar sua conta'
        : 'Recuperar senha';

  const subtitulo =
    modo === 'entrar'
      ? 'Acesse sua conta e continue acompanhando suas produções, aprovações e pedidos.'
      : modo === 'cadastro'
        ? 'Leva menos de um minuto para começar a organizar sua gráfica.'
        : 'Enviaremos um link de redefinição para o seu e-mail cadastrado.';

  return (
    <div className={`pl-root ${manrope.variable}`}>
      <div className="pl-bg" aria-hidden="true">
        <div className="pl-dots" />
        <div className="pl-shape pl-shape-1" />
        <div className="pl-shape pl-shape-2" />
        <div className="pl-shape pl-shape-3" />
      </div>

      <div className="pl-stage" aria-hidden="true">
        <span className="pl-stage-mono">P</span>
        <span className="pl-stage-glow" />
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/printos-mascote.png"
        alt=""
        aria-hidden="true"
        className="pl-mascot"
      />

      <aside className="pl-left">
        <div className="pl-left-top">
          <Wordmark className="pl-brand" />
          <p className="pl-eyebrow">Central do cliente</p>
          <span className="pl-rule" aria-hidden="true" />
        </div>

        <div className="pl-left-mid">
          <h1 className="pl-headline">
            Do arquivo à entrega.
            <br />
            <span className="pl-accent">Tudo</span> em um só lugar.
          </h1>
          <p className="pl-subhead">
            Mais controle, mais agilidade e mais resultados para o seu negócio.
          </p>

          <ul className="pl-features">
            {FEATURES.map((f) => (
              <li className="pl-feature" key={f.title}>
                <span className="pl-feature-ico">{f.icon}</span>
                <span className="pl-feature-text">
                  <span className="pl-feature-title">{f.title}</span>
                  <span className="pl-feature-desc">{f.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pl-foot-l" aria-hidden="true">
          <strong>PrintOS</strong>
          <span>Central do Cliente</span>
          <span>Do arquivo à entrega.</span>
        </div>
      </aside>

      <p className="pl-foot-r" aria-hidden="true">
        Mais que impressões. Parcerias de verdade.
        <span className="pl-foot-dash" />
      </p>

      <main className="pl-right">
        <div className="pl-mobile-logo">
          <Wordmark className="pl-brand pl-brand-mobile" />
        </div>

        <div className="pl-card">
          <header className="pl-card-head">
            <Wordmark className="pl-card-logo" />
            {modo === 'entrar' && (
              <div className="pl-card-head-right">
                <span>Novo por aqui?</span>
                <button type="button" className="pl-btn-ghost" onClick={() => irPara('cadastro')}>
                  Criar conta
                </button>
              </div>
            )}
            {modo !== 'entrar' && (
              <div className="pl-card-head-right">
                <span>Já tem conta?</span>
                <button type="button" className="pl-btn-ghost" onClick={() => irPara('entrar')}>
                  Entrar
                </button>
              </div>
            )}
          </header>

          <h2 className="pl-card-title">{titulo}</h2>
          <p className="pl-card-sub">{subtitulo}</p>

          {erros.geral && <p className="pl-alert">{erros.geral}</p>}
          {mensagem && <p className="pl-note">{mensagem}</p>}

          {modo === 'entrar' && (
            <form className="pl-form" onSubmit={handleEntrar} noValidate>
              <div className="pl-field">
                <label className="pl-label" htmlFor="pl-email">
                  E-mail
                </label>
                <div className="pl-input-wrap">
                  <Mail className="pl-input-ico" size={18} aria-hidden="true" />
                  <input
                    id="pl-email"
                    className={`pl-input ${erros.email ? 'is-error' : ''}`}
                    type="email"
                    autoComplete="email"
                    placeholder="seu@e-mail.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); limpar('email'); }}
                  />
                </div>
                {erros.email && <p className="pl-field-err">{erros.email}</p>}
              </div>

              <div className="pl-field">
                <div className="pl-label pl-label-row">
                  <label htmlFor="pl-senha">Senha</label>
                  <button type="button" className="pl-forgot" onClick={() => irPara('recuperar')}>
                    Esqueceu sua senha?
                  </button>
                </div>
                <div className="pl-input-wrap">
                  <Lock className="pl-input-ico" size={18} aria-hidden="true" />
                  <input
                    id="pl-senha"
                    className={`pl-input ${erros.senha ? 'is-error' : ''}`}
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    value={senha}
                    onChange={(e) => { setSenha(e.target.value); limpar('senha'); }}
                  />
                  <button
                    type="button"
                    className="pl-eye"
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {erros.senha && <p className="pl-field-err">{erros.senha}</p>}
              </div>

              <label className="pl-check">
                <input
                  type="checkbox"
                  checked={manterConectado}
                  onChange={(e) => setManterConectado(e.target.checked)}
                />
                <span>Manter-me conectado</span>
              </label>

              <button type="submit" className="pl-submit" disabled={ocupado}>
                {carregando ? (
                  <>
                    <Loader2 size={18} className="pl-spin" aria-hidden="true" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn size={18} aria-hidden="true" />
                    Entrar
                  </>
                )}
              </button>

              <div className="pl-or">ou</div>

              <div className="pl-social">
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={ocupado}
                >
                  {oauth === 'google' ? (
                    <Loader2 size={16} className="pl-spin" aria-hidden="true" />
                  ) : (
                    <GoogleIcon />
                  )}
                  Entrar com o Google
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth('azure')}
                  disabled={ocupado}
                >
                  {oauth === 'azure' ? (
                    <Loader2 size={16} className="pl-spin" aria-hidden="true" />
                  ) : (
                    <MicrosoftIcon />
                  )}
                  Entrar com a Microsoft
                </button>
              </div>
            </form>
          )}

          {modo === 'cadastro' && (
            <form className="pl-form" onSubmit={handleCriarConta} noValidate>
              <div className="pl-field">
                <label className="pl-label" htmlFor="pl-empresa">
                  Nome da gráfica
                </label>
                <div className="pl-input-wrap">
                  <input
                    id="pl-empresa"
                    className={`pl-input pl-input-plain ${erros.empresa ? 'is-error' : ''}`}
                    placeholder="Ex.: Gráfica Rápida"
                    value={nomeEmpresa}
                    onChange={(e) => { setNomeEmpresa(e.target.value); limpar('empresa'); }}
                  />
                </div>
                {erros.empresa && <p className="pl-field-err">{erros.empresa}</p>}
              </div>

              <div className="pl-field">
                <label className="pl-label" htmlFor="pl-nome">
                  Seu nome
                </label>
                <div className="pl-input-wrap">
                  <input
                    id="pl-nome"
                    className={`pl-input pl-input-plain ${erros.nome ? 'is-error' : ''}`}
                    placeholder="Nome e sobrenome"
                    value={nomeCompleto}
                    onChange={(e) => { setNomeCompleto(e.target.value); limpar('nome'); }}
                  />
                </div>
                {erros.nome && <p className="pl-field-err">{erros.nome}</p>}
              </div>

              <div className="pl-field">
                <label className="pl-label" htmlFor="pl-email-c">
                  E-mail
                </label>
                <div className="pl-input-wrap">
                  <Mail className="pl-input-ico" size={18} aria-hidden="true" />
                  <input
                    id="pl-email-c"
                    className={`pl-input ${erros.email ? 'is-error' : ''}`}
                    type="email"
                    autoComplete="email"
                    placeholder="seu@e-mail.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); limpar('email'); }}
                  />
                </div>
                {erros.email && <p className="pl-field-err">{erros.email}</p>}
              </div>

              <div className="pl-field">
                <label className="pl-label" htmlFor="pl-senha-c">
                  Senha
                </label>
                <div className="pl-input-wrap">
                  <Lock className="pl-input-ico" size={18} aria-hidden="true" />
                  <input
                    id="pl-senha-c"
                    className={`pl-input ${erros.senha ? 'is-error' : ''}`}
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Mínimo de 8 caracteres"
                    value={senha}
                    onChange={(e) => { setSenha(e.target.value); limpar('senha'); }}
                  />
                  <button
                    type="button"
                    className="pl-eye"
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {erros.senha && <p className="pl-field-err">{erros.senha}</p>}
              </div>

              <button type="submit" className="pl-submit" disabled={ocupado}>
                {carregando ? (
                  <>
                    <Loader2 size={18} className="pl-spin" aria-hidden="true" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <LogIn size={18} aria-hidden="true" />
                    Criar conta
                  </>
                )}
              </button>
            </form>
          )}

          {modo === 'recuperar' && (
            <form className="pl-form" onSubmit={handleRecuperar} noValidate>
              <div className="pl-field">
                <label className="pl-label" htmlFor="pl-email-r">
                  E-mail
                </label>
                <div className="pl-input-wrap">
                  <Mail className="pl-input-ico" size={18} aria-hidden="true" />
                  <input
                    id="pl-email-r"
                    className={`pl-input ${erros.email ? 'is-error' : ''}`}
                    type="email"
                    autoComplete="email"
                    placeholder="seu@e-mail.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); limpar('email'); }}
                  />
                </div>
                {erros.email && <p className="pl-field-err">{erros.email}</p>}
              </div>

              <button type="submit" className="pl-submit" disabled={ocupado}>
                {carregando ? (
                  <>
                    <Loader2 size={18} className="pl-spin" aria-hidden="true" />
                    Enviando...
                  </>
                ) : (
                  'Enviar link de recuperação'
                )}
              </button>
            </form>
          )}
        </div>

        <p className="pl-secure">
          <ShieldCheck size={14} aria-hidden="true" />
          Seus dados estão seguros conosco.
        </p>
      </main>
    </div>
  );
}

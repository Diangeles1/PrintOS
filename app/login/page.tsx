'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Manrope, IBM_Plex_Mono } from 'next/font/google';
import { createClient } from '@/lib/supabase/client';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--lp-font-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--lp-font-mono',
  display: 'swap',
});

type Modo = 'entrar' | 'cadastro' | 'recuperar';
type Intro = 'hold' | 'play' | 'idle' | 'reduced';

const FEATURES = [
  'Envio de arquivos com pré-checagem automática',
  'Aprovação de prova digital em minutos',
  'Acompanhamento da produção em tempo real',
];

function Wordmark({ tone }: { tone: 'light' | 'dark' }) {
  return (
    <span className={`lp-wm lp-wm--${tone}`}>
      <span className="lp-wm-text">
        Print<span>OS</span>
      </span>
      <span className="lp-wm-dots" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
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
  const [lembrar, setLembrar] = useState(true);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [intro, setIntro] = useState<Intro>('hold');

  const emailRef = useRef<HTMLInputElement>(null);

  // Replica a introdução do design: anima uma vez por navegador, respeita
  // "prefers-reduced-motion" e foca o campo de e-mail quando a cena assenta.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let seen = false;
    try {
      seen = localStorage.getItem('printos.intro.seen') === '1';
    } catch {
      seen = false;
    }
    const fase: Intro = reduce ? 'reduced' : seen ? 'idle' : 'play';
    setIntro(fase);
    if (!reduce) {
      try {
        localStorage.setItem('printos.intro.seen', '1');
      } catch {
        /* armazenamento indisponível — segue sem persistir */
      }
    }
    const t = window.setTimeout(
      () => emailRef.current?.focus({ preventScroll: true }),
      fase === 'play' ? 1500 : 200,
    );
    return () => window.clearTimeout(t);
  }, []);

  function trocarModo(novoModo: Modo) {
    setModo(novoModo);
    setErro(null);
    setMensagem(null);
  }

  async function handleEntrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro('E-mail ou senha inválidos.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  async function handleCriarConta(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    if (!nomeEmpresa.trim()) {
      setErro('Informe o nome da sua gráfica.');
      return;
    }
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { company_name: nomeEmpresa, full_name: nomeCompleto } },
    });
    setCarregando(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setErro('Não foi possível concluir o cadastro com esses dados.');
      } else {
        setErro(error.message);
      }
      return;
    }
    setMensagem('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
    trocarModo('entrar');
  }

  async function handleRecuperar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    setCarregando(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setCarregando(false);
    setMensagem('Se esse e-mail existir, enviamos um link de recuperação.');
  }

  const introClass =
    intro === 'play'
      ? 'is-play'
      : intro === 'idle'
        ? 'is-idle'
        : intro === 'reduced'
          ? 'is-reduced'
          : '';

  return (
    <div className={`lp-root ${manrope.variable} ${plexMono.variable} ${introClass}`}>
      <div className="lp-bg" aria-hidden="true" />
      <div className="lp-halftone" aria-hidden="true" />
      <div className="lp-rings" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="lp-cutmarks" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="lp-fade" aria-hidden="true" />

      <div className="lp-shell">
        <section className="lp-intro">
          <header className="lp-topbar">
            <Wordmark tone="light" />
            <span className="lp-topbar-divider" aria-hidden="true" />
            <span className="lp-kicker">Central do cliente</span>
          </header>

          <div className="lp-lede">
            <p className="lp-eyebrow">
              <span aria-hidden="true" />
              Portal do cliente
            </p>
            <h2>Do arquivo à entrega, tudo em um só lugar.</h2>
            <ul className="lp-features">
              {FEATURES.map((feature) => (
                <li key={feature}>
                  <span aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="lp-mascot" aria-hidden="true">
          <div className="lp-mascot-glow" />
          <div className="lp-mascot-float">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/printos-mascote.png" alt="" className="lp-mascot-img" />
          </div>
        </div>

        <section className="lp-panel">
          <div className="lp-card">
            <span className="lp-card-bar" aria-hidden="true" />
            <span className="lp-card-scan" aria-hidden="true" />

            <div className="lp-card-brand">
              <Wordmark tone="dark" />
            </div>

            {modo === 'entrar' && (
              <>
                <h1 className="lp-card-title">Bem-vindo</h1>
                <p className="lp-card-text">
                  Acesse sua conta para enviar arquivos, aprovar provas e acompanhar cada
                  pedido.
                </p>

                <form className="lp-form" onSubmit={handleEntrar}>
                  <label className="lp-field">
                    <span className="lp-label">E-mail</span>
                    <input
                      ref={emailRef}
                      className="lp-input"
                      type="email"
                      autoComplete="email"
                      placeholder="nome@empresa.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </label>

                  <label className="lp-field">
                    <span className="lp-label lp-label--row">
                      <span>Senha</span>
                      <button
                        type="button"
                        className="lp-reveal"
                        onClick={() => setMostrarSenha((v) => !v)}
                      >
                        {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </span>
                    <input
                      className="lp-input"
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                      minLength={8}
                    />
                  </label>

                  <div className="lp-row">
                    <label className="lp-check">
                      <input
                        type="checkbox"
                        checked={lembrar}
                        onChange={(e) => setLembrar(e.target.checked)}
                      />
                      <span>Lembrar de mim</span>
                    </label>
                    <button
                      type="button"
                      className="lp-inline-link"
                      onClick={() => trocarModo('recuperar')}
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  {erro && <p className="login-erro">{erro}</p>}
                  {mensagem && <p className="login-mensagem">{mensagem}</p>}

                  <button type="submit" className="lp-submit" disabled={carregando}>
                    {carregando ? 'Entrando…' : 'Entrar'}
                  </button>
                </form>

                <div className="lp-card-foot">
                  <span>Ainda não tem acesso?</span>
                  <button
                    type="button"
                    className="lp-inline-link"
                    onClick={() => trocarModo('cadastro')}
                  >
                    Solicitar cadastro
                  </button>
                </div>
              </>
            )}

            {modo === 'cadastro' && (
              <>
                <h1 className="lp-card-title">Solicitar cadastro</h1>
                <p className="lp-card-text">Leva menos de um minuto.</p>

                <form className="lp-form" onSubmit={handleCriarConta}>
                  <label className="lp-field">
                    <span className="lp-label">Nome da gráfica</span>
                    <input
                      className="lp-input"
                      value={nomeEmpresa}
                      onChange={(e) => setNomeEmpresa(e.target.value)}
                      placeholder="Ex.: Gráfica Rápida"
                      required
                    />
                  </label>

                  <label className="lp-field">
                    <span className="lp-label">Seu nome</span>
                    <input
                      className="lp-input"
                      value={nomeCompleto}
                      onChange={(e) => setNomeCompleto(e.target.value)}
                      placeholder="Nome e sobrenome"
                      required
                    />
                  </label>

                  <label className="lp-field">
                    <span className="lp-label">E-mail</span>
                    <input
                      className="lp-input"
                      type="email"
                      autoComplete="email"
                      placeholder="nome@empresa.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </label>

                  <label className="lp-field">
                    <span className="lp-label lp-label--row">
                      <span>Senha</span>
                      <button
                        type="button"
                        className="lp-reveal"
                        onClick={() => setMostrarSenha((v) => !v)}
                      >
                        {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </span>
                    <input
                      className="lp-input"
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Mínimo de 8 caracteres"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                      minLength={8}
                    />
                  </label>

                  {erro && <p className="login-erro">{erro}</p>}
                  {mensagem && <p className="login-mensagem">{mensagem}</p>}

                  <button type="submit" className="lp-submit" disabled={carregando}>
                    {carregando ? 'Enviando…' : 'Criar conta'}
                  </button>
                </form>

                <div className="lp-card-foot">
                  <span>Já tem acesso?</span>
                  <button
                    type="button"
                    className="lp-inline-link"
                    onClick={() => trocarModo('entrar')}
                  >
                    Entrar
                  </button>
                </div>
              </>
            )}

            {modo === 'recuperar' && (
              <>
                <h1 className="lp-card-title">Recuperar senha</h1>
                <p className="lp-card-text">Enviamos um link pro seu e-mail cadastrado.</p>

                <form className="lp-form" onSubmit={handleRecuperar}>
                  <label className="lp-field">
                    <span className="lp-label">E-mail</span>
                    <input
                      className="lp-input"
                      type="email"
                      autoComplete="email"
                      placeholder="nome@empresa.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </label>

                  {mensagem && <p className="login-mensagem">{mensagem}</p>}

                  <button type="submit" className="lp-submit" disabled={carregando}>
                    {carregando ? 'Enviando…' : 'Enviar link de recuperação'}
                  </button>
                </form>

                <div className="lp-card-foot lp-card-foot--center">
                  <button
                    type="button"
                    className="lp-inline-link"
                    onClick={() => trocarModo('entrar')}
                  >
                    Voltar para o login
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="lp-tagline">Sua próxima impressão começa aqui.</p>
        </section>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Modo = 'entrar' | 'criar-conta' | 'recuperar';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  // Controla a folha animada. Some sozinha depois da animação terminar
  // (removida do DOM, não só escondida) pra nunca atrapalhar cliques.
  const [showSheet, setShowSheet] = useState(true);

  useEffect(() => {
    const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tempo = reduzMovimento ? 0 : 1300;
    const t = setTimeout(() => setShowSheet(false), tempo);
    return () => clearTimeout(t);
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
      options: {
        data: { company_name: nomeEmpresa, full_name: nomeCompleto },
      },
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

  return (
    <div className="login-hero">
      <div className="login-hero-inner">
        {showSheet && (
          <div className="sheet-reveal" aria-hidden="true">
            <div className="sheet-paper">
              <div className="sheet-fold" />
              <div className="sheet-line" style={{ width: '55%' }} />
              <div className="sheet-line" style={{ width: '85%' }} />
              <div className="sheet-line" style={{ width: '40%' }} />
            </div>

            <svg className="sheet-character" viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
              {/* sombra de contato */}
              <ellipse cx="103" cy="252" rx="38" ry="6" fill="#0f172a" opacity="0.12" />

              {/* pernas */}
              <rect x="78" y="188" width="20" height="52" rx="9" fill="#1e293b" />
              <rect x="104" y="188" width="20" height="52" rx="9" fill="#1e293b" />
              <ellipse cx="88" cy="242" rx="15" ry="7" fill="#0f172a" />
              <ellipse cx="114" cy="242" rx="15" ry="7" fill="#0f172a" />

              {/* braço de apoio (parado) */}
              <line x1="132" y1="140" x2="150" y2="172" stroke="#f2c29b" strokeWidth="16" strokeLinecap="round" />
              <circle cx="152" cy="176" r="10" fill="#f2c29b" />

              {/* corpo / camisa */}
              <rect x="62" y="112" width="82" height="88" rx="26" fill="#dbeafe" />

              {/* avental */}
              <rect x="74" y="122" width="58" height="70" rx="13" fill="#2563eb" />
              <rect x="88" y="156" width="30" height="20" rx="5" fill="#1d4ed8" />
              <line x1="98" y1="152" x2="105" y2="138" stroke="#1d4ed8" strokeWidth="4" strokeLinecap="round" />
              <line x1="76" y1="124" x2="66" y2="104" stroke="#1d4ed8" strokeWidth="6" strokeLinecap="round" />
              <line x1="130" y1="124" x2="140" y2="104" stroke="#1d4ed8" strokeWidth="6" strokeLinecap="round" />

              {/* braço esticado puxando a folha */}
              <line x1="70" y1="138" x2="28" y2="92" stroke="#f2c29b" strokeWidth="16" strokeLinecap="round" />
              <circle cx="24" cy="86" r="11" fill="#f2c29b" />

              {/* cabeça */}
              <circle cx="103" cy="80" r="33" fill="#f2c29b" />
              <ellipse cx="103" cy="58" rx="33" ry="19" fill="#2d1b12" />

              {/* óculos */}
              <circle cx="91" cy="82" r="9" fill="none" stroke="#1e293b" strokeWidth="2.5" />
              <circle cx="115" cy="82" r="9" fill="none" stroke="#1e293b" strokeWidth="2.5" />
              <line x1="100" y1="82" x2="106" y2="82" stroke="#1e293b" strokeWidth="2.5" />
              <circle cx="91" cy="82" r="2.5" fill="#1e293b" />
              <circle cx="115" cy="82" r="2.5" fill="#1e293b" />

              {/* sorriso */}
              <path d="M89 96 Q103 106 117 96" stroke="#8a5a3d" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        )}

        <div className="login-container">
          <h1 className="login-brand">
            Print<span>OS</span>
          </h1>

          {modo !== 'recuperar' && (
            <>
              <div className="login-tabs">
                <button type="button" onClick={() => trocarModo('entrar')} disabled={modo === 'entrar'}>
                  Entrar
                </button>
                <button type="button" onClick={() => trocarModo('criar-conta')} disabled={modo === 'criar-conta'}>
                  Criar conta
                </button>
              </div>

              <form onSubmit={modo === 'entrar' ? handleEntrar : handleCriarConta}>
                {modo === 'criar-conta' && (
                  <>
                    <label>
                      Nome da gráfica
                      <input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required />
                    </label>
                    <label>
                      Seu nome
                      <input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} required />
                    </label>
                  </>
                )}

                <label>
                  E-mail
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>

                <label>
                  Senha
                  <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} />
                </label>

                {erro && <p className="login-erro">{erro}</p>}
                {mensagem && <p className="login-mensagem">{mensagem}</p>}

                <button type="submit" disabled={carregando}>
                  {carregando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
                </button>

                {modo === 'entrar' && (
                  <button type="button" className="link-btn" onClick={() => trocarModo('recuperar')}>
                    Esqueceu a senha?
                  </button>
                )}
              </form>
            </>
          )}

          {modo === 'recuperar' && (
            <form onSubmit={handleRecuperar}>
              <label>
                E-mail
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>

              {mensagem && <p className="login-mensagem">{mensagem}</p>}

              <button type="submit" disabled={carregando}>
                {carregando ? 'Aguarde...' : 'Enviar link de recuperação'}
              </button>

              <button type="button" className="link-btn" onClick={() => trocarModo('entrar')}>
                Voltar para o login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

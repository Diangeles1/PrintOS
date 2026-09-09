'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Manrope } from 'next/font/google';
import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--pl-font',
  display: 'swap',
});

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.');
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setCarregando(false);
    if (error) {
      setErro('Não foi possível redefinir a senha. O link pode ter expirado. Solicite um novo.');
      return;
    }
    setSucesso(true);
    setTimeout(() => router.push('/dashboard'), 1800);
  }

  return (
    <div className={`bv-root ${manrope.variable}`}>
      <div className="bv-card">
        <p className="bv-eyebrow">PrintOS</p>

        {sucesso ? (
          <>
            <div className="bv-ok-ico" aria-hidden="true">
              <Check size={22} strokeWidth={3} />
            </div>
            <h1 className="bv-title">Senha atualizada!</h1>
            <p className="bv-sub">Você já pode entrar. Levando você para o painel…</p>
          </>
        ) : (
          <>
            <h1 className="bv-title">Criar nova senha</h1>
            <p className="bv-sub">Escolha uma senha com pelo menos 8 caracteres.</p>

            <form onSubmit={handleSubmit}>
              <div className="bv-inwrap">
                <Lock className="bv-inico" size={17} aria-hidden="true" />
                <input
                  className="bv-input bv-input--ico"
                  type={mostrar ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Nova senha"
                  value={novaSenha}
                  onChange={(e) => {
                    setNovaSenha(e.target.value);
                    if (erro) setErro(null);
                  }}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="bv-eye"
                  onClick={() => setMostrar((v) => !v)}
                  aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrar ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <div className="bv-inwrap" style={{ marginTop: 10 }}>
                <Lock className="bv-inico" size={17} aria-hidden="true" />
                <input
                  className="bv-input bv-input--ico"
                  type={mostrar ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Confirmar nova senha"
                  value={confirmar}
                  onChange={(e) => {
                    setConfirmar(e.target.value);
                    if (erro) setErro(null);
                  }}
                  required
                  minLength={8}
                />
              </div>

              {erro && <p className="bv-err">{erro}</p>}

              <button type="submit" className="bv-btn" disabled={carregando}>
                {carregando ? (
                  <>
                    <Loader2 size={18} className="bv-spin" aria-hidden="true" />
                    Salvando…
                  </>
                ) : (
                  <>
                    Salvar nova senha
                    <ArrowRight size={18} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
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
      setErro('Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.');
      return;
    }
    setSucesso(true);
    setTimeout(() => router.push('/dashboard'), 2000);
  }

  if (sucesso) {
    return (
      <div className="login-container">
        <h1>Senha atualizada!</h1>
        <p>Redirecionando para o painel...</p>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h1>Nova senha</h1>
      <form onSubmit={handleSubmit}>
        <label>Nova senha
          <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required minLength={8} />
        </label>
        <label>Confirmar nova senha
          <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={8} />
        </label>
        {erro && <p className="login-erro">{erro}</p>}
        <button type="submit" disabled={carregando}>
          {carregando ? 'Aguarde...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
}

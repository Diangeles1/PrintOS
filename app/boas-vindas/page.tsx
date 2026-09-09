'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Manrope } from 'next/font/google';
import { ArrowRight, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--pl-font',
  display: 'swap',
});

export default function BoasVindasPage() {
  const router = useRouter();
  const supabase = createClient();

  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quem já tem nome não deveria ver esta tela — o proxy cobre isso, mas
  // aqui a gente pré-preenche com o nome que o cadastro/provedor já trouxe.
  useEffect(() => {
    let ativo = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!ativo) return;
      const md = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      if (typeof md.display_name === 'string' && md.display_name.trim()) {
        router.replace('/dashboard');
        return;
      }
      const sugestao =
        (typeof md.full_name === 'string' && md.full_name) ||
        (typeof md.name === 'string' && md.name) ||
        '';
      if (sugestao) setNome(sugestao);
    });
    return () => {
      ativo = false;
    };
  }, [router, supabase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const limpo = nome.trim().replace(/\s+/g, ' ');
    if (limpo.length < 2) {
      setErro('Digite pelo menos 2 caracteres.');
      return;
    }
    setErro(null);
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ data: { display_name: limpo } });
    if (error) {
      setCarregando(false);
      setErro('Não foi possível salvar agora. Tente novamente.');
      return;
    }
    // Navegação "dura" para garantir que o proxy leia o token já atualizado.
    window.location.assign('/dashboard');
  }

  return (
    <div className={`bv-root ${manrope.variable}`}>
      <div className="bv-card">
        <p className="bv-eyebrow">Bem-vindo ao PrintOS</p>
        <h1 className="bv-title">Como podemos te chamar?</h1>
        <p className="bv-sub">
          Vamos usar esse nome para personalizar o seu painel. Você pode mudar depois em
          Configurações.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            className="bv-input"
            type="text"
            autoFocus
            maxLength={60}
            placeholder="Seu nome ou apelido"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (erro) setErro(null);
            }}
          />
          {erro && <p className="bv-err">{erro}</p>}

          <button type="submit" className="bv-btn" disabled={carregando}>
            {carregando ? (
              <>
                <Loader2 size={18} className="bv-spin" aria-hidden="true" />
                Salvando...
              </>
            ) : (
              <>
                Continuar
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

# PrintOS V1

Sistema para gráficas, copiadoras, comunicação visual e personalizados.

## Stack

- Next.js App Router
- TypeScript
- Supabase
- `@supabase/ssr`
- CSS simples na V1

## Estrutura

```text
app/
lib/
  supabase/
types/
public/
proxy.ts
```

## Rodar

```bash
npm install
```

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Depois:

```bash
npm run dev
```

Abra:

http://localhost:3000

## Próximos passos

1. Executar a migration SQL do banco PrintOS.
2. Configurar Auth.
3. Ligar Dashboard ao Supabase.
4. Implementar Venda Rápida.
5. Implementar Caixa.
6. Implementar Orçamentos e Pedidos.

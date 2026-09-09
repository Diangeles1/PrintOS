-- PrintOS — Venda Rápida: forma de pagamento no pedido. Idempotente.

alter table public.pedidos
  add column if not exists forma_pagamento text;

alter table public.pedidos
  drop constraint if exists pedidos_forma_pagamento_check;
alter table public.pedidos
  add constraint pedidos_forma_pagamento_check
    check (forma_pagamento is null
           or forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito', 'outro'));

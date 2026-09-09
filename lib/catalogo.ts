// Catálogo sugerido — inserido com um clique nas telas de Serviços e Materiais.
// Preços/custos são estimativas de partida (base gráfica rápida interior);
// a gráfica ajusta depois. Itens que já existirem (mesmo nome) são pulados.

export type ServicoSugerido = {
  nome: string;
  categoria: string;
  unidade: string;
  preco: number;
};

export type MaterialSugerido = {
  nome: string;
  categoria: string;
  unidade: string;
  custo: number;
};

export const CATALOGO_SERVICOS: ServicoSugerido[] = [
  // Cópia / impressão avulsa
  { nome: 'Cópia P&B A4', categoria: 'Cópia', unidade: 'un', preco: 0.3 },
  { nome: 'Cópia colorida A4', categoria: 'Cópia', unidade: 'un', preco: 2 },
  { nome: 'Impressão P&B A4', categoria: 'Cópia', unidade: 'un', preco: 0.5 },
  { nome: 'Impressão colorida A4', categoria: 'Cópia', unidade: 'un', preco: 2.5 },
  { nome: 'Impressão P&B A3', categoria: 'Cópia', unidade: 'un', preco: 1 },
  { nome: 'Impressão colorida A3', categoria: 'Cópia', unidade: 'un', preco: 4 },
  { nome: 'Impressão de anexo / e-mail', categoria: 'Digital', unidade: 'un', preco: 2 },
  { nome: 'Digitalização / scanner', categoria: 'Digital', unidade: 'un', preco: 1 },

  // Impressão sob demanda
  { nome: 'Cartão de visita (milheiro)', categoria: 'Impressão', unidade: 'pct', preco: 60 },
  { nome: 'Panfleto A5 4x0 (milheiro)', categoria: 'Impressão', unidade: 'pct', preco: 120 },
  { nome: 'Panfleto A5 4x4 (milheiro)', categoria: 'Impressão', unidade: 'pct', preco: 180 },
  { nome: 'Adesivo vinil impresso', categoria: 'Comunicação Visual', unidade: 'm²', preco: 45 },
  { nome: 'Banner lona 440g', categoria: 'Comunicação Visual', unidade: 'm²', preco: 60 },
  { nome: 'Faixa em lona', categoria: 'Comunicação Visual', unidade: 'm²', preco: 55 },
  { nome: 'Placa PS / PVC', categoria: 'Comunicação Visual', unidade: 'm²', preco: 90 },

  // Acabamento
  { nome: 'Encadernação espiral', categoria: 'Acabamento', unidade: 'un', preco: 6 },
  { nome: 'Encadernação capa dura', categoria: 'Acabamento', unidade: 'un', preco: 25 },
  { nome: 'Plastificação A4', categoria: 'Acabamento', unidade: 'un', preco: 4 },

  // Fotografia
  { nome: 'Foto 3x4 (cartela)', categoria: 'Digital', unidade: 'jogo', preco: 12 },
  { nome: 'Foto 10x15', categoria: 'Digital', unidade: 'un', preco: 3 },
  { nome: 'Diagramação / edição simples', categoria: 'Digital', unidade: 'h', preco: 30 },

  // Documentos
  { nome: 'Currículo — montagem e impressão', categoria: 'Documentos', unidade: 'un', preco: 15 },
  { nome: 'Contrato de compra e venda', categoria: 'Documentos', unidade: 'un', preco: 20 },
  { nome: 'Contrato de aluguel / locação', categoria: 'Documentos', unidade: 'un', preco: 20 },
  { nome: 'Contrato de prestação de serviço', categoria: 'Documentos', unidade: 'un', preco: 20 },
  { nome: 'Contrato de comodato', categoria: 'Documentos', unidade: 'un', preco: 20 },
  { nome: 'Declaração de união estável', categoria: 'Documentos', unidade: 'un', preco: 15 },
  { nome: 'Declaração de residência', categoria: 'Documentos', unidade: 'un', preco: 10 },
  { nome: 'Recibo de pagamento', categoria: 'Documentos', unidade: 'un', preco: 5 },
  { nome: 'Procuração simples', categoria: 'Documentos', unidade: 'un', preco: 15 },
  { nome: 'Autorização de viagem de menor', categoria: 'Documentos', unidade: 'un', preco: 15 },
];

export const CATALOGO_MATERIAIS: MaterialSugerido[] = [
  { nome: 'Papel sulfite A4 75g (resma)', categoria: 'Papel', unidade: 'pct', custo: 24 },
  { nome: 'Papel sulfite A3 75g (resma)', categoria: 'Papel', unidade: 'pct', custo: 42 },
  { nome: 'Papel couché 150g A4', categoria: 'Papel', unidade: 'folha', custo: 0.35 },
  { nome: 'Papel couché 250g A3', categoria: 'Papel', unidade: 'folha', custo: 0.7 },
  { nome: 'Papel fotográfico A4', categoria: 'Papel', unidade: 'folha', custo: 1.2 },
  { nome: 'Papel cartão / supremo 250g', categoria: 'Papel', unidade: 'folha', custo: 0.5 },
  { nome: 'Papel adesivo A4', categoria: 'Papel', unidade: 'folha', custo: 1 },
  { nome: 'Vinil adesivo (rolo)', categoria: 'Bobina', unidade: 'm', custo: 14 },
  { nome: 'Lona 440g (rolo)', categoria: 'Bobina', unidade: 'm', custo: 18 },
  { nome: 'Toner preto', categoria: 'Tinta', unidade: 'un', custo: 320 },
  { nome: 'Toner colorido (kit CMY)', categoria: 'Tinta', unidade: 'cx', custo: 700 },
  { nome: 'Tinta plotter (litro)', categoria: 'Tinta', unidade: 'L', custo: 120 },
  { nome: 'Espiral 17mm (caixa)', categoria: 'Acabamento', unidade: 'cx', custo: 22 },
  { nome: 'Espiral 29mm (caixa)', categoria: 'Acabamento', unidade: 'cx', custo: 35 },
  { nome: 'Capa transparente A4 (pct 100)', categoria: 'Acabamento', unidade: 'pct', custo: 18 },
  { nome: 'Contracapa preta A4 (pct 100)', categoria: 'Acabamento', unidade: 'pct', custo: 20 },
  { nome: 'Polaseal plastificação A4 (pct 100)', categoria: 'Acabamento', unidade: 'pct', custo: 30 },
  { nome: 'Fita dupla face', categoria: 'Embalagem', unidade: 'un', custo: 8 },
  { nome: 'Tubete para banner', categoria: 'Acabamento', unidade: 'un', custo: 4 },
  { nome: 'Ilhós / anilha (pacote)', categoria: 'Acabamento', unidade: 'pct', custo: 15 },
];

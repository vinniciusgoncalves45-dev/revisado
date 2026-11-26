// ===============================================================
// Plano de manutencao padrao.
//
// E a ideia 10 do brainstorming da etapa de Ideacao: "ja vir pronto
// o plano de manutencao". Quando o usuario cadastra um carro, estes
// itens sao criados automaticamente para ele, e depois podem ser
// ajustados.
//
// Intervalos baseados em recomendacoes comuns de manual de veiculo
// de passeio. O usuario pode alterar no proprio sistema.
// ===============================================================

const PLANO_PADRAO = [
  { nome: "Troca de óleo e filtro", intervalo_km: 10000, intervalo_meses: 12 },
  { nome: "Filtro de ar",           intervalo_km: 15000, intervalo_meses: null },
  { nome: "Filtro de combustível",  intervalo_km: 20000, intervalo_meses: null },
  { nome: "Alinhamento e balanceamento", intervalo_km: 10000, intervalo_meses: null },
  { nome: "Rodízio de pneus",       intervalo_km: 10000, intervalo_meses: null },
  { nome: "Pastilhas de freio",     intervalo_km: 30000, intervalo_meses: null },
  { nome: "Velas de ignição",       intervalo_km: 40000, intervalo_meses: null },
  { nome: "Correia dentada",        intervalo_km: 60000, intervalo_meses: null },
  { nome: "Fluido de freio",        intervalo_km: null,  intervalo_meses: 24 },
  { nome: "Revisão geral",          intervalo_km: null,  intervalo_meses: 12 },
];

module.exports = { PLANO_PADRAO };

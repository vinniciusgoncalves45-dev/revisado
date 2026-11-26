// ===============================================================
// Coracao do sistema: calcula quanto falta para cada manutencao
// e em que estado ela esta.
//
// Esta e a unica parte com regra de negocio de verdade, por isso
// foi separada em um arquivo proprio e e a que tem testes
// automatizados (tests/manutencao.test.js).
// ===============================================================

// Quanto falta, em dias, de uma data ate outra.
function diasEntre(de, ate) {
  const UM_DIA = 24 * 60 * 60 * 1000;
  const a = new Date(de.getFullYear(), de.getMonth(), de.getDate());
  const b = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate());
  return Math.round((b - a) / UM_DIA);
}

// Soma meses a uma data, sem estourar o fim do mes.
// Ex.: 31/01 + 1 mes = 28/02 (ou 29/02 em ano bissexto).
function somarMeses(data, meses) {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const diaOriginal = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(diaOriginal, ultimoDia));
  return d;
}

// Estima a quilometragem de hoje a partir da ultima informada pelo
// usuario e da media que ele roda por mes.
//
// E a Solucao 1 da etapa de Ideacao: o aplicativo calcula sozinho,
// para o usuario nao precisar cadastrar o tempo todo.
function estimarKmAtual(veiculo, hoje = new Date()) {
  const base = new Date(veiculo.km_atualizado_em);
  const dias = diasEntre(base, hoje);
  if (dias <= 0) return veiculo.km_atual;
  const kmPorDia = (veiculo.km_por_mes || 0) / 30;
  return Math.round(veiculo.km_atual + dias * kmPorDia);
}

// Define o estado de uma manutencao a partir do que falta.
//
// A regra vem direto do sketch da etapa de Ideacao, que previa
// cada item com uma cor. Aqui a cor e consequencia do numero,
// nunca o contrario.
function definirEstado(faltamKm, faltamDias) {
  // Pega o criterio que estiver mais proximo de vencer:
  // o que chegar primeiro e o que vale.
  const vencidoPorKm = faltamKm !== null && faltamKm <= 0;
  const vencidoPorData = faltamDias !== null && faltamDias <= 0;
  if (vencidoPorKm || vencidoPorData) return "urgente";

  const proximoPorKm = faltamKm !== null && faltamKm <= 1000;
  const proximoPorData = faltamDias !== null && faltamDias <= 30;
  if (proximoPorKm || proximoPorData) return "em_breve";

  return "em_dia";
}

// Monta a situacao de um item de manutencao.
//
// item     - linha da tabela itens_manutencao
// kmAtual  - quilometragem estimada do veiculo hoje
// hoje     - data de referencia (parametro para permitir testar)
function situacaoDoItem(item, kmAtual, hoje = new Date()) {
  let faltamKm = null;
  let proximoKm = null;
  if (item.intervalo_km) {
    proximoKm = item.km_ultima + item.intervalo_km;
    faltamKm = proximoKm - kmAtual;
  }

  let faltamDias = null;
  let proximaData = null;
  if (item.intervalo_meses && item.data_ultima) {
    proximaData = somarMeses(new Date(item.data_ultima), item.intervalo_meses);
    faltamDias = diasEntre(hoje, proximaData);
  }

  const estado = definirEstado(faltamKm, faltamDias);

  // Texto curto que o front-end mostra no cartao. Quando os dois
  // criterios existem, mostramos o que vence primeiro.
  let resumo;
  const mostrarKm =
    faltamKm !== null &&
    (faltamDias === null || faltamKm / 1000 <= faltamDias / 30);

  if (mostrarKm) {
    resumo = faltamKm > 0
      ? `Faltam ${faltamKm.toLocaleString("pt-BR")} km`
      : `Atrasada em ${Math.abs(faltamKm).toLocaleString("pt-BR")} km`;
  } else if (faltamDias !== null) {
    resumo = faltamDias > 0
      ? `Faltam ${faltamDias} ${faltamDias === 1 ? "dia" : "dias"}`
      : `Atrasada em ${Math.abs(faltamDias)} ${Math.abs(faltamDias) === 1 ? "dia" : "dias"}`;
  } else {
    resumo = "Sem previsao";
  }

  return {
    id: item.id,
    nome: item.nome,
    estado,
    resumo,
    faltam_km: faltamKm,
    faltam_dias: faltamDias,
    proximo_km: proximoKm,
    proxima_data: proximaData ? proximaData.toISOString().slice(0, 10) : null,
  };
}

// Ordena do mais urgente para o menos urgente.
function ordenarPorUrgencia(situacoes) {
  const peso = { urgente: 0, em_breve: 1, em_dia: 2 };
  return [...situacoes].sort((a, b) => {
    if (peso[a.estado] !== peso[b.estado]) return peso[a.estado] - peso[b.estado];
    const ka = a.faltam_km === null ? Infinity : a.faltam_km;
    const kb = b.faltam_km === null ? Infinity : b.faltam_km;
    return ka - kb;
  });
}

// Soma os valores dos servicos de um determinado mes.
function gastoDoMes(servicos, ano, mes) {
  return servicos
    .filter((s) => {
      const d = new Date(s.data);
      return d.getFullYear() === ano && d.getMonth() + 1 === mes;
    })
    .reduce((total, s) => total + Number(s.valor), 0);
}

// Custo por quilometro rodado no ano.
// Foi a ideia 25 do brainstorming da etapa de Ideacao.
function custoPorKm(servicos, kmRodados) {
  if (!kmRodados || kmRodados <= 0) return 0;
  const total = servicos.reduce((soma, s) => soma + Number(s.valor), 0);
  return total / kmRodados;
}

module.exports = {
  diasEntre,
  somarMeses,
  estimarKmAtual,
  definirEstado,
  situacaoDoItem,
  ordenarPorUrgencia,
  gastoDoMes,
  custoPorKm,
};

// ===============================================================
// Testes unitarios da regra de negocio das manutencoes.
// Rode com: npm test
//
// Usa o executor de testes nativo do Node, sem biblioteca externa.
// ===============================================================
const { test, describe } = require("node:test");
const assert = require("node:assert");

const {
  diasEntre,
  somarMeses,
  estimarKmAtual,
  definirEstado,
  situacaoDoItem,
  ordenarPorUrgencia,
  gastoDoMes,
  custoPorKm,
} = require("../src/servicos/manutencao.js");

const HOJE = new Date(2026, 10, 26); // 26/11/2026

describe("diasEntre", () => {
  test("conta os dias entre duas datas", () => {
    assert.strictEqual(diasEntre(new Date(2026, 10, 1), new Date(2026, 10, 26)), 25);
  });

  test("devolve numero negativo quando a data ja passou", () => {
    assert.strictEqual(diasEntre(new Date(2026, 10, 26), new Date(2026, 10, 20)), -6);
  });

  test("ignora a hora do dia", () => {
    const manha = new Date(2026, 10, 1, 8, 0);
    const noite = new Date(2026, 10, 2, 23, 0);
    assert.strictEqual(diasEntre(manha, noite), 1);
  });
});

describe("somarMeses", () => {
  test("soma meses normalmente", () => {
    const r = somarMeses(new Date(2026, 0, 15), 3);
    assert.strictEqual(r.getMonth(), 3);
    assert.strictEqual(r.getDate(), 15);
  });

  test("nao estoura o fim do mes: 31/01 + 1 mes vira 28/02", () => {
    const r = somarMeses(new Date(2026, 0, 31), 1);
    assert.strictEqual(r.getMonth(), 1);
    assert.strictEqual(r.getDate(), 28);
  });

  test("vira o ano corretamente", () => {
    const r = somarMeses(new Date(2026, 10, 10), 3);
    assert.strictEqual(r.getFullYear(), 2027);
    assert.strictEqual(r.getMonth(), 1);
  });
});

describe("estimarKmAtual", () => {
  test("projeta a quilometragem pela media mensal", () => {
    const veiculo = {
      km_atual: 62450,
      km_por_mes: 1500,
      km_atualizado_em: new Date(2026, 9, 27), // 30 dias antes
    };
    // 30 dias x 50 km/dia = 1500 km
    assert.strictEqual(estimarKmAtual(veiculo, HOJE), 63950);
  });

  test("nao muda nada no mesmo dia da atualizacao", () => {
    const veiculo = { km_atual: 62450, km_por_mes: 1500, km_atualizado_em: HOJE };
    assert.strictEqual(estimarKmAtual(veiculo, HOJE), 62450);
  });

  test("carro parado nao acumula quilometragem", () => {
    const veiculo = {
      km_atual: 62450,
      km_por_mes: 0,
      km_atualizado_em: new Date(2026, 5, 1),
    };
    assert.strictEqual(estimarKmAtual(veiculo, HOJE), 62450);
  });
});

describe("definirEstado", () => {
  test("em dia quando falta bastante", () => {
    assert.strictEqual(definirEstado(5000, 200), "em_dia");
  });

  test("em breve quando faltam 1000 km ou menos", () => {
    assert.strictEqual(definirEstado(1000, 200), "em_breve");
    assert.strictEqual(definirEstado(550, null), "em_breve");
  });

  test("em breve quando faltam 30 dias ou menos", () => {
    assert.strictEqual(definirEstado(9000, 30), "em_breve");
  });

  test("urgente quando a quilometragem ja passou", () => {
    assert.strictEqual(definirEstado(0, 200), "urgente");
    assert.strictEqual(definirEstado(-120, 200), "urgente");
  });

  test("urgente quando a data ja passou", () => {
    assert.strictEqual(definirEstado(9000, -3), "urgente");
  });

  test("vale o criterio que vence primeiro", () => {
    // Longe pela data, mas vencido pela quilometragem.
    assert.strictEqual(definirEstado(-50, 300), "urgente");
  });
});

describe("situacaoDoItem", () => {
  test("calcula o proximo km e o que falta", () => {
    const item = { id: 1, nome: "Troca de oleo", intervalo_km: 10000, intervalo_meses: null, km_ultima: 53010, data_ultima: null };
    const s = situacaoDoItem(item, 62450, HOJE);
    assert.strictEqual(s.proximo_km, 63010);
    assert.strictEqual(s.faltam_km, 560);
    assert.strictEqual(s.estado, "em_breve");
    assert.strictEqual(s.resumo, "Faltam 560 km");
  });

  test("marca como urgente e informa o atraso", () => {
    const item = { id: 2, nome: "Troca de oleo", intervalo_km: 10000, intervalo_meses: null, km_ultima: 50000, data_ultima: null };
    const s = situacaoDoItem(item, 62450, HOJE);
    assert.strictEqual(s.estado, "urgente");
    assert.match(s.resumo, /Atrasada em 2\.450 km/);
  });

  test("funciona so com intervalo em meses", () => {
    const item = { id: 3, nome: "Revisao geral", intervalo_km: null, intervalo_meses: 12, km_ultima: 0, data_ultima: new Date(2026, 0, 10) };
    const s = situacaoDoItem(item, 62450, HOJE);
    assert.strictEqual(s.faltam_km, null);
    assert.strictEqual(s.proxima_data, "2027-01-10");
    assert.strictEqual(s.estado, "em_dia");
  });

  test("com os dois criterios, mostra o que vence primeiro", () => {
    // Faltam 300 km (0,3 do intervalo de 1000) contra 300 dias (10 meses).
    const item = { id: 4, nome: "Alinhamento", intervalo_km: 10000, intervalo_meses: 12, km_ultima: 52750, data_ultima: new Date(2026, 1, 1) };
    const s = situacaoDoItem(item, 62450, HOJE);
    assert.strictEqual(s.faltam_km, 300);
    assert.match(s.resumo, /km/);
  });

  test("item sem historico ainda aparece com previsao", () => {
    const item = { id: 5, nome: "Correia dentada", intervalo_km: 60000, intervalo_meses: null, km_ultima: 0, data_ultima: null };
    const s = situacaoDoItem(item, 62450, HOJE);
    assert.strictEqual(s.estado, "urgente");
  });
});

describe("ordenarPorUrgencia", () => {
  test("coloca as urgentes primeiro e as em dia por ultimo", () => {
    const lista = [
      { nome: "A", estado: "em_dia", faltam_km: 5000 },
      { nome: "B", estado: "urgente", faltam_km: -100 },
      { nome: "C", estado: "em_breve", faltam_km: 400 },
    ];
    assert.deepStrictEqual(ordenarPorUrgencia(lista).map((i) => i.nome), ["B", "C", "A"]);
  });

  test("nao altera a lista original", () => {
    const lista = [
      { nome: "A", estado: "em_dia", faltam_km: 1 },
      { nome: "B", estado: "urgente", faltam_km: 2 },
    ];
    ordenarPorUrgencia(lista);
    assert.strictEqual(lista[0].nome, "A");
  });
});

describe("gastoDoMes", () => {
  const servicos = [
    { data: "2026-11-15", valor: "280.00" },
    { data: "2026-11-03", valor: "480.00" },
    { data: "2026-10-22", valor: "640.00" },
  ];

  test("soma apenas os servicos do mes pedido", () => {
    assert.strictEqual(gastoDoMes(servicos, 2026, 11), 760);
  });

  test("devolve zero quando nao houve servico no mes", () => {
    assert.strictEqual(gastoDoMes(servicos, 2026, 9), 0);
  });
});

describe("custoPorKm", () => {
  test("divide o total gasto pelos km rodados", () => {
    const servicos = [{ valor: "1000.00" }, { valor: "1340.00" }];
    assert.strictEqual(Number(custoPorKm(servicos, 12000).toFixed(4)), 0.195);
  });

  test("devolve zero em vez de dividir por zero", () => {
    assert.strictEqual(custoPorKm([{ valor: "100.00" }], 0), 0);
  });
});

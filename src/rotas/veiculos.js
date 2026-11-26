// ===============================================================
// Rotas dos veiculos: listar, cadastrar, ver o painel e excluir.
// Cada usuario pode ter mais de um carro.
// ===============================================================
const express = require("express");
const { consultar, consultarUm, transacao } = require("../db/index.js");
const { PLANO_PADRAO } = require("../servicos/planoPadrao.js");
const {
  estimarKmAtual,
  situacaoDoItem,
  ordenarPorUrgencia,
  gastoDoMes,
  custoPorKm,
} = require("../servicos/manutencao.js");

const rotas = express.Router();

// Busca um veiculo garantindo que ele pertence a quem pediu.
// Sem isso, qualquer usuario logado poderia ver o carro dos outros
// so trocando o numero na URL.
async function veiculoDoUsuario(veiculoId, usuarioId) {
  return consultarUm(
    "SELECT * FROM veiculos WHERE id = $1 AND usuario_id = $2",
    [veiculoId, usuarioId]
  );
}

// Lista todos os carros do usuario.
rotas.get("/", async (req, res) => {
  const veiculos = await consultar(
    "SELECT * FROM veiculos WHERE usuario_id = $1 ORDER BY criado_em",
    [req.session.usuarioId]
  );
  // Devolve ja com a quilometragem estimada de hoje.
  res.json(veiculos.map((v) => ({ ...v, km_estimado: estimarKmAtual(v) })));
});

// Cadastra um carro novo e ja cria o plano de manutencao dele.
rotas.post("/", async (req, res) => {
  const { modelo, ano, km_atual, km_por_mes } = req.body;

  if (!modelo || !ano || km_atual === undefined || km_atual === null || km_atual === "") {
    return res.status(400).json({ erro: "Informe o modelo, o ano e a quilometragem atual." });
  }
  const anoNum = Number(ano);
  const kmNum = Number(km_atual);
  const kmMes = Number(km_por_mes) || 1000;

  if (!Number.isInteger(anoNum) || anoNum < 1900 || anoNum > 2100) {
    return res.status(400).json({ erro: "Ano inválido." });
  }
  if (!Number.isFinite(kmNum) || kmNum < 0) {
    return res.status(400).json({ erro: "Quilometragem inválida." });
  }

  const veiculo = await transacao(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO veiculos (usuario_id, modelo, ano, km_atual, km_por_mes, km_atualizado_em)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) RETURNING *`,
      [req.session.usuarioId, String(modelo).trim(), anoNum, Math.round(kmNum), kmMes]
    );
    const novo = rows[0];

    // O plano padrao entra com a quilometragem atual como ponto de
    // partida: assim os avisos passam a contar a partir de agora.
    for (const item of PLANO_PADRAO) {
      await cliente.query(
        `INSERT INTO itens_manutencao (veiculo_id, nome, intervalo_km, intervalo_meses, km_ultima, data_ultima)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)`,
        [novo.id, item.nome, item.intervalo_km, item.intervalo_meses, Math.round(kmNum)]
      );
    }
    return novo;
  });

  res.status(201).json(veiculo);
});

// Painel do carro: tudo que a tela inicial precisa, em uma chamada so.
rotas.get("/:id/painel", async (req, res) => {
  const veiculo = await veiculoDoUsuario(req.params.id, req.session.usuarioId);
  if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado." });

  const kmAtual = estimarKmAtual(veiculo);
  const itens = await consultar(
    "SELECT * FROM itens_manutencao WHERE veiculo_id = $1",
    [veiculo.id]
  );
  const servicos = await consultar(
    "SELECT * FROM servicos WHERE veiculo_id = $1 ORDER BY data DESC",
    [veiculo.id]
  );

  const situacoes = ordenarPorUrgencia(itens.map((i) => situacaoDoItem(i, kmAtual)));
  const hoje = new Date();
  const kmRodadosNoAno = Math.max(0, kmAtual - (veiculo.km_atual - 0));

  res.json({
    veiculo: { ...veiculo, km_estimado: kmAtual },
    manutencoes: situacoes,
    gasto_mes: gastoDoMes(servicos, hoje.getFullYear(), hoje.getMonth() + 1),
    gasto_ano: servicos
      .filter((s) => new Date(s.data).getFullYear() === hoje.getFullYear())
      .reduce((t, s) => t + Number(s.valor), 0),
    custo_por_km: custoPorKm(
      servicos.filter((s) => new Date(s.data).getFullYear() === hoje.getFullYear()),
      kmRodadosNoAno || veiculo.km_por_mes * 12
    ),
    total_servicos: servicos.length,
  });
});

// Atualiza so a quilometragem. E a pergunta unica da tela de registro:
// "quanto marca o painel hoje?".
rotas.patch("/:id/km", async (req, res) => {
  const veiculo = await veiculoDoUsuario(req.params.id, req.session.usuarioId);
  if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado." });

  const km = Number(req.body.km_atual);
  if (!Number.isFinite(km) || km < 0) {
    return res.status(400).json({ erro: "Quilometragem inválida." });
  }
  if (km < veiculo.km_atual) {
    return res.status(400).json({
      erro: `A quilometragem não pode ser menor que a última registrada (${veiculo.km_atual.toLocaleString("pt-BR")} km).`,
    });
  }

  const atualizado = await consultarUm(
    "UPDATE veiculos SET km_atual = $1, km_atualizado_em = CURRENT_DATE WHERE id = $2 RETURNING *",
    [Math.round(km), veiculo.id]
  );
  res.json(atualizado);
});

// Lista os itens de manutencao do carro, para a tela de registro.
rotas.get("/:id/itens", async (req, res) => {
  const veiculo = await veiculoDoUsuario(req.params.id, req.session.usuarioId);
  if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado." });
  const itens = await consultar(
    "SELECT id, nome FROM itens_manutencao WHERE veiculo_id = $1 ORDER BY nome",
    [veiculo.id]
  );
  res.json(itens);
});

// Exclui um carro (e, por cascata, o plano e os servicos dele).
rotas.delete("/:id", async (req, res) => {
  const veiculo = await veiculoDoUsuario(req.params.id, req.session.usuarioId);
  if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado." });
  await consultar("DELETE FROM veiculos WHERE id = $1", [veiculo.id]);
  res.json({ ok: true });
});

module.exports = { rotas, veiculoDoUsuario };

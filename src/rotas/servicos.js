// ===============================================================
// Rotas dos servicos: historico e registro de um servico novo.
// ===============================================================
const express = require("express");
const { consultar, transacao } = require("../db/index.js");
const { veiculoDoUsuario } = require("./veiculos.js");

const rotas = express.Router();

// Historico do carro, com busca opcional por peca ou servico.
// A busca foi a ideia 21 do brainstorming: "quando troquei a correia?".
rotas.get("/:id/servicos", async (req, res) => {
  const veiculo = await veiculoDoUsuario(req.params.id, req.session.usuarioId);
  if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado." });

  const busca = (req.query.busca || "").trim();
  const servicos = busca
    ? await consultar(
        `SELECT * FROM servicos
         WHERE veiculo_id = $1
           AND (descricao ILIKE $2 OR COALESCE(oficina, '') ILIKE $2)
         ORDER BY data DESC`,
        [veiculo.id, `%${busca}%`]
      )
    : await consultar(
        "SELECT * FROM servicos WHERE veiculo_id = $1 ORDER BY data DESC",
        [veiculo.id]
      );

  res.json(servicos);
});

// Registra um servico realizado.
//
// Aqui acontece o recalculo automatico que o fluxograma da etapa de
// Ideacao previa: ao gravar o servico, o item de manutencao
// correspondente passa a contar a partir desta quilometragem e desta
// data, e a quilometragem do carro e atualizada.
rotas.post("/:id/servicos", async (req, res) => {
  const veiculo = await veiculoDoUsuario(req.params.id, req.session.usuarioId);
  if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado." });

  const { item_id, descricao, data, km, valor, oficina, tem_nota } = req.body;

  if (!descricao || !String(descricao).trim()) {
    return res.status(400).json({ erro: "Informe o serviço realizado." });
  }
  if (!data) {
    return res.status(400).json({ erro: "Informe a data do serviço." });
  }
  const kmNum = Number(km);
  if (!Number.isFinite(kmNum) || kmNum < 0) {
    return res.status(400).json({ erro: "Quilometragem inválida." });
  }
  // O hodometro do carro nunca anda para tras. Se a quilometragem
  // informada for menor que a ultima registrada, e erro de digitacao.
  if (Math.round(kmNum) < veiculo.km_atual) {
    return res.status(400).json({
      erro: `A quilometragem não pode ser menor que a última registrada (${veiculo.km_atual.toLocaleString("pt-BR")} km). Confira o número no painel do carro.`,
    });
  }
  const valorNum = Number(valor) || 0;
  if (valorNum < 0) {
    return res.status(400).json({ erro: "O valor não pode ser negativo." });
  }

  const resultado = await transacao(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO servicos (veiculo_id, item_id, descricao, data, km, valor, oficina, tem_nota)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        veiculo.id,
        item_id || null,
        String(descricao).trim(),
        data,
        Math.round(kmNum),
        valorNum,
        oficina ? String(oficina).trim() : null,
        Boolean(tem_nota),
      ]
    );
    const servico = rows[0];

    // Recalcula o proximo aviso do item.
    if (item_id) {
      await cliente.query(
        `UPDATE itens_manutencao SET km_ultima = $1, data_ultima = $2
         WHERE id = $3 AND veiculo_id = $4`,
        [Math.round(kmNum), data, item_id, veiculo.id]
      );
    }

    // Atualiza a quilometragem do carro, se o servico for mais recente.
    if (Math.round(kmNum) > veiculo.km_atual) {
      await cliente.query(
        "UPDATE veiculos SET km_atual = $1, km_atualizado_em = CURRENT_DATE WHERE id = $2",
        [Math.round(kmNum), veiculo.id]
      );
    }

    return servico;
  });

  res.status(201).json(resultado);
});

// Exclui um servico do historico.
rotas.delete("/:id/servicos/:servicoId", async (req, res) => {
  const veiculo = await veiculoDoUsuario(req.params.id, req.session.usuarioId);
  if (!veiculo) return res.status(404).json({ erro: "Veículo não encontrado." });
  await consultar("DELETE FROM servicos WHERE id = $1 AND veiculo_id = $2", [
    req.params.servicoId,
    veiculo.id,
  ]);
  res.json({ ok: true });
});

module.exports = { rotas };

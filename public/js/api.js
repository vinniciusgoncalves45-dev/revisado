// ===============================================================
// Conversa com o back-end.
// Todas as chamadas passam por aqui, para o resto do front-end
// nao precisar saber de URL nem de tratamento de erro.
// ===============================================================

async function chamar(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opcoes,
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });

  // 204 nao tem conteudo.
  const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const erro = new Error((dados && dados.erro) || "Não foi possível completar a ação.");
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

const API = {
  // --- Autenticação ---
  registrar: (corpo) => chamar("/api/auth/registrar", { method: "POST", corpo }),
  entrar:    (corpo) => chamar("/api/auth/entrar",    { method: "POST", corpo }),
  sair:      ()      => chamar("/api/auth/sair",      { method: "POST" }),
  eu:        ()      => chamar("/api/auth/eu"),

  // --- Veículos ---
  listarVeiculos:  ()            => chamar("/api/veiculos"),
  criarVeiculo:    (corpo)       => chamar("/api/veiculos", { method: "POST", corpo }),
  painel:          (id)          => chamar(`/api/veiculos/${id}/painel`),
  itens:           (id)          => chamar(`/api/veiculos/${id}/itens`),
  atualizarKm:     (id, km)      => chamar(`/api/veiculos/${id}/km`, { method: "PATCH", corpo: { km_atual: km } }),
  excluirVeiculo:  (id)          => chamar(`/api/veiculos/${id}`, { method: "DELETE" }),

  // --- Serviços ---
  listarServicos:  (id, busca)   => chamar(`/api/veiculos/${id}/servicos${busca ? `?busca=${encodeURIComponent(busca)}` : ""}`),
  criarServico:    (id, corpo)   => chamar(`/api/veiculos/${id}/servicos`, { method: "POST", corpo }),
};

// ===============================================================
// Teste de integracao: percorre o fluxo inteiro do sistema,
// do cadastro da conta ate o historico, batendo na API de verdade.
//
// Nao roda junto com "npm test" porque precisa do banco no ar.
// Rode com o servidor ligado:  node tests/fluxo.smoke.js
// ===============================================================
const BASE = process.env.BASE || "http://localhost:3000";

let cookie = "";
let falhas = 0;

async function api(caminho, metodo = "GET", corpo) {
  const r = await fetch(BASE + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const set = r.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const dados = await r.json().catch(() => null);
  return { status: r.status, dados };
}

function conferir(descricao, condicao, detalhe = "") {
  if (condicao) {
    console.log("  ok   ", descricao);
  } else {
    falhas++;
    console.log("  FALHA", descricao, detalhe);
  }
}

async function rodar() {
  const email = `teste${Date.now()}@exemplo.com`;

  console.log("\n1. Conta");
  let r = await api("/api/auth/registrar", "POST", { nome: "Vinnícius", email, senha: "senha123" });
  conferir("cria a conta", r.status === 201, JSON.stringify(r.dados));

  r = await api("/api/auth/registrar", "POST", { nome: "Outro", email, senha: "senha123" });
  conferir("recusa e-mail repetido", r.status === 409);

  r = await api("/api/auth/registrar", "POST", { nome: "X", email: "x@x.com", senha: "123" });
  conferir("recusa senha curta", r.status === 400);

  console.log("\n2. Veículos (mais de um por usuário)");
  r = await api("/api/veiculos", "POST", { modelo: "Chevrolet Onix", ano: 2021, km_atual: 62450, km_por_mes: 1500 });
  conferir("cadastra o primeiro carro", r.status === 201, JSON.stringify(r.dados));
  const carro1 = r.dados;

  r = await api("/api/veiculos", "POST", { modelo: "Fiat Argo", ano: 2019, km_atual: 88000, km_por_mes: 800 });
  conferir("cadastra o segundo carro", r.status === 201);
  const carro2 = r.dados;

  r = await api("/api/veiculos");
  conferir("lista os dois carros", r.dados.length === 2, `veio ${r.dados.length}`);
  conferir("traz a quilometragem estimada", typeof r.dados[0].km_estimado === "number");

  r = await api("/api/veiculos", "POST", { modelo: "Sem ano", km_atual: 10 });
  conferir("recusa carro sem ano", r.status === 400);

  console.log("\n3. Plano de manutenção automático");
  r = await api(`/api/veiculos/${carro1.id}/itens`);
  conferir("cria o plano padrão no cadastro", r.dados.length === 10, `veio ${r.dados.length}`);
  const itemOleo = r.dados.find((i) => i.nome.includes("óleo"));
  conferir("inclui a troca de óleo", Boolean(itemOleo));

  console.log("\n4. Painel");
  r = await api(`/api/veiculos/${carro1.id}/painel`);
  conferir("devolve o painel", r.status === 200);
  conferir("calcula as manutenções", Array.isArray(r.dados.manutencoes) && r.dados.manutencoes.length === 10);
  conferir("ordena da mais urgente para a menos", ["urgente", "em_breve", "em_dia"].includes(r.dados.manutencoes[0].estado));
  conferir("gasto do mês começa zerado", r.dados.gasto_mes === 0);

  console.log("\n5. Registrar serviço");
  const hoje = new Date().toISOString().slice(0, 10);
  r = await api(`/api/veiculos/${carro1.id}/servicos`, "POST", {
    item_id: itemOleo.id, descricao: "Troca de óleo e filtro",
    data: hoje, km: 63010, valor: 280, oficina: "Oficina do Zé",
  });
  conferir("grava o serviço", r.status === 201, JSON.stringify(r.dados));

  r = await api(`/api/veiculos/${carro1.id}/painel`);
  conferir("atualiza a quilometragem do carro", r.dados.veiculo.km_atual === 63010, `veio ${r.dados.veiculo.km_atual}`);
  conferir("soma no gasto do mês", Number(r.dados.gasto_mes) === 280, `veio ${r.dados.gasto_mes}`);
  const oleoDepois = r.dados.manutencoes.find((m) => m.id === itemOleo.id);
  conferir("recalcula o próximo aviso", oleoDepois.proximo_km === 73010, `veio ${oleoDepois.proximo_km}`);
  conferir("o óleo volta para em dia", oleoDepois.estado === "em_dia", `veio ${oleoDepois.estado}`);

  r = await api(`/api/veiculos/${carro1.id}/servicos`, "POST", { descricao: "", data: hoje, km: 1 });
  conferir("recusa serviço sem descrição", r.status === 400);

  console.log("\n6. Histórico e busca");
  await api(`/api/veiculos/${carro1.id}/servicos`, "POST", {
    descricao: "Pastilhas de freio", data: hoje, km: 63010, valor: 640, oficina: "Auto Center Lages",
  });

  r = await api(`/api/veiculos/${carro1.id}/servicos`);
  conferir("lista os dois serviços", r.dados.length === 2, `veio ${r.dados.length}`);
  conferir("ordena do mais novo para o mais antigo", new Date(r.dados[0].data) >= new Date(r.dados[1].data));

  r = await api(`/api/veiculos/${carro1.id}/servicos?busca=freio`);
  conferir("busca por peça encontra", r.dados.length === 1 && r.dados[0].descricao.includes("freio"));

  r = await api(`/api/veiculos/${carro1.id}/servicos?busca=Lages`);
  conferir("busca por oficina encontra", r.dados.length === 1);

  r = await api(`/api/veiculos/${carro1.id}/servicos?busca=nao-existe`);
  conferir("busca sem resultado volta vazia", r.dados.length === 0);

  console.log("\n7. Isolamento entre carros e entre usuários");
  r = await api(`/api/veiculos/${carro2.id}/servicos`);
  conferir("o segundo carro não vê os serviços do primeiro", r.dados.length === 0);

  const cookieDoDono = cookie;
  cookie = "";
  await api("/api/auth/registrar", "POST", { nome: "Intruso", email: `intruso${Date.now()}@x.com`, senha: "senha123" });
  r = await api(`/api/veiculos/${carro1.id}/painel`);
  conferir("outro usuário não acessa o carro alheio", r.status === 404, `veio ${r.status}`);
  cookie = cookieDoDono;

  console.log("\n8. Validação da quilometragem");
  r = await api(`/api/veiculos/${carro1.id}/km`, "PATCH", { km_atual: 100 });
  conferir("recusa quilometragem menor que a última", r.status === 400);

  r = await api(`/api/veiculos/${carro1.id}/km`, "PATCH", { km_atual: 64000 });
  conferir("aceita quilometragem maior", r.status === 200);

  // CT-002: a mesma regra tem que valer ao registrar um servico.
  r = await api(`/api/veiculos/${carro1.id}/servicos`, "POST", {
    descricao: "Rodízio de pneus", data: "2026-11-20", km: 62000, valor: 90,
  });
  conferir("recusa serviço com quilometragem menor que a última", r.status === 400, `veio ${r.status}`);
  conferir("explica o motivo da recusa", String(r.dados.erro || "").includes("não pode ser menor"), r.dados.erro);

  console.log("\n9. Sessão");
  await api("/api/auth/sair", "POST");
  r = await api("/api/veiculos");
  conferir("sem login, a API bloqueia", r.status === 401);

  console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

rodar().catch((e) => { console.error("Erro no teste:", e); process.exit(1); });

// ===============================================================
// Revisado - front-end
//
// Aplicação de uma página só: as seis telas estão no HTML e o
// JavaScript mostra uma de cada vez, do mesmo jeito que o
// protótipo do Figma navegava entre as telas.
// ===============================================================

// Estado da aplicação, guardado em memória.
const estado = {
  usuario: null,
  veiculos: [],
  veiculoId: null,
  modoRegistro: false,   // tela de entrada: criar conta ou entrar
  ultimoServico: null,   // usado pela tela de confirmação
};

// --- Atalhos --------------------------------------------------
const $ = (seletor) => document.querySelector(seletor);
const $$ = (seletor) => document.querySelectorAll(seletor);

const dinheiro = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const numero = (valor) => Number(valor || 0).toLocaleString("pt-BR");

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

// Converte "2026-11-15" em uma data local, sem o deslocamento de
// fuso que o construtor Date aplica a datas em formato ISO.
function dataLocal(texto) {
  const [ano, mes, dia] = String(texto).slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function mostrarTela(id) {
  $$(".tela").forEach((t) => t.classList.toggle("ativa", t.id === id));
  $$("nav.rodape button").forEach((b) => b.classList.toggle("ativo", b.dataset.ir === id));
  window.scrollTo(0, 0);
}

function mostrarErro(elemento, mensagem) {
  elemento.textContent = mensagem;
  elemento.hidden = !mensagem;
}

// ===============================================================
// ENTRADA: criar conta e entrar
// ===============================================================

function alternarModoEntrada() {
  estado.modoRegistro = !estado.modoRegistro;
  $("#campos-registro").hidden = !estado.modoRegistro;
  $("#btn-entrar").textContent = estado.modoRegistro ? "Criar conta" : "Entrar";
  $("#texto-alternar").textContent = estado.modoRegistro ? "Já tem conta?" : "Ainda não tem conta?";
  $("#btn-alternar").textContent = estado.modoRegistro ? "Entrar" : "Criar conta";
  $("#senha").autocomplete = estado.modoRegistro ? "new-password" : "current-password";
  mostrarErro($("#erro-entrada"), "");
}

async function entrarOuRegistrar() {
  const botao = $("#btn-entrar");
  const email = $("#email").value.trim();
  const senha = $("#senha").value;
  const nome = $("#nome").value.trim();

  if (!email || !senha || (estado.modoRegistro && !nome)) {
    return mostrarErro($("#erro-entrada"), "Preencha todos os campos.");
  }

  botao.disabled = true;
  try {
    estado.usuario = estado.modoRegistro
      ? await API.registrar({ nome, email, senha })
      : await API.entrar({ email, senha });
    mostrarErro($("#erro-entrada"), "");
    $("#senha").value = "";
    await carregarVeiculos();
  } catch (erro) {
    mostrarErro($("#erro-entrada"), erro.message);
  } finally {
    botao.disabled = false;
  }
}

// ===============================================================
// VEÍCULOS
// ===============================================================

async function carregarVeiculos() {
  estado.veiculos = await API.listarVeiculos();

  if (estado.veiculos.length === 0) {
    // Primeiro acesso: vai direto para o cadastro do carro.
    prepararCadastroVeiculo(false);
    return mostrarTela("tela-veiculo");
  }

  // Mantém o carro selecionado, se ele ainda existir.
  const aindaExiste = estado.veiculos.some((v) => v.id === estado.veiculoId);
  if (!aindaExiste) estado.veiculoId = estado.veiculos[0].id;

  await abrirInicio();
}

// Deixa a tela de cadastro pronta. O parâmetro diz se é um carro
// adicional (aí aparece o botão de cancelar) ou o primeiro.
function prepararCadastroVeiculo(ehAdicional) {
  $("#titulo-veiculo").innerHTML = ehAdicional
    ? "Vamos cadastrar<br>mais um carro."
    : "Vamos cadastrar<br>seu carro.";
  $("#btn-cancelar-veiculo").hidden = !ehAdicional;
  $("#modelo").value = "";
  $("#ano").value = "";
  $("#km-inicial").value = "";
  $("#km-mes").value = "1000";
  mostrarErro($("#erro-veiculo"), "");
}

async function salvarVeiculo() {
  const botao = $("#btn-salvar-veiculo");
  const corpo = {
    modelo: $("#modelo").value.trim(),
    ano: $("#ano").value,
    km_atual: $("#km-inicial").value,
    km_por_mes: $("#km-mes").value,
  };

  if (!corpo.modelo || !corpo.ano || corpo.km_atual === "") {
    return mostrarErro($("#erro-veiculo"), "Preencha o modelo, o ano e a quilometragem.");
  }

  botao.disabled = true;
  try {
    const novo = await API.criarVeiculo(corpo);
    estado.veiculoId = novo.id;
    await carregarVeiculos();
  } catch (erro) {
    mostrarErro($("#erro-veiculo"), erro.message);
  } finally {
    botao.disabled = false;
  }
}

// Desenha as abas de troca de carro.
function desenharAbas() {
  const container = $("#abas-veiculos");
  container.innerHTML = "";

  estado.veiculos.forEach((v) => {
    const aba = document.createElement("button");
    aba.className = "aba-veiculo" + (v.id === estado.veiculoId ? " ativa" : "");
    aba.textContent = v.modelo;
    aba.onclick = async () => {
      estado.veiculoId = v.id;
      await abrirInicio();
    };
    container.appendChild(aba);
  });

  const adicionar = document.createElement("button");
  adicionar.className = "aba-veiculo nova";
  adicionar.textContent = "+ Carro";
  adicionar.onclick = () => {
    prepararCadastroVeiculo(true);
    mostrarTela("tela-veiculo");
  };
  container.appendChild(adicionar);
}

// ===============================================================
// TELA INICIAL
// ===============================================================

async function abrirInicio() {
  const dados = await API.painel(estado.veiculoId);
  const v = dados.veiculo;

  desenharAbas();

  $("#nome-veiculo").textContent = `${v.modelo} ${v.ano}`;
  $("#km-veiculo").textContent = numero(v.km_estimado);

  // Deixa claro que o número é estimado, e não um dado digitado.
  const diferenca = v.km_estimado - v.km_atual;
  $("#km-nota").textContent = diferenca > 0
    ? `Estimado. Último informado: ${numero(v.km_atual)} km.`
    : "Informado por você.";

  $("#gasto-mes").textContent = dinheiro(dados.gasto_mes);

  const lista = $("#lista-manutencoes");
  lista.innerHTML = "";

  // Mostra as cinco mais urgentes, para a tela não virar uma lista
  // enorme. O resto aparece conforme for vencendo.
  dados.manutencoes.slice(0, 5).forEach((m) => {
    const texto = { em_dia: "EM DIA", em_breve: "EM BREVE", urgente: "URGENTE" }[m.estado];
    const item = document.createElement("div");
    item.className = `item-manutencao ${m.estado}`;
    item.innerHTML = `
      <span class="bolinha"></span>
      <div class="meio">
        <h3>${m.nome}</h3>
        <span class="secundario">${m.resumo}</span>
      </div>
      <span class="etiqueta">${texto}</span>`;
    lista.appendChild(item);
  });

  mostrarTela("tela-inicio");
}

// ===============================================================
// REGISTRAR SERVIÇO
// ===============================================================

async function abrirRegistro() {
  const veiculo = estado.veiculos.find((v) => v.id === estado.veiculoId);

  $("#km-painel").value = veiculo ? veiculo.km_atual : "";
  $("#data-servico").value = new Date().toISOString().slice(0, 10);
  $("#descricao").value = "";
  $("#valor").value = "";
  $("#oficina").value = "";
  mostrarErro($("#erro-servico"), "");

  $("#km-ultimo-registro").textContent = veiculo
    ? `Último registro: ${numero(veiculo.km_atual)} km.`
    : "";

  // Preenche a lista de manutenções do carro.
  const itens = await API.itens(estado.veiculoId);
  const select = $("#item-servico");
  select.innerHTML = '<option value="">Selecione…</option>';
  itens.forEach((i) => {
    const opcao = document.createElement("option");
    opcao.value = i.id;
    opcao.textContent = i.nome;
    select.appendChild(opcao);
  });

  mostrarTela("tela-registrar");
}

// Ao escolher a manutenção, a descrição já vem preenchida.
function aoEscolherItem() {
  const select = $("#item-servico");
  const nome = select.options[select.selectedIndex].textContent;
  if (select.value && !$("#descricao").value.trim()) {
    $("#descricao").value = nome;
  }
}

async function confirmarServico() {
  const botao = $("#btn-confirmar-servico");
  const corpo = {
    item_id: $("#item-servico").value || null,
    descricao: $("#descricao").value.trim(),
    data: $("#data-servico").value,
    km: $("#km-painel").value,
    valor: $("#valor").value || 0,
    oficina: $("#oficina").value.trim() || null,
  };

  if (!corpo.descricao) return mostrarErro($("#erro-servico"), "Informe o serviço realizado.");
  if (!corpo.data) return mostrarErro($("#erro-servico"), "Informe a data do serviço.");
  if (corpo.km === "") return mostrarErro($("#erro-servico"), "Informe a quilometragem do painel.");

  botao.disabled = true;
  try {
    const servico = await API.criarServico(estado.veiculoId, corpo);
    estado.ultimoServico = servico;
    estado.veiculos = await API.listarVeiculos();
    mostrarErro($("#erro-servico"), "");
    await abrirConfirmacao(servico);
  } catch (erro) {
    mostrarErro($("#erro-servico"), erro.message);
  } finally {
    botao.disabled = false;
  }
}

// ===============================================================
// CONFIRMAÇÃO
// ===============================================================

async function abrirConfirmacao(servico) {
  const linhas = [
    ["Serviço", servico.descricao],
    ["Data", dataLocal(servico.data).toLocaleDateString("pt-BR")],
    ["Quilometragem", `${numero(servico.km)} km`],
    ["Valor", dinheiro(servico.valor)],
  ];

  $("#resumo-servico").innerHTML = linhas
    .map(([chave, valor]) => `
      <div class="linha-detalhe">
        <span class="chave">${chave}</span>
        <span class="valor">${valor}</span>
      </div>`)
    .join("");

  // Busca o próximo aviso recalculado para este item.
  const bloco = $("#bloco-proximo-aviso");
  bloco.hidden = true;
  if (servico.item_id) {
    const dados = await API.painel(estado.veiculoId);
    const item = dados.manutencoes.find((m) => m.id === servico.item_id);
    if (item) {
      const texto = item.proximo_km
        ? `${item.nome} em ${numero(item.proximo_km)} km`
        : `${item.nome} em ${dataLocal(item.proxima_data).toLocaleDateString("pt-BR")}`;
      $("#texto-proximo-aviso").textContent = texto;
      bloco.hidden = false;
    }
  }

  mostrarTela("tela-confirmacao");
}

// ===============================================================
// HISTÓRICO
// ===============================================================

async function abrirHistorico() {
  $("#ano-corrente").textContent = new Date().getFullYear();

  const [dados, servicos] = await Promise.all([
    API.painel(estado.veiculoId),
    API.listarServicos(estado.veiculoId, $("#busca").value.trim()),
  ]);

  $("#gasto-ano").textContent = dinheiro(dados.gasto_ano);
  $("#custo-km").textContent = dinheiro(dados.custo_por_km);

  desenharHistorico(servicos);
  mostrarTela("tela-historico");
}

function desenharHistorico(servicos) {
  const lista = $("#lista-historico");
  lista.innerHTML = "";

  if (servicos.length === 0) {
    lista.innerHTML = `<div class="vazio">${
      $("#busca").value.trim()
        ? "Nenhum serviço encontrado para essa busca."
        : "Nenhum serviço registrado ainda."
    }</div>`;
    return;
  }

  // Agrupa por mês, como no protótipo.
  let mesAtual = "";
  servicos.forEach((s) => {
    const data = dataLocal(s.data);
    const chaveMes = `${data.getFullYear()}-${data.getMonth()}`;

    if (chaveMes !== mesAtual) {
      mesAtual = chaveMes;
      const titulo = document.createElement("span");
      titulo.className = "rotulo";
      titulo.style.marginTop = lista.children.length ? "6px" : "0";
      titulo.textContent = data
        .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        .toUpperCase();
      lista.appendChild(titulo);
    }

    const item = document.createElement("div");
    item.className = "item-historico";
    item.innerHTML = `
      <span class="data-bloco">
        <span class="dia">${String(data.getDate()).padStart(2, "0")}</span>
        <span class="mes">${MESES[data.getMonth()]}</span>
      </span>
      <div class="meio">
        <h3>${s.descricao}</h3>
        <span class="secundario">${numero(s.km)} km${s.oficina ? " · " + s.oficina : ""}</span>
      </div>
      <span class="valor">${dinheiro(s.valor)}</span>`;
    lista.appendChild(item);
  });
}

// Espera o usuário parar de digitar antes de buscar.
let temporizadorBusca;
function aoDigitarBusca() {
  clearTimeout(temporizadorBusca);
  temporizadorBusca = setTimeout(async () => {
    const servicos = await API.listarServicos(estado.veiculoId, $("#busca").value.trim());
    desenharHistorico(servicos);
  }, 300);
}

// ===============================================================
// LIGAÇÕES E INÍCIO
// ===============================================================

function ligarEventos() {
  $("#btn-entrar").onclick = entrarOuRegistrar;
  $("#btn-alternar").onclick = alternarModoEntrada;
  $("#senha").onkeydown = (e) => { if (e.key === "Enter") entrarOuRegistrar(); };

  $("#btn-salvar-veiculo").onclick = salvarVeiculo;
  $("#btn-cancelar-veiculo").onclick = () => abrirInicio();

  $("#item-servico").onchange = aoEscolherItem;
  $("#btn-confirmar-servico").onclick = confirmarServico;

  $("#busca").oninput = aoDigitarBusca;

  $("#btn-sair").onclick = async () => {
    await API.sair();
    estado.usuario = null;
    estado.veiculos = [];
    estado.veiculoId = null;
    mostrarTela("tela-entrada");
  };

  const novoCarro = () => { prepararCadastroVeiculo(true); mostrarTela("tela-veiculo"); };
  $("#btn-novo-carro-nav").onclick = novoCarro;
  $("#btn-novo-carro-nav2").onclick = novoCarro;

  // Qualquer botão com data-ir navega para a tela indicada.
  $$("[data-ir]").forEach((botao) => {
    botao.onclick = () => {
      const destino = botao.dataset.ir;
      if (destino === "tela-inicio") return abrirInicio();
      if (destino === "tela-registrar") return abrirRegistro();
      if (destino === "tela-historico") return abrirHistorico();
      mostrarTela(destino);
    };
  });
}

async function iniciar() {
  ligarEventos();
  try {
    estado.usuario = await API.eu();
    await carregarVeiculos();
  } catch {
    // Ninguém logado: fica na tela de entrada.
    mostrarTela("tela-entrada");
  }
}

iniciar();

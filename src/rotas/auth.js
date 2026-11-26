// ===============================================================
// Rotas de autenticacao: criar conta, entrar, sair.
// ===============================================================
const express = require("express");
const bcrypt = require("bcryptjs");
const { consultarUm } = require("../db/index.js");

const rotas = express.Router();

// Middleware: bloqueia quem nao esta logado.
// E usado pelas outras rotas da API.
function exigirLogin(req, res, proximo) {
  if (!req.session.usuarioId) {
    return res.status(401).json({ erro: "Você precisa entrar para continuar." });
  }
  proximo();
}

// Criar conta.
rotas.post("/registrar", async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: "Preencha nome, e-mail e senha." });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: "A senha precisa ter pelo menos 6 caracteres." });
  }

  const jaExiste = await consultarUm("SELECT id FROM usuarios WHERE email = $1", [email.toLowerCase()]);
  if (jaExiste) {
    return res.status(409).json({ erro: "Já existe uma conta com esse e-mail." });
  }

  // A senha nunca e gravada como texto: guardamos so o hash.
  const hash = await bcrypt.hash(senha, 10);
  const usuario = await consultarUm(
    "INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email",
    [nome.trim(), email.toLowerCase().trim(), hash]
  );

  req.session.usuarioId = usuario.id;
  res.status(201).json(usuario);
});

// Entrar.
rotas.post("/entrar", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Informe o e-mail e a senha." });
  }

  const usuario = await consultarUm(
    "SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1",
    [email.toLowerCase().trim()]
  );

  // A mesma mensagem para e-mail inexistente e senha errada, para nao
  // revelar quais e-mails estao cadastrados.
  const senhaConfere = usuario && (await bcrypt.compare(senha, usuario.senha_hash));
  if (!senhaConfere) {
    return res.status(401).json({ erro: "E-mail ou senha incorretos." });
  }

  req.session.usuarioId = usuario.id;
  res.json({ id: usuario.id, nome: usuario.nome, email: usuario.email });
});

// Sair.
rotas.post("/sair", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Quem esta logado agora.
rotas.get("/eu", async (req, res) => {
  if (!req.session.usuarioId) return res.status(401).json({ erro: "Não autenticado." });
  const usuario = await consultarUm("SELECT id, nome, email FROM usuarios WHERE id = $1", [req.session.usuarioId]);
  if (!usuario) return res.status(401).json({ erro: "Não autenticado." });
  res.json(usuario);
});

module.exports = { rotas, exigirLogin };

// ===============================================================
// Revisado - servidor principal
//
// Front-end e back-end no mesmo projeto, mas separados em pastas:
//   public/  -> front-end (HTML, CSS e JavaScript do navegador)
//   src/     -> back-end (Express, rotas, regra de negócio e banco)
// ===============================================================
require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

const { rotas: rotasAuth, exigirLogin } = require("./rotas/auth.js");
const { rotas: rotasVeiculos } = require("./rotas/veiculos.js");
const { rotas: rotasServicos } = require("./rotas/servicos.js");

const app = express();
const PORTA = process.env.PORT || 3000;

// --- Configuracao basica ---------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// O Render fica atras de um proxy; sem isso o cookie seguro nao funciona.
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "troque-isto-em-producao",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // sete dias
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

// --- Rotas da API ----------------------------------------------
app.use("/api/auth", rotasAuth);
app.use("/api/veiculos", exigirLogin, rotasVeiculos);
app.use("/api/veiculos", exigirLogin, rotasServicos);

// Rota de saude: util para conferir se o servidor subiu no Render.
app.get("/api/saude", (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));

// --- Tratamento de erro ----------------------------------------
// Qualquer erro nao previsto cai aqui, para o usuario nunca ver
// uma pagina branca nem o rastro do erro.
app.use((erro, req, res, proximo) => {
  console.error("Erro:", erro);
  res.status(500).json({ erro: "Algo deu errado no servidor. Tente novamente." });
});

app.listen(PORTA, () => {
  console.log(`Revisado rodando em http://localhost:${PORTA}`);
});

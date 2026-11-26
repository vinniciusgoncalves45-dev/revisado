// ===============================================================
// Cria as tabelas no banco. Rode uma vez, com: npm run migrate
// ===============================================================
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./index.js");

async function migrar() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Tabelas criadas com sucesso.");
  await pool.end();
}

migrar().catch((erro) => {
  console.error("Falha ao criar as tabelas:", erro.message);
  process.exit(1);
});

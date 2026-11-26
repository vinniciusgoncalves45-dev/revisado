// ===============================================================
// Conexao com o banco de dados PostgreSQL.
// ===============================================================
const { Pool } = require("pg");

// A string de conexao vem da variavel de ambiente DATABASE_URL.
// No Render ela e preenchida automaticamente ao ligar o banco ao servico.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // O Render exige SSL. Em desenvolvimento local, nao.
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

// Executa uma consulta e devolve as linhas.
async function consultar(sql, parametros = []) {
  const resultado = await pool.query(sql, parametros);
  return resultado.rows;
}

// Executa uma consulta que deve devolver uma linha so.
async function consultarUm(sql, parametros = []) {
  const linhas = await consultar(sql, parametros);
  return linhas[0] || null;
}

// Roda varias operacoes dentro de uma transacao: ou tudo funciona,
// ou nada e gravado.
async function transacao(callback) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const retorno = await callback(cliente);
    await cliente.query("COMMIT");
    return retorno;
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = { pool, consultar, consultarUm, transacao };

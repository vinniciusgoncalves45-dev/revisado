-- ===============================================================
-- Revisado - estrutura do banco de dados
-- PostgreSQL
-- ===============================================================

-- Usuarios do sistema.
CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120)  NOT NULL,
  email       VARCHAR(160)  NOT NULL UNIQUE,
  senha_hash  VARCHAR(255)  NOT NULL,
  criado_em   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Veiculos cadastrados por cada usuario.
CREATE TABLE IF NOT EXISTS veiculos (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modelo        VARCHAR(120) NOT NULL,
  ano           INTEGER      NOT NULL CHECK (ano BETWEEN 1900 AND 2100),
  km_atual      INTEGER      NOT NULL CHECK (km_atual >= 0),
  km_por_mes    INTEGER      NOT NULL DEFAULT 1000 CHECK (km_por_mes >= 0),
  km_atualizado_em DATE      NOT NULL DEFAULT CURRENT_DATE,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_usuario ON veiculos(usuario_id);

-- Plano de manutencao: o que precisa ser feito e de quanto em quanto tempo.
-- Cada veiculo recebe uma copia do plano padrao no momento do cadastro,
-- para que o usuario possa ajustar os intervalos do carro dele.
CREATE TABLE IF NOT EXISTS itens_manutencao (
  id              SERIAL PRIMARY KEY,
  veiculo_id      INTEGER      NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  nome            VARCHAR(120) NOT NULL,
  intervalo_km    INTEGER      CHECK (intervalo_km IS NULL OR intervalo_km > 0),
  intervalo_meses INTEGER      CHECK (intervalo_meses IS NULL OR intervalo_meses > 0),
  km_ultima       INTEGER      NOT NULL DEFAULT 0 CHECK (km_ultima >= 0),
  data_ultima     DATE,
  CONSTRAINT intervalo_obrigatorio
    CHECK (intervalo_km IS NOT NULL OR intervalo_meses IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_itens_veiculo ON itens_manutencao(veiculo_id);

-- Servicos realizados. Alimentam o historico e recalculam o proximo aviso.
CREATE TABLE IF NOT EXISTS servicos (
  id          SERIAL PRIMARY KEY,
  veiculo_id  INTEGER       NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  item_id     INTEGER       REFERENCES itens_manutencao(id) ON DELETE SET NULL,
  descricao   VARCHAR(160)  NOT NULL,
  data        DATE          NOT NULL,
  km          INTEGER       NOT NULL CHECK (km >= 0),
  valor       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  oficina     VARCHAR(120),
  tem_nota    BOOLEAN       NOT NULL DEFAULT FALSE,
  criado_em   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicos_veiculo_data ON servicos(veiculo_id, data DESC);

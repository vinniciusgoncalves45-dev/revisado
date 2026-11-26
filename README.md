# Revisado

Sistema web de controle de manutenção de veículos.

> "Seu carro avisa quando precisa de manutenção."

Projeto integrador do Curso Técnico em Desenvolvimento de Sistemas — 3º Módulo,
CEDUP Renato Ramos da Silva.

**Integrantes:** Cristiano, Everson e Vinnícius Gonçalves Joaquim

---

## O problema

Muitas pessoas esquecem revisões, troca de óleo, pneus e outros cuidados do
veículo. As informações ficam espalhadas entre notas fiscais, mensagens de
WhatsApp e a memória do dono. Quem tenta controlar por planilha acaba
abandonando, porque dá trabalho manter atualizada.

O sistema resolve isso centralizando o histórico e calculando sozinho quando
cada manutenção vence — por quilometragem ou por data, o que chegar primeiro.

## Como está organizado

O projeto separa front-end e back-end em pastas diferentes:

```
revisado/
├── public/                 FRONT-END (roda no navegador)
│   ├── index.html          as seis telas da aplicação
│   ├── css/estilo.css      identidade visual vinda do protótipo
│   └── js/
│       ├── api.js          conversa com o back-end
│       └── app.js          navegação entre telas e regras de tela
│
├── src/                    BACK-END (roda no servidor)
│   ├── server.js           configura o Express e liga as rotas
│   ├── rotas/
│   │   ├── auth.js         criar conta, entrar, sair
│   │   ├── veiculos.js     cadastrar carros e montar o painel
│   │   └── servicos.js     histórico e registro de serviços
│   ├── servicos/
│   │   ├── manutencao.js   regra de negócio: calcula o que está vencendo
│   │   └── planoPadrao.js  plano de manutenção criado para cada carro
│   └── db/
│       ├── index.js        conexão com o PostgreSQL
│       ├── schema.sql      estrutura das tabelas
│       └── migrate.js      cria as tabelas
│
└── tests/
    ├── manutencao.test.js  testes unitários da regra de negócio
    └── fluxo.smoke.js      teste de integração do fluxo completo
```

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Front-end | HTML, CSS e JavaScript puro |
| Tipografia | Manrope (Google Fonts) |
| Back-end | Node.js com Express |
| Banco de dados | PostgreSQL |
| Sessão e senha | express-session e bcryptjs |
| Testes | Executor de testes nativo do Node |
| Nuvem | Render |
| Código-fonte | GitHub |

Não foi usado framework de front-end de propósito: o sistema é pequeno e isso
deixa a separação entre as camadas mais fácil de explicar e de manter.

## Banco de dados

Quatro tabelas:

- **usuarios** — quem acessa o sistema. A senha é gravada como hash, nunca em texto.
- **veiculos** — os carros de cada usuário. Um usuário pode ter vários.
- **itens_manutencao** — o plano de manutenção de cada carro, com os intervalos
  em quilômetros e em meses.
- **servicos** — o que já foi feito. Alimenta o histórico e recalcula o próximo aviso.

## Como rodar na sua máquina

Precisa de Node 20 ou mais novo e de um PostgreSQL.

```bash
npm install
cp .env.example .env     # preencha o DATABASE_URL
npm run migrate          # cria as tabelas
npm start                # sobe em http://localhost:3000
```

## Testes

```bash
npm test                 # 26 testes unitários da regra de negócio
node tests/fluxo.smoke.js  # 30 verificações de integração (precisa do servidor no ar)
```

Os testes unitários cobrem o cálculo de vencimento por quilometragem e por data,
a estimativa de quilometragem, a definição do estado (em dia, em breve, urgente),
a ordenação por urgência e os cálculos de gasto. O teste de integração percorre
o fluxo inteiro: criar conta, cadastrar dois carros, registrar serviço, conferir
o recálculo, buscar no histórico e verificar que um usuário não acessa o carro
de outro.

## Publicar no Render

1. Suba o projeto para um repositório no GitHub.
2. No Render, crie um **PostgreSQL** (plano gratuito) e copie a *Internal Database URL*.
3. Crie um **Web Service** apontando para o repositório, com:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Em *Environment*, cadastre:
   - `DATABASE_URL` — a URL copiada no passo 2
   - `SESSION_SECRET` — uma chave aleatória
   - `NODE_ENV` — `production`
5. Depois do primeiro deploy, rode a migração uma vez pelo Shell do Render:
   `npm run migrate`

## Decisões de projeto

**A quilometragem é estimada, não cobrada.** O usuário informa quanto roda por
mês e o sistema projeta o resto, pedindo confirmação de vez em quando. Foi a
Solução 1 da etapa de Ideação, criada para o aplicativo não repetir o erro da
planilha, que é exigir cadastro o tempo todo.

**O plano de manutenção já vem pronto.** Ao cadastrar um carro, dez itens comuns
são criados automaticamente com seus intervalos. O usuário não precisa montar
nada.

**A cor nunca aparece sozinha.** Todo estado de manutenção traz a palavra escrita
junto da cor, para quem não distingue bem as cores.

**Um usuário nunca acessa o carro de outro.** Todas as rotas conferem o dono do
veículo antes de responder, e não apenas se há alguém logado.

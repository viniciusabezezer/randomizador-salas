'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const M = require(path.join(raiz, 'mapa-salas.js'));

const CHAVE_PUBLICA = 'sb_publishable_LbDAh1pdkGAlWc7KY0v1ow_LusWcVg-';

test('lista numerada guarda o número escrito; sem número, vale a ordem na turma', () => {
  const texto = [
    '1º A',
    '7 - Ana Lima',
    '8. Bruno Dias',
    '',
    '1º B',
    '4 - Carla Mendes',
    '12) Daniel Souza'
  ].join('\n');

  const turmas = M.parseListas(texto);
  assert.deepEqual(turmas.map(t => t.nome), ['1º A', '1º B']);

  const a = turmas[0].alunos;
  assert.equal(a[0].nome, 'Ana Lima');
  assert.equal(a[0].numero, 7);
  assert.equal(a[0].numeroVeioDaLista, true);
  assert.equal(a[1].nome, 'Bruno Dias');
  assert.equal(a[1].numero, 8);
  assert.equal(a[1].numeroVeioDaLista, true);

  const b = turmas[1].alunos;
  assert.equal(b[0].numero, 4);
  assert.equal(b[1].numero, 12);
  assert.equal(b[1].numeroVeioDaLista, true);
});

test('nome sem número depois de uma lista numerada abre outra turma', () => {
  const turmas = M.parseListas('1º A\n7 - Ana Lima\nBruno Dias\n1 - Carla Mendes\n');
  assert.equal(turmas[0].nome, '1º A');
  assert.deepEqual(turmas[0].alunos.map(a => a.nome), ['Ana Lima']);
  assert.equal(turmas[1].nome, 'Bruno Dias');
  assert.equal(turmas[1].alunos[0].nome, 'Carla Mendes');
  assert.equal(turmas[1].alunos[0].numero, 1);
});

test('matrícula de 4 dígitos ou mais não vira número da lista', () => {
  const turmas = M.parseListas('1º A\n20241 - Elena Costa\n3 - Fabio Nunes\n');
  assert.equal(turmas[0].alunos[0].nome, 'Elena Costa');
  assert.equal(turmas[0].alunos[0].numero, 1);
  assert.equal(turmas[0].alunos[0].numeroVeioDaLista, false);
  assert.equal(turmas[0].alunos[1].numero, 3);
  assert.equal(turmas[0].alunos[1].numeroVeioDaLista, true);
});

test('turma inteira sem número usa 1, 2, 3 na ordem colada', () => {
  const turmas = M.parseListas('2º C\nHelena Prado\nIgor Santos\nJulia Pires\n');
  assert.deepEqual(turmas[0].alunos.map(a => a.numero), [1, 2, 3]);
  assert.ok(turmas[0].alunos.every(a => a.numeroVeioDaLista === false));
});

test('posição segue a lista de frequência (ordem alfabética), não a cadeira', () => {
  const grade = [[
    { nome: 'Bruno Dias', turma: '1º A', numero: 2 },
    { nome: 'Ana Lima', turma: '1º A', numero: 7 },
    null
  ]];
  const alunos = M.alunosNaOrdemDaFrequencia(grade);
  assert.deepEqual(alunos, [
    { posicao: 1, turma: '1º A', numero: 7, nome: 'Ana Lima' },
    { posicao: 2, turma: '1º A', numero: 2, nome: 'Bruno Dias' }
  ]);
});

test('arquivo malu-mapa-salas v1 e nome do download', () => {
  const turmas = M.parseListas('1º A\n7 - Ana Lima\n2 - Bruno Dias\n\n1º B\n1 - Carla Mendes\n');
  const sala1 = [[{ nome: 'Bruno Dias', turma: '1º A', numero: 2 }, { nome: 'Ana Lima', turma: '1º A', numero: 7 }]];
  const sala2 = [[{ nome: 'Carla Mendes', turma: '1º B', numero: 1 }]];
  const mapa = M.montarMapa({
    avaliacao: 'Avaliação Bimestral de Linguagens',
    inicio: '2026-12-01',
    fim: '2026-12-04',
    geradoEm: '2026-11-22T15:04:05.000Z',
    nomesSalas: ['Sala 12', 'Sala 14'],
    salas: [sala1, sala2]
  });

  assert.equal(mapa.formato, 'malu-mapa-salas');
  assert.equal(mapa.versao, 1);
  assert.equal(mapa.avaliacao, 'Avaliação Bimestral de Linguagens');
  assert.deepEqual(mapa.periodo, { inicio: '2026-12-01', fim: '2026-12-04' });
  assert.equal(mapa.gerado_em, '2026-11-22T15:04:05.000Z');
  assert.deepEqual(Object.keys(mapa), ['formato', 'versao', 'avaliacao', 'periodo', 'gerado_em', 'salas']);

  assert.equal(mapa.salas[0].sala, 'Sala 12');
  assert.equal(mapa.salas[0].ordem, 1);
  assert.equal(mapa.salas[1].sala, 'Sala 14');
  assert.equal(mapa.salas[1].ordem, 2);
  assert.deepEqual(mapa.salas[0].alunos[0], { posicao: 1, turma: '1º A', numero: 7, nome: 'Ana Lima' });
  assert.deepEqual(Object.keys(mapa.salas[0].alunos[0]), ['posicao', 'turma', 'numero', 'nome']);
  assert.equal(typeof mapa.salas[0].alunos[0].numero, 'number');

  const checagem = M.validarMapa(mapa);
  assert.equal(checagem.ok, true, checagem.erros.join('; '));

  assert.equal(
    M.nomeArquivo(mapa.avaliacao, mapa.periodo.inicio),
    'mapa-salas-avaliacao-bimestral-de-linguagens-2026-12-01.json'
  );

  const deNovo = M.montarMapa({
    avaliacao: mapa.avaliacao,
    inicio: mapa.periodo.inicio,
    fim: mapa.periodo.fim,
    geradoEm: mapa.gerado_em,
    nomesSalas: ['Sala 12', 'Sala 14'],
    salas: [sala1, sala2]
  });
  assert.deepEqual(deNovo, mapa);

  assert.equal(turmas[0].alunos[0].numero, 7);
});

test('número que faltou no sorteio antigo é preenchido pela lista colada', () => {
  const turmas = M.parseListas('1º A\n7 - Ana Lima\n');
  const salas = [[[{ nome: 'Ana Lima', turma: '1º A' }]]];
  const completas = M.completarNumeros(salas, turmas);
  assert.equal(completas[0][0][0].numero, 7);
  assert.equal(salas[0][0][0].numero, undefined);
});

test('mapa inválido é recusado', () => {
  const ruim = M.validarMapa({ formato: 'outro', versao: 2, salas: [] });
  assert.equal(ruim.ok, false);
  assert.ok(ruim.erros.length >= 1);
});

test('número repetido na mesma turma impede o arquivo', () => {
  const mapa = M.montarMapa({
    avaliacao: 'Prova',
    inicio: '2026-12-01',
    fim: '2026-12-01',
    geradoEm: '2026-11-22T15:04:05.000Z',
    nomesSalas: ['Sala 1'],
    salas: [[[
      { nome: 'Ana Lima', turma: '1º A', numero: 7 },
      { nome: 'Bruno Dias', turma: '1º A', numero: 7 }
    ]]]
  });
  const checagem = M.validarMapa(mapa);
  assert.equal(checagem.ok, false);
  assert.match(checagem.erros.join(' '), /repetido/);
});

test('envio ao painel não leva senha e só a gestão segue adiante', async () => {
  const mapa = M.montarMapa({
    avaliacao: 'Avaliação Bimestral',
    inicio: '2026-12-01',
    fim: '2026-12-04',
    geradoEm: '2026-11-22T15:04:05.000Z',
    nomesSalas: ['Sala 12'],
    salas: [[[{ nome: 'Ana Lima', turma: '1º A', numero: 7 }]]]
  });
  const senha = 'senha-super-secreta-xyz';
  const chamadas = [];

  function fetchFalso(url, init) {
    chamadas.push({ url, init });
    if (url.includes('/auth/v1/token')) {
      return Promise.resolve(resposta(200, {
        access_token: 'token-da-sessao',
        user: { id: '11111111-1111-1111-1111-111111111111', email: 'gestao@escola.test' }
      }));
    }
    if (url.includes('/rest/v1/montador_perfis')) {
      return Promise.resolve(resposta(200, [{ id: '11111111-1111-1111-1111-111111111111', papel: 'gestao', ativo: true, nome: 'Coordenação' }]));
    }
    if (url.includes('/rest/v1/mapas_salas')) {
      return Promise.resolve(resposta(201, {}));
    }
    return Promise.resolve(resposta(500, {}));
  }

  const ok = await M.salvarMapaOficial({ email: ' Gestao@Escola.Test ', senha, mapa, fetch: fetchFalso });
  assert.equal(ok.ok, true);
  assert.match(ok.mensagem, /Identificador/);

  const login = chamadas[0];
  assert.equal(login.init.headers.apikey, CHAVE_PUBLICA);
  assert.equal(login.init.headers.Authorization, 'Bearer ' + CHAVE_PUBLICA);
  assert.deepEqual(JSON.parse(login.init.body), { email: 'gestao@escola.test', password: senha });

  const perfil = chamadas[1];
  assert.equal(perfil.init.headers.Authorization, 'Bearer token-da-sessao');
  assert.match(perfil.url, /montador_perfis/);

  const insert = chamadas[2];
  assert.equal(insert.init.method, 'POST');
  assert.equal(insert.init.headers.apikey, CHAVE_PUBLICA);
  assert.equal(insert.init.headers.Authorization, 'Bearer token-da-sessao');
  const corpo = JSON.parse(insert.init.body);
  assert.equal(corpo.avaliacao, 'Avaliação Bimestral');
  assert.deepEqual(corpo.periodo, { inicio: '2026-12-01', fim: '2026-12-04' });
  assert.equal(corpo.mapa.formato, 'malu-mapa-salas');
  assert.equal(corpo.mapa.versao, 1);
  assert.equal(JSON.stringify(corpo).includes(senha), false);
  assert.equal(JSON.stringify(corpo).includes('service_role'), false);
  assert.equal(chamadas.length, 3);
});

test('conta que não é gestão não grava o mapa', async () => {
  const mapa = mapaMinimo();
  const chamadas = [];
  const fetchFalso = (url) => {
    chamadas.push(url);
    if (url.includes('/auth/v1/token')) {
      return Promise.resolve(resposta(200, { access_token: 't', user: { id: 'abc' } }));
    }
    return Promise.resolve(resposta(200, [{ papel: 'professor', ativo: true, nome: 'Prof' }]));
  };
  const r = await M.salvarMapaOficial({ email: 'prof@escola.test', senha: 'x', mapa, fetch: fetchFalso });
  assert.equal(r.ok, false);
  assert.match(r.mensagem, /gestão/);
  assert.equal(chamadas.some(u => u.includes('/mapas_salas')), false);
});

test('senha errada e falta de internet têm aviso claro', async () => {
  const mapa = mapaMinimo();
  const senhaErrada = await M.salvarMapaOficial({
    email: 'a@b.c',
    senha: 'nao',
    mapa,
    fetch: async () => resposta(400, { error_description: 'Invalid login credentials', msg: 'Invalid login credentials' })
  });
  assert.equal(senhaErrada.ok, false);
  assert.match(senhaErrada.mensagem, /senha/);

  const semRede = await M.salvarMapaOficial({
    email: 'a@b.c',
    senha: 'x',
    mapa,
    fetch: async () => { throw new Error('Failed to fetch'); }
  });
  assert.equal(semRede.ok, false);
  assert.match(semRede.mensagem, /internet|arquivo/i);
});

test('tabela ainda não criada explica sem jargão de banco', async () => {
  const mapa = mapaMinimo();
  let passo = 0;
  const r = await M.salvarMapaOficial({
    email: 'a@b.c',
    senha: 'x',
    mapa,
    fetch: async (url) => {
      passo += 1;
      if (url.includes('/token')) return resposta(200, { access_token: 't', user: { id: 'abc' } });
      if (url.includes('montador_perfis')) return resposta(200, [{ papel: 'gestao', ativo: true }]);
      return resposta(404, { code: 'PGRST205', message: "Could not find the table 'public.mapas_salas' in the schema cache" });
    }
  });
  assert.equal(passo, 3);
  assert.equal(r.ok, false);
  assert.match(r.mensagem, /baixe o arquivo/i);
});

test('a página oferece os dois caminhos e a chave pública do painel', () => {
  const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  [
    'Baixar mapa para o Identificador de Provas',
    'Salvar como mapa oficial no painel',
    'nome dos alunos',
    'banco da escola',
    'mapa-salas.js',
    'Gerar novamente muda'
  ].forEach(function (trecho) {
    assert.ok(html.includes(trecho), 'faltou na página: ' + trecho);
  });
  const js = fs.readFileSync(path.join(raiz, 'mapa-salas.js'), 'utf8');
  assert.ok(js.includes(CHAVE_PUBLICA), 'chave pública do painel ausente');
  assert.equal(js.includes('service_role'), false);
  assert.equal(js.includes('eyJ'), false);
  const kit = fs.readFileSync(path.join(raiz, 'kit-compartilhavel', 'mapa-salas.js'), 'utf8');
  assert.equal(kit, js);
});

test('migração cria mapas_salas com RLS e não é aplicada por este teste', () => {
  const sql = fs.readFileSync(path.join(raiz, 'supabase', 'mapas_salas.sql'), 'utf8');
  assert.match(sql, /create table public\.mapas_salas/i);
  assert.match(sql, /avaliacao/);
  assert.match(sql, /periodo/);
  assert.match(sql, /mapa\s+jsonb/);
  assert.match(sql, /criado_por/);
  assert.match(sql, /criado_em/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /montador_papel\(\)\s*=\s*'gestao'/);
  assert.match(sql, /revoke all on table public\.mapas_salas from public, anon/i);
  assert.match(sql, /malu-mapa-salas/);
  assert.equal(/service_role/i.test(sql), false);
  assert.match(sql, /NÃO APLICAR|NAO APLICAR|não foi aplicada|nao foi aplicada/i);
});

function mapaMinimo() {
  return M.montarMapa({
    avaliacao: 'Prova',
    inicio: '2026-12-01',
    fim: '2026-12-04',
    geradoEm: '2026-11-22T15:04:05.000Z',
    nomesSalas: ['Sala 12'],
    salas: [[[{ nome: 'Ana Lima', turma: '1º A', numero: 7 }]]]
  });
}

function resposta(status, json) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => json
  };
}

/* Mapa de salas para o Identificador de Provas.
   Roda no navegador (página offline) e no teste (Node).
   A chave abaixo é a mesma chave pública do Identificador e do Montador
   (provas/js/config.js e montar/js/config.js). Não é segredo: quem protege
   os nomes é a regra do banco, que só deixa a gestão gravar. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.MapaSalas = api;
  else if (root) root.MapaSalas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FORMATO = 'malu-mapa-salas';
  const VERSAO = 1;
  const PAINEL = {
    url: 'https://yncpicdkrntvwfdxrvab.supabase.co',
    chave: 'sb_publishable_LbDAh1pdkGAlWc7KY0v1ow_LusWcVg-'
  };

  /* "7 - Ana", "7. Ana", "7) Ana" ou "7 Ana". O número só vale se tiver
     de 1 a 3 dígitos (número da lista). Matrícula longa não conta. */
  const ALUNO_RE = /^\s*(\d+)\s*[-.)]\s*(.+?)\s*$/;
  const ALUNO_RE_BARE = /^\s*(\d+)\s+(\D.*?)\s*$/;

  function numeroDaLista(digitos) {
    if (digitos.length > 3) return null;
    const n = parseInt(digitos, 10);
    return n >= 1 ? n : null;
  }

  function fecharNumeros(turma) {
    turma.alunos.forEach(function (a, i) {
      if (a.numero == null) {
        a.numero = i + 1;
        a.numeroVeioDaLista = false;
      }
    });
  }

  /* Mesma leitura de turmas de antes. Cada aluno sai com:
     - numero: o que estava escrito na frente, ou a ordem na turma (1, 2, 3…)
     - numeroVeioDaLista: true só quando o número estava escrito na cola */
  function parseListas(texto) {
    const linhas = String(texto || '').split(/\r?\n/);
    const turmas = [];
    let atual = null, esperaCabecalho = false, ultimoNumerado = false;
    for (const raw of linhas) {
      const linha = raw.trim();
      if (linha === '') { esperaCabecalho = true; continue; }
      const m = linha.match(ALUNO_RE) || linha.match(ALUNO_RE_BARE);
      if (m) {
        if (!atual) { atual = { nome: 'Sem turma', alunos: [] }; turmas.push(atual); }
        const numero = numeroDaLista(m[1]);
        atual.alunos.push({
          nome: m[2].trim(),
          numero: numero,
          numeroVeioDaLista: numero != null
        });
        ultimoNumerado = true;
        esperaCabecalho = false;
      } else {
        const ehCabecalho = !atual || esperaCabecalho || (atual.alunos.length > 0 && ultimoNumerado);
        if (ehCabecalho) { atual = { nome: linha, alunos: [] }; turmas.push(atual); }
        else {
          atual.alunos.push({ nome: linha, numero: null, numeroVeioDaLista: false });
        }
        ultimoNumerado = false;
        esperaCabecalho = false;
      }
    }
    turmas.forEach(fecharNumeros);
    return turmas.filter(function (t) { return t.alunos.length > 0; });
  }

  function alunoParaSala(nomeTurma, a) {
    if (typeof a === 'string') return { nome: a, turma: nomeTurma, numero: null };
    return {
      nome: a.nome,
      turma: nomeTurma,
      numero: a.numero == null ? null : a.numero
    };
  }

  /* Preenche número que um sorteio antigo não guardou, olhando a lista colada.
     Não mexe na grade original. */
  function completarNumeros(salas, turmas) {
    const filas = {};
    (turmas || []).forEach(function (t) {
      filas[t.nome] = {};
      t.alunos.forEach(function (a) {
        const nome = typeof a === 'string' ? a : a.nome;
        const numero = typeof a === 'string' ? null : a.numero;
        if (!filas[t.nome][nome]) filas[t.nome][nome] = [];
        filas[t.nome][nome].push(numero);
      });
    });
    return (salas || []).map(function (grade) {
      return grade.map(function (row) {
        return row.map(function (s) {
          if (!s) return s;
          if (s.numero != null && s.numero !== '') return s;
          const fila = filas[s.turma] && filas[s.turma][s.nome];
          const numero = fila && fila.length ? fila.shift() : null;
          return { nome: s.nome, turma: s.turma, numero: numero };
        });
      });
    });
  }

  /* A mesma ordem da lista de frequência impressa: nome, em português. */
  function alunosNaOrdemDaFrequencia(grade) {
    const alunos = [];
    (grade || []).forEach(function (row) {
      (row || []).forEach(function (s) { if (s) alunos.push(s); });
    });
    alunos.sort(function (a, b) {
      return String(a.nome).localeCompare(String(b.nome), 'pt');
    });
    return alunos.map(function (a, i) {
      return {
        posicao: i + 1,
        turma: a.turma,
        numero: Number(a.numero),
        nome: a.nome
      };
    });
  }

  function montarMapa(opts) {
    const nomes = opts.nomesSalas || [];
    const inicio = opts.inicio || '';
    const fim = opts.fim || inicio;
    return {
      formato: FORMATO,
      versao: VERSAO,
      avaliacao: opts.avaliacao || 'Avaliação',
      periodo: { inicio: inicio, fim: fim },
      gerado_em: opts.geradoEm,
      salas: (opts.salas || []).map(function (grade, i) {
        return {
          sala: nomes[i] || ('Sala ' + (i + 1)),
          ordem: i + 1,
          alunos: alunosNaOrdemDaFrequencia(grade)
        };
      })
    };
  }

  function nomeArquivo(avaliacao, dataIso) {
    const base = String(avaliacao || 'avaliacao')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'avaliacao';
    const data = String(dataIso || '').slice(0, 10) || 'sem-data';
    return 'mapa-salas-' + base + '-' + data + '.json';
  }

  function validarMapa(mapa) {
    const erros = [];
    if (!mapa || typeof mapa !== 'object') {
      return { ok: false, erros: ['O arquivo não parece um mapa de salas.'] };
    }
    if (mapa.formato !== FORMATO) erros.push('Este arquivo não é um mapa de salas do Identificador.');
    if (mapa.versao !== VERSAO) erros.push('A versão do mapa não é a esperada.');
    if (!mapa.avaliacao || typeof mapa.avaliacao !== 'string') erros.push('Falta o nome da avaliação.');
    const periodo = mapa.periodo || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodo.inicio || '')) erros.push('Falta o primeiro dia da prova.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodo.fim || '')) erros.push('Falta o último dia da prova.');
    if (!mapa.gerado_em || Number.isNaN(Date.parse(mapa.gerado_em))) erros.push('Falta a data em que o mapa foi feito.');
    if (!Array.isArray(mapa.salas) || mapa.salas.length === 0) erros.push('O mapa não tem salas.');

    const vistos = {};
    (mapa.salas || []).forEach(function (sala, i) {
      if (!sala || typeof sala.sala !== 'string' || !sala.sala) erros.push('Uma sala está sem nome.');
      if (!sala || sala.ordem !== i + 1) erros.push('A ordem das salas está fora da sequência.');
      if (!sala || !Array.isArray(sala.alunos) || sala.alunos.length === 0) {
        erros.push('A sala ' + ((sala && sala.sala) || (i + 1)) + ' está sem alunos.');
        return;
      }
      sala.alunos.forEach(function (a, j) {
        if (!a || a.posicao !== j + 1) erros.push('A posição dos alunos na sala ' + (sala.sala || i + 1) + ' não está em ordem.');
        if (!a || typeof a.nome !== 'string' || !a.nome.trim()) erros.push('Tem aluno sem nome.');
        if (!a || typeof a.turma !== 'string' || !a.turma.trim()) erros.push('Tem aluno sem turma.');
        if (!a || typeof a.numero !== 'number' || !Number.isInteger(a.numero) || a.numero < 1) {
          erros.push('Tem aluno sem número da lista.');
        }
        if (a && a.turma && Number.isInteger(a.numero)) {
          const chave = a.turma + '#' + a.numero;
          if (vistos[chave]) erros.push('Número ' + a.numero + ' repetido na turma ' + a.turma + '.');
          vistos[chave] = true;
        }
      });
    });
    return { ok: erros.length === 0, erros: erros };
  }

  function pedidoLogin(email, senha) {
    return {
      url: PAINEL.url + '/auth/v1/token?grant_type=password',
      init: {
        method: 'POST',
        headers: {
          apikey: PAINEL.chave,
          Authorization: 'Bearer ' + PAINEL.chave,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: String(email || '').trim().toLowerCase(),
          password: senha
        })
      }
    };
  }

  function pedidoPerfil(userId, accessToken) {
    return {
      url: PAINEL.url + '/rest/v1/montador_perfis?id=eq.' + encodeURIComponent(userId) + '&select=id,papel,ativo,nome',
      init: {
        method: 'GET',
        headers: {
          apikey: PAINEL.chave,
          Authorization: 'Bearer ' + accessToken,
          Accept: 'application/json'
        }
      }
    };
  }

  function pedidoInsert(accessToken, mapa) {
    return {
      url: PAINEL.url + '/rest/v1/mapas_salas',
      init: {
        method: 'POST',
        headers: {
          apikey: PAINEL.chave,
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          avaliacao: mapa.avaliacao,
          periodo: mapa.periodo,
          mapa: mapa
        })
      }
    };
  }

  function textoErro(json) {
    if (!json) return '';
    return String(json.error_description || json.msg || json.message || json.error || '');
  }

  async function salvarMapaOficial(opts) {
    const fetchFn = opts.fetch || fetch;
    const mapa = opts.mapa;
    const checagem = validarMapa(mapa);
    if (!checagem.ok) {
      return { ok: false, mensagem: 'O mapa ainda não está completo. ' + checagem.erros[0] };
    }
    const login = pedidoLogin(opts.email, opts.senha);
    let loginRes;
    try {
      loginRes = await fetchFn(login.url, login.init);
    } catch (e) {
      return { ok: false, mensagem: 'Sem internet não dá para salvar no painel. Você ainda pode baixar o arquivo.' };
    }
    const loginJson = await loginRes.json().catch(function () { return {}; });
    if (!loginRes.ok) {
      const texto = textoErro(loginJson);
      if (/invalid login credentials/i.test(texto)) {
        return { ok: false, mensagem: 'E-mail ou senha não conferem. Use a mesma conta do Montador de Provas.' };
      }
      if (/email not confirmed/i.test(texto)) {
        return { ok: false, mensagem: 'Este e-mail ainda não foi confirmado.' };
      }
      return { ok: false, mensagem: 'Não foi possível entrar. Confira o e-mail, a senha e a internet.' };
    }
    const token = loginJson.access_token;
    const userId = loginJson.user && loginJson.user.id;
    if (!token || !userId) {
      return { ok: false, mensagem: 'Não foi possível entrar. Tente de novo.' };
    }

    const perfilReq = pedidoPerfil(userId, token);
    let perfilRes;
    try {
      perfilRes = await fetchFn(perfilReq.url, perfilReq.init);
    } catch (e) {
      return { ok: false, mensagem: 'Sem internet não dá para salvar no painel. Você ainda pode baixar o arquivo.' };
    }
    const perfilJson = await perfilRes.json().catch(function () { return null; });
    const perfil = Array.isArray(perfilJson) ? perfilJson[0] : perfilJson;
    if (!perfilRes.ok || !perfil || perfil.ativo === false || perfil.papel !== 'gestao') {
      return { ok: false, mensagem: 'Esta conta não é da gestão. Só a gestão pode salvar o mapa oficial.' };
    }

    const insert = pedidoInsert(token, mapa);
    let insRes;
    try {
      insRes = await fetchFn(insert.url, insert.init);
    } catch (e) {
      return { ok: false, mensagem: 'Sem internet não dá para salvar no painel. Você ainda pode baixar o arquivo.' };
    }
    if (insRes.ok) {
      return {
        ok: true,
        mensagem: 'Mapa oficial salvo. O Identificador de Provas passa a usar esta última distribuição, sem você precisar enviar arquivo.'
      };
    }
    const err = await insRes.json().catch(function () { return {}; });
    const codigo = err && err.code;
    const msg = textoErro(err);
    if (codigo === 'PGRST205' || /schema cache|does not exist|não encontr/i.test(msg)) {
      return {
        ok: false,
        mensagem: 'O banco da escola ainda não está pronto para guardar o mapa. Avise quem cuida do sistema. Enquanto isso, baixe o arquivo.'
      };
    }
    if (insRes.status === 401 || insRes.status === 403 || codigo === '42501') {
      return { ok: false, mensagem: 'O banco recusou. Só a gestão, com a conta do Montador de Provas, pode salvar o mapa oficial.' };
    }
    return { ok: false, mensagem: 'Não consegui salvar no painel. Confira a internet e tente de novo. O download do arquivo continua disponível.' };
  }

  return {
    FORMATO: FORMATO,
    VERSAO: VERSAO,
    PAINEL: PAINEL,
    parseListas: parseListas,
    alunoParaSala: alunoParaSala,
    completarNumeros: completarNumeros,
    alunosNaOrdemDaFrequencia: alunosNaOrdemDaFrequencia,
    montarMapa: montarMapa,
    nomeArquivo: nomeArquivo,
    validarMapa: validarMapa,
    salvarMapaOficial: salvarMapaOficial
  };
});

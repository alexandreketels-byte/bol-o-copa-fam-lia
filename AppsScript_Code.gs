/**
 * BOLÃO DA COPA - Backend (Google Apps Script)
 * ---------------------------------------------
 * Planilha com 4 abas: Participantes, Jogos, Palpites, (Ranking é calculado, não precisa criar aba)
 *
 * ABA "Participantes" (cabeçalho na linha 1):
 *   A: ID | B: Nome | C: FotoURL
 *
 * ABA "Jogos" (cabeçalho na linha 1):
 *   A: ID | B: DataHora (texto ISO ou data) | C: Fase | D: TimeCasa | E: TimeFora
 *   F: PlacarCasaReal | G: PlacarForaReal | H: Finalizado (TRUE/FALSE)
 *
 * ABA "Palpites" (cabeçalho na linha 1):
 *   A: ParticipanteID | B: JogoID | C: PlacarCasaPalpite | D: PlacarForaPalpite | E: DataHoraPalpite
 *
 * IMPLANTAÇÃO:
 *  1. Extensões > Apps Script, cole este código.
 *  2. Implantar > Nova implantação > Tipo: App da Web.
 *  3. Executar como: Eu. Quem tem acesso: Qualquer pessoa.
 *  4. Copie a URL gerada e cole em app.js (CONFIG.API_URL).
 */

const SHEET_PARTICIPANTES = 'Participantes';
const SHEET_JOGOS = 'Jogos';
const SHEET_PALPITES = 'Palpites';

// Senha simples do admin (troque por algo seu). Enviada no corpo da requisição admin.
const ADMIN_PASSWORD = 'TROQUE_ESTA_SENHA';

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getParticipantes') {
      return jsonOutput(getParticipantes_());
    }
    if (action === 'getJogos') {
      return jsonOutput(getJogos_());
    }
    if (action === 'getPalpites') {
      return jsonOutput(getPalpites_());
    }
    if (action === 'getRanking') {
      return jsonOutput(calcularRanking_());
    }
    if (action === 'getTudo') {
      return jsonOutput({
        participantes: getParticipantes_(),
        jogos: getJogos_(),
        palpites: getPalpites_(),
        ranking: calcularRanking_()
      });
    }

    return jsonOutput({ error: 'Ação inválida' });
  } catch (err) {
    return jsonOutput({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'salvarPalpite') {
      return jsonOutput(salvarPalpite_(body));
    }
    if (action === 'adminSalvarJogo') {
      checarSenhaAdmin_(body.senha);
      return jsonOutput(adminSalvarJogo_(body));
    }
    if (action === 'adminSalvarPlacarReal') {
      checarSenhaAdmin_(body.senha);
      return jsonOutput(adminSalvarPlacarReal_(body));
    }
    if (action === 'adminExcluirJogo') {
      checarSenhaAdmin_(body.senha);
      return jsonOutput(adminExcluirJogo_(body));
    }

    return jsonOutput({ error: 'Ação inválida' });
  } catch (err) {
    return jsonOutput({ error: err.message });
  }
}

// ---------- LEITURA ----------

function getParticipantes_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PARTICIPANTES);
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({ id: String(rows[i][0]), nome: rows[i][1], foto: rows[i][2] || '' });
  }
  return out;
}

function getJogos_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGOS);
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    const dataHora = rows[i][1];
    out.push({
      id: String(rows[i][0]),
      dataHora: dataHora instanceof Date ? dataHora.toISOString() : String(dataHora),
      fase: rows[i][2] || '',
      timeCasa: rows[i][3] || '',
      timeFora: rows[i][4] || '',
      placarCasaReal: rows[i][5] === '' ? null : Number(rows[i][5]),
      placarForaReal: rows[i][6] === '' ? null : Number(rows[i][6]),
      finalizado: rows[i][7] === true || String(rows[i][7]).toUpperCase() === 'TRUE'
    });
  }
  out.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
  return out;
}

function getPalpites_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PALPITES);
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      participanteId: String(rows[i][0]),
      jogoId: String(rows[i][1]),
      placarCasa: Number(rows[i][2]),
      placarFora: Number(rows[i][3]),
      dataHora: rows[i][4] instanceof Date ? rows[i][4].toISOString() : String(rows[i][4])
    });
  }
  return out;
}

// ---------- ESCRITA: PALPITE DO PARTICIPANTE ----------

function salvarPalpite_(body) {
  const participanteId = String(body.participanteId);
  const jogoId = String(body.jogoId);
  const placarCasa = Number(body.placarCasa);
  const placarFora = Number(body.placarFora);

  if (isNaN(placarCasa) || isNaN(placarFora) || placarCasa < 0 || placarFora < 0) {
    return { error: 'Placar inválido' };
  }

  // Trava: não permite salvar/editar se o jogo já começou
  const jogos = getJogos_();
  const jogo = jogos.find(j => j.id === jogoId);
  if (!jogo) return { error: 'Jogo não encontrado' };

  const agora = new Date();
  const inicioJogo = new Date(jogo.dataHora);
  if (agora >= inicioJogo) {
    return { error: 'O palpite para este jogo está travado (o jogo já começou).' };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PALPITES);
  const rows = sheet.getDataRange().getValues();

  let linhaExistente = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === participanteId && String(rows[i][1]) === jogoId) {
      linhaExistente = i + 1; // 1-indexed para o Sheets
      break;
    }
  }

  const agoraISO = new Date().toISOString();

  if (linhaExistente > 0) {
    sheet.getRange(linhaExistente, 3).setValue(placarCasa);
    sheet.getRange(linhaExistente, 4).setValue(placarFora);
    sheet.getRange(linhaExistente, 5).setValue(agoraISO);
  } else {
    sheet.appendRow([participanteId, jogoId, placarCasa, placarFora, agoraISO]);
  }

  return { ok: true };
}

// ---------- ADMIN ----------

function checarSenhaAdmin_(senha) {
  if (senha !== ADMIN_PASSWORD) {
    throw new Error('Senha de admin inválida');
  }
}

function adminSalvarJogo_(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGOS);
  const id = body.id ? String(body.id) : String(Date.now());

  const rows = sheet.getDataRange().getValues();
  let linhaExistente = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === id) {
      linhaExistente = i + 1;
      break;
    }
  }

  const valores = [
    id,
    body.dataHora,
    body.fase || '',
    body.timeCasa || '',
    body.timeFora || '',
    body.placarCasaReal === undefined || body.placarCasaReal === '' ? '' : Number(body.placarCasaReal),
    body.placarForaReal === undefined || body.placarForaReal === '' ? '' : Number(body.placarForaReal),
    body.finalizado === true
  ];

  if (linhaExistente > 0) {
    sheet.getRange(linhaExistente, 1, 1, valores.length).setValues([valores]);
  } else {
    sheet.appendRow(valores);
  }

  return { ok: true, id: id };
}

function adminSalvarPlacarReal_(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGOS);
  const rows = sheet.getDataRange().getValues();
  const jogoId = String(body.jogoId);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === jogoId) {
      const linha = i + 1;
      sheet.getRange(linha, 6).setValue(Number(body.placarCasaReal));
      sheet.getRange(linha, 7).setValue(Number(body.placarForaReal));
      sheet.getRange(linha, 8).setValue(true);
      return { ok: true };
    }
  }
  return { error: 'Jogo não encontrado' };
}

function adminExcluirJogo_(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_JOGOS);
  const rows = sheet.getDataRange().getValues();
  const jogoId = String(body.jogoId);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === jogoId) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Jogo não encontrado' };
}

// ---------- RANKING ----------

function calcularRanking_() {
  const participantes = getParticipantes_();
  const jogos = getJogos_().filter(j => j.finalizado);
  const palpites = getPalpites_();

  const pontosPorParticipante = {};
  const detalhePorParticipante = {};
  participantes.forEach(p => {
    pontosPorParticipante[p.id] = 0;
    detalhePorParticipante[p.id] = { placarExato: 0, resultadoCerto: 0, errou: 0, jogosPalpitados: 0 };
  });

  jogos.forEach(jogo => {
    const realCasa = jogo.placarCasaReal;
    const realFora = jogo.placarForaReal;
    const resultadoReal = realCasa > realFora ? 'casa' : (realCasa < realFora ? 'fora' : 'empate');

    palpites
      .filter(p => p.jogoId === jogo.id)
      .forEach(p => {
        if (!(p.participanteId in pontosPorParticipante)) return;

        const resultadoPalpite = p.placarCasa > p.placarFora ? 'casa' : (p.placarCasa < p.placarFora ? 'fora' : 'empate');
        const det = detalhePorParticipante[p.participanteId];
        det.jogosPalpitados++;

        if (p.placarCasa === realCasa && p.placarFora === realFora) {
          pontosPorParticipante[p.participanteId] += 3;
          det.placarExato++;
        } else if (resultadoPalpite === resultadoReal) {
          pontosPorParticipante[p.participanteId] += 1;
          det.resultadoCerto++;
        } else {
          det.errou++;
        }
      });
  });

  const ranking = participantes.map(p => ({
    id: p.id,
    nome: p.nome,
    foto: p.foto,
    pontos: pontosPorParticipante[p.id] || 0,
    detalhe: detalhePorParticipante[p.id]
  }));

  ranking.sort((a, b) => b.pontos - a.pontos);
  return ranking;
}

// ---------- UTIL ----------

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Rode esta função uma vez manualmente para criar as abas e cabeçalhos automaticamente,
 * caso ainda não tenha criado a planilha na mão.
 */
function configurarPlanilhaInicial() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sp = ss.getSheetByName(SHEET_PARTICIPANTES);
  if (!sp) sp = ss.insertSheet(SHEET_PARTICIPANTES);
  sp.getRange(1, 1, 1, 3).setValues([['ID', 'Nome', 'FotoURL']]);

  let sj = ss.getSheetByName(SHEET_JOGOS);
  if (!sj) sj = ss.insertSheet(SHEET_JOGOS);
  sj.getRange(1, 1, 1, 8).setValues([['ID', 'DataHora', 'Fase', 'TimeCasa', 'TimeFora', 'PlacarCasaReal', 'PlacarForaReal', 'Finalizado']]);

  let spa = ss.getSheetByName(SHEET_PALPITES);
  if (!spa) spa = ss.insertSheet(SHEET_PALPITES);
  spa.getRange(1, 1, 1, 5).setValues([['ParticipanteID', 'JogoID', 'PlacarCasaPalpite', 'PlacarForaPalpite', 'DataHoraPalpite']]);
}

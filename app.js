/**
 * BOLÃO DA COPA - Front-end
 * --------------------------
 * Troque API_URL pela URL do seu Web App do Google Apps Script.
 */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwG5EwDD-4TaNBhOFEFcrysKbAfxEjuCalHu2MiwxuCxzgcuTf6sRV_kr2Vi2cXOgTcbA/exec',
  SENHA_ADMIN_PADRAO: '' // opcional: pode deixar vazio e digitar na hora
};

const STORAGE_KEY = 'bolaoCopa_participanteId';

let estado = {
  participantes: [],
  jogos: [],
  palpites: [],
  ranking: [],
  participanteAtual: null,
  abaAtiva: 'palpites'
};

// ---------- INIT ----------

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  const idSalvo = localStorage.getItem(STORAGE_KEY);
  await carregarTudo();

  if (idSalvo && estado.participantes.find(p => p.id === idSalvo)) {
    estado.participanteAtual = idSalvo;
    renderizar();
  } else {
    renderizarLogin();
  }
}

async function carregarTudo() {
  try {
    const resp = await apiGet({ action: 'getTudo' });
    estado.participantes = resp.participantes || [];
    estado.jogos = resp.jogos || [];
    estado.palpites = resp.palpites || [];
    estado.ranking = resp.ranking || [];
  } catch (err) {
    mostrarToast('Erro ao carregar dados. Verifique a conexão.', true);
  }
}

// ---------- API ----------

async function apiGet(params) {
  const url = new URL(CONFIG.API_URL);
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  const resp = await fetch(url.toString());
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function apiPost(body) {
  const resp = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ---------- LOGIN ----------

function renderizarLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="tela-login">
      <div class="titulo-grande">Quem é <span class="destaque">você</span> no bolão?</div>
      <p class="legenda">Toque na sua foto para entrar e começar a palpitar nos jogos da Copa.</p>
      <div class="grade-participantes">
        ${estado.participantes.map(p => `
          <button class="cartao-participante" data-id="${p.id}" onclick="selecionarParticipante('${p.id}')">
            <img src="${p.foto || fotoPadrao()}" alt="${escapeHtml(p.nome)}" onerror="this.src='${fotoPadrao()}'">
            <span>${escapeHtml(p.nome)}</span>
          </button>
        `).join('')}
      </div>
      ${estado.participantes.length === 0 ? '<p class="vazio">Nenhum participante cadastrado ainda. Peça para o admin cadastrar na aba Participantes da planilha.</p>' : ''}
    </div>
  `;
}

function selecionarParticipante(id) {
  estado.participanteAtual = id;
  localStorage.setItem(STORAGE_KEY, id);
  renderizar();
}

function trocarParticipante() {
  localStorage.removeItem(STORAGE_KEY);
  estado.participanteAtual = null;
  renderizarLogin();
}

function fotoPadrao() {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%230F3D2E"/><circle cx="50" cy="38" r="18" fill="%23F2EFE6" opacity="0.5"/><rect x="20" y="62" width="60" height="34" rx="20" fill="%23F2EFE6" opacity="0.5"/></svg>`
  ).replace(/%23/g, '%23');
}

// ---------- RENDER PRINCIPAL ----------

function renderizar() {
  const app = document.getElementById('app');
  const eu = estado.participantes.find(p => p.id === estado.participanteAtual);

  app.innerHTML = `
    <div class="topo">
      <div class="marca">
        <div class="bola"></div>
        <div>
          <h1>Bolão da Copa</h1>
          <div class="sub">Bolão em família · 9 participantes</div>
        </div>
      </div>
      <div class="usuario-chip">
        <img src="${eu?.foto || fotoPadrao()}" onerror="this.src='${fotoPadrao()}'">
        <span>${escapeHtml(eu?.nome || '')}</span>
        <button onclick="trocarParticipante()">trocar</button>
      </div>
    </div>

    <div class="abas">
      <button class="aba-btn ${estado.abaAtiva === 'palpites' ? 'ativa' : ''}" onclick="mudarAba('palpites')">Meus palpites</button>
      <button class="aba-btn ${estado.abaAtiva === 'ranking' ? 'ativa' : ''}" onclick="mudarAba('ranking')">Classificação</button>
      <button class="aba-btn ${estado.abaAtiva === 'admin' ? 'ativa' : ''}" onclick="mudarAba('admin')">Admin</button>
    </div>

    <div id="conteudo-aba"></div>
  `;

  renderizarAbaAtiva();
}

function mudarAba(aba) {
  estado.abaAtiva = aba;
  document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('ativa'));
  renderizar();
}

function renderizarAbaAtiva() {
  if (estado.abaAtiva === 'palpites') renderizarPalpites();
  else if (estado.abaAtiva === 'ranking') renderizarRanking();
  else if (estado.abaAtiva === 'admin') renderizarAdmin();
}

// ---------- ABA PALPITES ----------

function renderizarPalpites() {
  const container = document.getElementById('conteudo-aba');
  const agora = new Date();

  if (estado.jogos.length === 0) {
    container.innerHTML = '<div class="vazio">Nenhum jogo cadastrado ainda. Peça para o admin cadastrar os jogos na aba Admin.</div>';
    return;
  }

  container.innerHTML = `
    <div class="lista-jogos">
      ${estado.jogos.map(jogo => renderizarCartaoJogo(jogo, agora)).join('')}
    </div>
  `;
}

function renderizarCartaoJogo(jogo, agora) {
  const inicio = new Date(jogo.dataHora);
  const travado = agora >= inicio;
  const meuPalpite = estado.palpites.find(p => p.participanteId === estado.participanteAtual && p.jogoId === jogo.id);

  const dataFormatada = inicio.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  let statusTag, statusClasse;
  if (jogo.finalizado) { statusTag = 'Finalizado'; statusClasse = 'final'; }
  else if (travado) { statusTag = 'Travado'; statusClasse = 'travado'; }
  else { statusTag = 'Aberto'; statusClasse = 'aberto'; }

  let pontosTag = '';
  if (jogo.finalizado && meuPalpite) {
    const pts = calcularPontosJogo(jogo, meuPalpite);
    const label = pts === 3 ? 'Placar exato · +3' : pts === 1 ? 'Resultado certo · +1' : 'Não pontuou';
    pontosTag = `<span class="resultado-palpite-tag pts-${pts}">${label}</span>`;
  }

  const placarCasaValor = meuPalpite ? meuPalpite.placarCasa : '';
  const placarForaValor = meuPalpite ? meuPalpite.placarFora : '';

  return `
    <div class="cartao-jogo ${travado ? 'travado' : ''} ${jogo.finalizado ? 'finalizado' : ''}" id="jogo-${jogo.id}">
      <div class="linha-meta">
        <span class="tag-fase">${escapeHtml(jogo.fase || 'Fase')} · ${dataFormatada}</span>
        <span class="tag-status ${statusClasse}">${statusTag}</span>
      </div>
      <div class="confronto">
        <div class="time">
          <span class="nome-time">${escapeHtml(jogo.timeCasa)}</span>
        </div>
        ${jogo.finalizado ? `
          <div class="placar-real-exibe">
            <span class="placar-real-num">${jogo.placarCasaReal}</span>
            <span class="versus">x</span>
            <span class="placar-real-num">${jogo.placarForaReal}</span>
          </div>
        ` : `
          <div class="placar-input-grupo">
            <input type="number" min="0" class="placar-input" id="casa-${jogo.id}" value="${placarCasaValor}" ${travado ? 'disabled' : ''} inputmode="numeric">
            <span class="versus">x</span>
            <input type="number" min="0" class="placar-input" id="fora-${jogo.id}" value="${placarForaValor}" ${travado ? 'disabled' : ''} inputmode="numeric">
          </div>
        `}
        <div class="time">
          <span class="nome-time">${escapeHtml(jogo.timeFora)}</span>
        </div>
      </div>
      <div class="rodape-jogo">
        ${jogo.finalizado
          ? pontosTag || '<span class="aviso-travado">Você não palpitou neste jogo</span>'
          : travado
            ? `<span class="aviso-travado">${meuPalpite ? 'Seu palpite: ' + meuPalpite.placarCasa + ' x ' + meuPalpite.placarFora : 'Você não palpitou — tempo esgotado'}</span>`
            : `<span class="aviso-travado">Vale 3 pts no placar exato, 1 pt no resultado</span><button class="btn-salvar" onclick="salvarPalpite('${jogo.id}')">Salvar palpite</button>`
        }
      </div>
    </div>
  `;
}

function calcularPontosJogo(jogo, palpite) {
  const resultadoReal = jogo.placarCasaReal > jogo.placarForaReal ? 'casa' : (jogo.placarCasaReal < jogo.placarForaReal ? 'fora' : 'empate');
  const resultadoPalpite = palpite.placarCasa > palpite.placarFora ? 'casa' : (palpite.placarCasa < palpite.placarFora ? 'fora' : 'empate');
  if (palpite.placarCasa === jogo.placarCasaReal && palpite.placarFora === jogo.placarForaReal) return 3;
  if (resultadoPalpite === resultadoReal) return 1;
  return 0;
}

async function salvarPalpite(jogoId) {
  const casaInput = document.getElementById(`casa-${jogoId}`);
  const foraInput = document.getElementById(`fora-${jogoId}`);
  const placarCasa = casaInput.value;
  const placarFora = foraInput.value;

  if (placarCasa === '' || placarFora === '') {
    mostrarToast('Preencha os dois placares.', true);
    return;
  }

  try {
    await apiPost({
      action: 'salvarPalpite',
      participanteId: estado.participanteAtual,
      jogoId: jogoId,
      placarCasa: placarCasa,
      placarFora: placarFora
    });
    mostrarToast('Palpite salvo! ⚽');
    await carregarTudo();
    renderizarAbaAtiva();
  } catch (err) {
    mostrarToast(err.message, true);
  }
}

// ---------- ABA RANKING ----------

function renderizarRanking() {
  const container = document.getElementById('conteudo-aba');
  const ranking = estado.ranking;

  if (ranking.length === 0) {
    container.innerHTML = '<div class="vazio">Ainda não há jogos finalizados para gerar classificação.</div>';
    return;
  }

  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3);

  const podioHtml = top3.length > 0 ? `
    <div class="podio">
      ${top3[1] ? renderizarPodioItem(top3[1], 2) : ''}
      ${top3[0] ? renderizarPodioItem(top3[0], 1) : ''}
      ${top3[2] ? renderizarPodioItem(top3[2], 3) : ''}
    </div>
  ` : '';

  container.innerHTML = `
    ${podioHtml}
    <div class="tabela-ranking">
      ${ranking.map((p, i) => `
        <div class="linha-ranking ${p.id === estado.participanteAtual ? 'voce' : ''}">
          <div class="pos-num">${i + 1}</div>
          <img src="${p.foto || fotoPadrao()}" onerror="this.src='${fotoPadrao()}'">
          <div class="info-ranking">
            <div class="nome-r">${escapeHtml(p.nome)}</div>
            <div class="detalhe-r">${p.detalhe.placarExato} placar exato · ${p.detalhe.resultadoCerto} resultado · ${p.detalhe.errou} errou</div>
          </div>
          <div class="pts-total">${p.pontos}<span>pontos</span></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderizarPodioItem(p, posicao) {
  return `
    <div class="pod-item p${posicao}">
      <img src="${p.foto || fotoPadrao()}" onerror="this.src='${fotoPadrao()}'">
      <div class="nome-pod">${escapeHtml(p.nome)}</div>
      <div class="pts-pod">${p.pontos} pts</div>
      <div class="pod-base"><div class="posicao">${posicao}º</div></div>
    </div>
  `;
}

// ---------- ABA ADMIN ----------

function renderizarAdmin() {
  const container = document.getElementById('conteudo-aba');
  container.innerHTML = `
    <div class="painel-admin">
      <div class="bloco-admin">
        <h3>Cadastrar / editar jogo</h3>
        <div class="campo">
          <label>Fase (ex: Grupo A, Oitavas, Final)</label>
          <input type="text" id="adm-fase" placeholder="Fase de grupos">
        </div>
        <div class="grade-2">
          <div class="campo">
            <label>Time de casa</label>
            <input type="text" id="adm-time-casa" placeholder="Brasil">
          </div>
          <div class="campo">
            <label>Time visitante</label>
            <input type="text" id="adm-time-fora" placeholder="Argentina">
          </div>
        </div>
        <div class="campo">
          <label>Data e hora do jogo</label>
          <input type="datetime-local" id="adm-data-hora">
        </div>
        <div class="campo">
          <label>Senha de admin</label>
          <input type="password" id="adm-senha" placeholder="Digite a senha de admin">
        </div>
        <button class="btn-primario" onclick="adminSalvarJogo()">Salvar jogo</button>
      </div>

      <div class="bloco-admin">
        <h3>Jogos cadastrados</h3>
        <div class="lista-jogos-admin">
          ${estado.jogos.length === 0 ? '<p class="vazio" style="padding:20px;">Nenhum jogo cadastrado.</p>' : estado.jogos.map(j => `
            <div class="item-jogo-admin">
              <div class="info-jogo-admin">
                <div class="nome-confronto">${escapeHtml(j.timeCasa)} x ${escapeHtml(j.timeFora)}</div>
                <div class="meta-confronto">${escapeHtml(j.fase || '')} · ${new Date(j.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} ${j.finalizado ? `· Final: ${j.placarCasaReal} x ${j.placarForaReal}` : ''}</div>
              </div>
              <div class="acoes-jogo-admin">
                <button class="btn-secundario" onclick="abrirLancarPlacar('${j.id}')">${j.finalizado ? 'Editar placar' : 'Lançar placar'}</button>
                <button class="btn-secundario btn-perigo" onclick="adminExcluirJogo('${j.id}')">Excluir</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div id="bloco-lancar-placar"></div>
    </div>
  `;
}

async function adminSalvarJogo() {
  const fase = document.getElementById('adm-fase').value.trim();
  const timeCasa = document.getElementById('adm-time-casa').value.trim();
  const timeFora = document.getElementById('adm-time-fora').value.trim();
  const dataHora = document.getElementById('adm-data-hora').value;
  const senha = document.getElementById('adm-senha').value;

  if (!timeCasa || !timeFora || !dataHora) {
    mostrarToast('Preencha os times e a data/hora.', true);
    return;
  }
  if (!senha) {
    mostrarToast('Digite a senha de admin.', true);
    return;
  }

  try {
    await apiPost({
      action: 'adminSalvarJogo',
      senha: senha,
      fase: fase,
      timeCasa: timeCasa,
      timeFora: timeFora,
      dataHora: new Date(dataHora).toISOString()
    });
    mostrarToast('Jogo salvo!');
    await carregarTudo();
    renderizarAdmin();
  } catch (err) {
    mostrarToast(err.message, true);
  }
}

function abrirLancarPlacar(jogoId) {
  const jogo = estado.jogos.find(j => j.id === jogoId);
  const bloco = document.getElementById('bloco-lancar-placar');
  bloco.innerHTML = `
    <div class="bloco-admin">
      <h3>Lançar placar real — ${escapeHtml(jogo.timeCasa)} x ${escapeHtml(jogo.timeFora)}</h3>
      <div class="grade-2">
        <div class="campo">
          <label>${escapeHtml(jogo.timeCasa)}</label>
          <input type="number" min="0" id="real-casa" value="${jogo.placarCasaReal ?? ''}">
        </div>
        <div class="campo">
          <label>${escapeHtml(jogo.timeFora)}</label>
          <input type="number" min="0" id="real-fora" value="${jogo.placarForaReal ?? ''}">
        </div>
      </div>
      <div class="campo">
        <label>Senha de admin</label>
        <input type="password" id="real-senha" placeholder="Digite a senha de admin">
      </div>
      <button class="btn-primario" onclick="adminSalvarPlacarReal('${jogoId}')">Confirmar placar e calcular pontos</button>
    </div>
  `;
  bloco.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function adminSalvarPlacarReal(jogoId) {
  const placarCasaReal = document.getElementById('real-casa').value;
  const placarForaReal = document.getElementById('real-fora').value;
  const senha = document.getElementById('real-senha').value;

  if (placarCasaReal === '' || placarForaReal === '') {
    mostrarToast('Preencha os dois placares.', true);
    return;
  }
  if (!senha) {
    mostrarToast('Digite a senha de admin.', true);
    return;
  }

  try {
    await apiPost({
      action: 'adminSalvarPlacarReal',
      senha: senha,
      jogoId: jogoId,
      placarCasaReal: placarCasaReal,
      placarForaReal: placarForaReal
    });
    mostrarToast('Placar lançado e pontos calculados! 🏆');
    document.getElementById('bloco-lancar-placar').innerHTML = '';
    await carregarTudo();
    renderizarAdmin();
  } catch (err) {
    mostrarToast(err.message, true);
  }
}

async function adminExcluirJogo(jogoId) {
  const senha = prompt('Digite a senha de admin para excluir este jogo:');
  if (!senha) return;

  try {
    await apiPost({ action: 'adminExcluirJogo', senha: senha, jogoId: jogoId });
    mostrarToast('Jogo excluído.');
    await carregarTudo();
    renderizarAdmin();
  } catch (err) {
    mostrarToast(err.message, true);
  }
}

// ---------- UTIL ----------

function mostrarToast(msg, erro) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (erro ? ' erro' : '');
  setTimeout(() => { toast.className = 'toast'; }, 3200);
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

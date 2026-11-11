(() => {
  const DB_NAME = 'automato-docx-atualizacao';
  const DB_VERSION = 1;
  const STORE_NAME = 'documentos';
  const STATE_KEY = 'selecao-atual';
  const CURSO_POSITION_KEY = 'automato-atualizacao-posicao-curso';
  const JANELA_CURSO = document.body?.dataset.atualizacaoJanela === 'curso';
  const POSICOES = new Set([
    'top-left', 'middle-left', 'bottom-left',
    'top-right', 'middle-right', 'bottom-right'
  ]);
  let estado = null;
  let atualizando = false;
  let consultaProgresso = null;
  let ocultarFeedbackTimer = null;

  function aplicarPosicao(container, posicao, salvar = false) {
    if (!JANELA_CURSO) return;
    const normalizada = POSICOES.has(posicao) ? posicao : 'top-left';
    container.dataset.position = normalizada;
    container.style.removeProperty('top');
    container.style.removeProperty('right');
    container.style.removeProperty('bottom');
    container.style.removeProperty('left');
    container.style.removeProperty('transform');
    container.style.removeProperty('position');
    if (salvar) {
      try { localStorage.setItem(CURSO_POSITION_KEY, normalizada); } catch (_) {}
    }
  }

  function lerPosicaoSalva() {
    try {
      const posicao = localStorage.getItem(CURSO_POSITION_KEY);
      return POSICOES.has(posicao) ? posicao : 'top-left';
    } catch (_) {
      return 'top-left';
    }
  }

  function habilitarReposicionamento(container, botao) {
    botao.setAttribute('aria-label', 'Atualizar documento');
    if (!JANELA_CURSO) return;
    aplicarPosicao(container, lerPosicaoSalva());
    botao.setAttribute('title', 'Arraste para posicionar. Use as setas do teclado para mover.');

    let arraste = null;
    let ignorarProximoClique = false;

    botao.addEventListener('pointerdown', evento => {
      if (evento.button !== undefined && evento.button !== 0) return;
      if (botao.disabled) return;
      arraste = {
        pointerId: evento.pointerId,
        xInicial: evento.clientX,
        yInicial: evento.clientY,
        leftInicial: container.getBoundingClientRect().left,
        topInicial: container.getBoundingClientRect().top,
        movendo: false
      };
      try { botao.setPointerCapture(evento.pointerId); } catch (_) {}
    });

    botao.addEventListener('pointermove', evento => {
      if (!arraste || evento.pointerId !== arraste.pointerId) return;
      const dx = evento.clientX - arraste.xInicial;
      const dy = evento.clientY - arraste.yInicial;
      if (!arraste.movendo && Math.hypot(dx, dy) < 6) return;

      arraste.movendo = true;
      evento.preventDefault();
      container.dataset.dragging = 'true';
      const dimensoes = container.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - dimensoes.width - 8);
      const maxTop = Math.max(8, window.innerHeight - dimensoes.height - 8);
      container.style.position = 'fixed';
      container.style.left = `${Math.min(maxLeft, Math.max(8, arraste.leftInicial + dx))}px`;
      container.style.top = `${Math.min(maxTop, Math.max(8, arraste.topInicial + dy))}px`;
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.transform = 'none';
    });

    function finalizarArraste(evento) {
      if (!arraste || evento.pointerId !== arraste.pointerId) return;
      if (arraste.movendo) {
        const lado = evento.clientX < window.innerWidth / 2 ? 'left' : 'right';
        const faixaVertical = evento.clientY < window.innerHeight / 3
          ? 'top'
          : evento.clientY > window.innerHeight * 2 / 3 ? 'bottom' : 'middle';
        aplicarPosicao(container, `${faixaVertical}-${lado}`, true);
        ignorarProximoClique = true;
        window.setTimeout(() => { ignorarProximoClique = false; }, 400);
      }
      container.removeAttribute('data-dragging');
      arraste = null;
    }

    botao.addEventListener('pointerup', finalizarArraste);
    botao.addEventListener('pointercancel', finalizarArraste);
    botao.addEventListener('click', evento => {
      if (!ignorarProximoClique) return;
      evento.preventDefault();
      evento.stopImmediatePropagation();
      ignorarProximoClique = false;
    }, true);

    botao.addEventListener('keydown', evento => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home'].includes(evento.key)) return;
      evento.preventDefault();
      const atual = container.dataset.position || 'top-left';
      let [faixaVertical, lado] = atual.split('-');
      if (evento.key === 'Home') {
        faixaVertical = 'top';
        lado = 'left';
      } else if (evento.key === 'ArrowLeft') lado = 'left';
      else if (evento.key === 'ArrowRight') lado = 'right';
      else {
        const faixas = ['top', 'middle', 'bottom'];
        const indiceAtual = faixas.indexOf(faixaVertical);
        const deslocamento = evento.key === 'ArrowUp' ? -1 : 1;
        faixaVertical = faixas[Math.max(0, Math.min(faixas.length - 1, indiceAtual + deslocamento))];
      }
      aplicarPosicao(container, `${faixaVertical}-${lado}`, true);
    });
  }

  function abrirBanco() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Este navegador não oferece armazenamento local compatível.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível acessar o armazenamento local.'));
    });
  }

  async function acessarEstado(modo, operacao) {
    const db = await abrirBanco();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, modo);
      const store = tx.objectStore(STORE_NAME);
      const request = operacao(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  const lerEstado = () => acessarEstado('readonly', store => store.get(STATE_KEY));
  const gravarEstado = valor => acessarEstado('readwrite', store => store.put(valor, STATE_KEY));
  const apagarEstado = () => acessarEstado('readwrite', store => store.delete(STATE_KEY));

  function criarInterface() {
    if (document.getElementById('automatoUpdateFloating')) return;
    const container = document.createElement('div');
    container.id = 'automatoUpdateFloating';
    container.className = JANELA_CURSO
      ? 'automato-update-floating automato-update-course'
      : 'automato-update-floating';
    container.hidden = true;
    container.innerHTML = `
      <section class="automato-update-feedback" id="automatoUpdateFeedback" hidden aria-live="polite">
        <div class="automato-update-feedback-heading">
          <strong id="automatoUpdateFeedbackTitle">Atualização do documento</strong>
          <span id="automatoUpdatePercent">0%</span>
        </div>
        <div class="progress automato-update-progress" role="progressbar" aria-label="Progresso da atualização" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="progress-bar" id="automatoUpdateProgressBar" style="width:0%"></div>
        </div>
        <p id="automatoUpdateFeedbackText" class="mb-0">Preparando...</p>
        ${JANELA_CURSO ? '' : '<a id="automatoUpdateOutputLink" href="#" target="_blank" rel="noopener noreferrer" hidden>Ver arquivos gerados</a>'}
      </section>
      <button type="button" class="automato-update-fab" id="automatoUpdateFloatingButton">
        ${JANELA_CURSO ? '' : '<i class="bi bi-arrow-repeat" aria-hidden="true"></i><span>Atualizar documento</span>'}
      </button>`;
    document.body.appendChild(container);
    const botao = container.querySelector('button');
    habilitarReposicionamento(container, botao);
    botao.addEventListener('click', atualizarDocumentos);
  }

  function mostrarFeedback(titulo, mensagem, percentual = null, link = '') {
    if (ocultarFeedbackTimer) {
      clearTimeout(ocultarFeedbackTimer);
      ocultarFeedbackTimer = null;
    }
    const box = document.getElementById('automatoUpdateFeedback');
    if (!box) return;
    box.hidden = false;
    document.getElementById('automatoUpdateFeedbackTitle').textContent = titulo;
    document.getElementById('automatoUpdateFeedbackText').textContent = mensagem;
    const percent = document.getElementById('automatoUpdatePercent');
    const bar = document.getElementById('automatoUpdateProgressBar');
    const progress = box.querySelector('.progress');
    if (percentual === null) {
      percent.hidden = true;
      progress.hidden = true;
    } else {
      const valor = Math.max(0, Math.min(100, percentual));
      percent.hidden = false;
      progress.hidden = false;
      percent.textContent = `${valor}%`;
      bar.style.width = `${valor}%`;
      progress.setAttribute('aria-valuenow', String(valor));
    }
    const output = document.getElementById('automatoUpdateOutputLink');
    if (!output) return;
    if (link) {
      output.href = link;
      output.hidden = false;
    } else {
      output.hidden = true;
      output.removeAttribute('href');
    }
  }

  function definirVisibilidade(pronto) {
    const container = document.getElementById('automatoUpdateFloating');
    if (container) container.hidden = !pronto;
  }

  async function salvarHandles(handles) {
    estado = { handles, pronto: false };
    try {
      await gravarEstado(estado);
    } catch (erro) {
      estado = null;
      console.warn('Não foi possível guardar a referência dos documentos:', erro);
    }
    definirVisibilidade(false);
  }

  async function limpar() {
    estado = null;
    definirVisibilidade(false);
    try { await apagarEstado(); } catch (_) {}
  }

  async function marcarPronto() {
    try {
      estado = estado || await lerEstado();
      if (!estado || !Array.isArray(estado.handles) || !estado.handles.length) {
        definirVisibilidade(false);
        return;
      }
      estado.pronto = true;
      await gravarEstado(estado);
      definirVisibilidade(true);
    } catch (erro) {
      console.warn('Não foi possível habilitar a atualização dos documentos:', erro);
      definirVisibilidade(false);
    }
  }

  function definirProcessando(valor) {
    const botao = document.getElementById('automatoUpdateFloatingButton');
    if (!botao) return;
    botao.disabled = Boolean(valor);
    botao.classList.toggle('is-processing', Boolean(valor));
    if (JANELA_CURSO) {
      botao.innerHTML = valor
        ? '<span class="automato-update-spinner" aria-hidden="true"></span>'
        : '';
    } else {
      botao.innerHTML = valor
        ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>Atualizando...</span>'
        : '<i class="bi bi-arrow-repeat" aria-hidden="true"></i><span>Atualizar documento</span>';
    }
    botao.setAttribute('aria-label', valor ? 'Atualizando documento' : 'Atualizar documento');
  }

  function pararConsulta() {
    if (consultaProgresso) {
      clearInterval(consultaProgresso);
      consultaProgresso = null;
    }
  }

  function consultarProgresso(progressId) {
    pararConsulta();
    consultaProgresso = setInterval(async () => {
      try {
        const resposta = await fetch('/progresso/' + encodeURIComponent(progressId), { cache: 'no-store' });
        if (!resposta.ok) return;
        const dados = await resposta.json();
        const interno = Math.max(0, Math.min(100, Number(dados.percentual) || 0));
        const percentual = dados.concluido ? 100 : Math.min(99, Math.round(30 + interno * 0.69));
        mostrarFeedback('Atualizando documento', dados.etapa || 'Processando documentos...', percentual);
        if (dados.concluido) pararConsulta();
      } catch (_) {}
    }, 500);
  }

  async function obterArquivosAtualizados(handles) {
    const arquivos = [];
    for (const handle of handles) {
      let permissao = await handle.queryPermission({ mode: 'read' });
      if (permissao !== 'granted') permissao = await handle.requestPermission({ mode: 'read' });
      if (permissao !== 'granted') {
        throw new Error(`O navegador não concedeu permissão para ler ${handle.name}.`);
      }
      arquivos.push(await handle.getFile());
    }
    return arquivos;
  }

  async function atualizarDocumentos() {
    if (atualizando) return;
    atualizando = true;
    definirProcessando(true);
    mostrarFeedback('Atualização do documento', 'Buscando a versão mais recente dos documentos salvos...', 0);

    try {
      estado = estado || await lerEstado();
      if (!estado || !estado.pronto || !Array.isArray(estado.handles) || !estado.handles.length) {
        throw new Error('Não há documentos prontos para atualização. Volte à página inicial e processe os arquivos novamente.');
      }

      const arquivos = await obterArquivosAtualizados(estado.handles);
      if (arquivos.length > 20) throw new Error('É permitido atualizar no máximo 20 documentos por vez.');
      const invalido = arquivos.find(arquivo => !arquivo.name.toLowerCase().endsWith('.docx'));
      if (invalido) throw new Error(`${invalido.name} não é um documento DOCX válido.`);

      const progressId = (window.crypto && typeof window.crypto.randomUUID === 'function')
        ? window.crypto.randomUUID()
        : 'progress-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      const formData = new FormData();
      formData.append('progressId', progressId);
      arquivos.forEach(arquivo => formData.append('arquivos', arquivo, arquivo.name));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload?progressId=' + encodeURIComponent(progressId), true);

      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          const percentual = Math.round((event.loaded / event.total) * 30);
          mostrarFeedback('Atualização do documento', 'Enviando as versões atualizadas...', percentual);
        }
      };
      xhr.upload.onload = () => {
        mostrarFeedback('Atualização do documento', 'Upload concluído. Processando documentos...', 30);
        consultarProgresso(progressId);
      };

      const resposta = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          let dados;
          try { dados = JSON.parse(xhr.responseText); }
          catch (_) { dados = { message: 'O servidor retornou uma resposta inesperada.' }; }
          if (xhr.status >= 200 && xhr.status < 300 && dados.success) resolve(dados);
          else reject(new Error(dados.message || 'Ocorreu um erro durante o processamento.'));
        };
        xhr.onerror = () => reject(new Error('Não foi possível se comunicar com o servidor.'));
        xhr.onabort = () => reject(new Error('A atualização foi cancelada.'));
        xhr.send(formData);
      });

      pararConsulta();
      await marcarPronto();
      mostrarFeedback(
        resposta.totalDocumentos > 1 ? 'Documentos atualizados com sucesso' : 'Documento atualizado com sucesso',
        resposta.message || 'O processamento foi concluído.',
        100,
        JANELA_CURSO ? '' : (resposta.outputUrl || '')
      );
      if (JANELA_CURSO) {
        ocultarFeedbackTimer = setTimeout(() => {
          const feedback = document.getElementById('automatoUpdateFeedback');
          if (feedback) feedback.hidden = true;
          ocultarFeedbackTimer = null;
        }, 1000);
      }
      document.dispatchEvent(new CustomEvent('automato:documentos-atualizados', { detail: resposta }));
    } catch (erro) {
      pararConsulta();
      try {
        estado = estado || await lerEstado();
        if (estado) {
          estado.pronto = false;
          await gravarEstado(estado);
        }
      } catch (_) {}
      definirVisibilidade(false);
      mostrarFeedback('Não foi possível atualizar', erro?.message || 'Verifique os documentos e tente novamente.', null);
    } finally {
      atualizando = false;
      definirProcessando(false);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    criarInterface();
    try {
      estado = await lerEstado();
      definirVisibilidade(Boolean(estado && estado.pronto && Array.isArray(estado.handles) && estado.handles.length));
    } catch (erro) {
      console.warn('A atualização global de documentos não está disponível:', erro);
      definirVisibilidade(false);
    }
  });

  window.AutomatoAtualizacao = { salvarHandles, limpar, marcarPronto, definirProcessando };
})();

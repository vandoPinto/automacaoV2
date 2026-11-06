const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('arquivo');
const documentUrlInput = document.getElementById('documentUrl'); // Opcional: pode não existir quando o envio por link estiver desativado.
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressContainer = progressBar.closest('.progress');
const status = document.getElementById('status');
const submitButton = document.getElementById('submitButton');
const resultBox = document.getElementById('resultBox');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const resultIcon = document.getElementById('resultIcon');
const errorList = document.getElementById('errorList');
const outputLink = document.getElementById('outputLink');


function atualizarProgresso(percentual) {
  const valor = Math.max(0, Math.min(100, percentual));
  progressBar.style.width = valor + '%';
  progressPercent.textContent = valor + '%';
  progressContainer.setAttribute('aria-valuenow', String(valor));
}

let intervaloProgresso = null;
let consultaIniciada = false;

function pararConsultaProgresso() {
  if (intervaloProgresso) {
    clearInterval(intervaloProgresso);
    intervaloProgresso = null;
  }
}

function iniciarConsultaProgresso(progressId) {
  pararConsultaProgresso();
  intervaloProgresso = setInterval(async () => {
    try {
      const resposta = await fetch('/progresso/' + encodeURIComponent(progressId), { cache: 'no-store' });
      if (!resposta.ok) return;
      const dados = await resposta.json();
      // O upload ocupa 0–30%. Só depois dele começa o progresso do processamento.
      const percentualInterno = Math.max(0, Math.min(100, Number(dados.percentual) || 0));
      const percentual = dados.concluido
        ? 100
        : Math.min(99, Math.round(30 + percentualInterno * 0.69));
      atualizarProgresso(percentual);
      if (dados.etapa) status.textContent = dados.etapa;
      if (dados.concluido) pararConsultaProgresso();
    } catch (_) {
      // Uma falha pontual na consulta não interrompe o processamento.
    }
  }, 500);
}

function limparResultado() {
  resultBox.hidden = true;
  resultBox.className = 'result-box';
  resultIcon.className = 'bi fs-4';
  resultTitle.textContent = '';
  resultMessage.textContent = '';
  errorList.replaceChildren();
  errorList.hidden = true;
  outputLink.hidden = true;
  outputLink.removeAttribute('href');
}

function mostrarErro(dados, mensagemPadrao) {
  resultBox.hidden = false;
  resultBox.className = 'result-box error';
  resultIcon.className = 'bi bi-exclamation-triangle-fill fs-4';
  resultTitle.textContent = 'Não foi possível processar o documento';
  resultMessage.textContent = dados.message || mensagemPadrao;
  errorList.replaceChildren();

  const erros = Array.isArray(dados.errors) ? dados.errors : [];
  erros.forEach((erro) => {
    const item = document.createElement('li');
    item.className = 'mb-3';

    if (erro.arquivo) {
      const nomeArquivo = document.createElement('strong');
      nomeArquivo.textContent = erro.arquivo;
      item.appendChild(nomeArquivo);
    }

    const mensagem = document.createElement('div');
    const etapa = String(erro.etapa || '').trim();
    const etapaFormatada = etapa
      ? etapa.charAt(0).toUpperCase() + etapa.slice(1).replace(/\\.$/, '') + '.'
      : '';
    mensagem.textContent = etapaFormatada || erro.message || 'Não foi possível concluir o processamento.';
    item.appendChild(mensagem);

    if (erro.detalhe) {
      // Remove prefixos técnicos como "SelecionarTelas.js - " da causa.
      const causaLimpa = String(erro.detalhe)
        .replace(/^\\s*[^\\n]*?\\.js\\s*[-:：]\\s*/i, '')
        .replace(/^\\s*Erro:\\s*/i, '')
        .trim();

      if (causaLimpa) {
        const detalhe = document.createElement('div');
        detalhe.className = 'mt-1';
        const rotulo = document.createElement('strong');
        rotulo.textContent = 'Causa do erro: ';
        detalhe.appendChild(rotulo);
        detalhe.appendChild(document.createTextNode(causaLimpa));
        item.appendChild(detalhe);
      }
    }

    errorList.appendChild(item);
  });
  errorList.hidden = erros.length === 0;
}

function mostrarSucesso(dados) {
  resultBox.hidden = false;
  resultBox.className = 'result-box success';
  resultIcon.className = 'bi bi-check-circle-fill fs-4';
  resultTitle.textContent = dados.totalDocumentos > 1 ? 'Processamento em lote concluído' : 'Processamento concluído';
  resultMessage.textContent = dados.message || 'Arquivo(s) processado(s) com sucesso.';
  if (Array.isArray(dados.resultados) && dados.resultados.length) {
    const lista = document.createElement('ul');
    lista.className = 'mt-3 mb-0';
    dados.resultados.forEach(item => {
      const linha = document.createElement('li');
      linha.className = 'mb-2';
      linha.textContent = `${item.numeroLicao ? 'Lição ' + item.numeroLicao + ' — ' : ''}${item.nomeArquivo}: ${item.success ? 'gerada com sucesso' : 'falha: ' + (item.message || 'erro não identificado')}`;

      if (!item.success && item.detalhe) {
        const detalhe = document.createElement('div');
        detalhe.className = 'ms-3';
        detalhe.textContent = `Causa do erro: ${item.detalhe}`;
        linha.appendChild(detalhe);
      }
      if (!item.success && item.origem && item.origem.arquivo) {
        const origem = document.createElement('small');
        origem.className = 'd-block ms-3 text-muted';
        origem.textContent = `Referência técnica: ${item.origem.arquivo}${item.origem.linha ? ' — linha ' + item.origem.linha : ''}`;
        linha.appendChild(origem);
      }
      lista.appendChild(linha);
    });
    resultMessage.appendChild(lista);
  }
  errorList.replaceChildren();
  errorList.hidden = true;

  if (dados.outputUrl) {
    outputLink.href = dados.outputUrl;
    outputLink.hidden = false;
  }
}


const selectFilesButton = document.getElementById('selectFilesButton');
const updateDocumentButton = document.getElementById('updateDocumentButton');
let arquivosSelecionados = [];
let referenciasArquivos = [];

function limparSelecaoAtual() {
  arquivosSelecionados = [];
  referenciasArquivos = [];
  fileInput.value = '';
  updateDocumentButton.hidden = true;
  document.getElementById('fileHelp').textContent =
    'O documento deve seguir o modelo esperado pela automação.';
}

function atualizarResumoArquivos(arquivos) {
  const nomes = arquivos.map(arquivo => arquivo.name);
  document.getElementById('fileHelp').textContent =
    `${nomes.length} arquivo(s) selecionado(s): ${nomes.join(', ')}`;
}

selectFilesButton.addEventListener('click', async () => {
  // Uma nova seleção inicia um novo ciclo e invalida a opção de atualização anterior.
  limparSelecaoAtual();
  limparResultado();

  if (typeof window.showOpenFilePicker === 'function') {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Documentos Word',
          accept: {
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
          }
        }]
      });

      const arquivos = await Promise.all(handles.map(handle => handle.getFile()));
      referenciasArquivos = handles;
      arquivosSelecionados = arquivos;
      atualizarResumoArquivos(arquivos);
      return;
    } catch (erro) {
      if (erro && erro.name === 'AbortError') return;
      mostrarErro({
        message: 'Não foi possível acessar os documentos selecionados.',
        errors: [{
          etapa: 'seleção de arquivos',
          message: erro?.message || 'Verifique as permissões do navegador e tente novamente.'
        }]
      });
      return;
    }
  }

  // Compatibilidade com navegadores sem File System Access API.
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  referenciasArquivos = [];
  arquivosSelecionados = Array.from(fileInput.files || []);
  if (arquivosSelecionados.length) {
    atualizarResumoArquivos(arquivosSelecionados);
  } else {
    document.getElementById('fileHelp').textContent =
      'O documento deve seguir o modelo esperado pela automação.';
  }
});

if (documentUrlInput) {
  documentUrlInput.addEventListener('input', () => {
    if (documentUrlInput.value.trim()) {
      limparSelecaoAtual();
    }
    document.getElementById('fileHelp').textContent =
      'O documento deve seguir o modelo esperado pela automação.';
  });
}

async function obterVersoesAtualizadas() {
  if (!referenciasArquivos.length) {
    throw new Error('Não há referências disponíveis para atualizar os documentos. Selecione os arquivos novamente.');
  }

  const arquivos = [];
  for (const handle of referenciasArquivos) {
    let permissao = await handle.queryPermission({ mode: 'read' });
    if (permissao !== 'granted') {
      permissao = await handle.requestPermission({ mode: 'read' });
    }
    if (permissao !== 'granted') {
      throw new Error(`O navegador não concedeu permissão para ler ${handle.name}.`);
    }
    arquivos.push(await handle.getFile());
  }
  return arquivos;
}

async function processarDocumentos(arquivos, documentUrl = '') {
  limparResultado();
  atualizarProgresso(0);

  if (!arquivos.length && !documentUrl) {
    mostrarErro({
      message: 'Informe os documentos que deseja processar.',
      errors: [{ etapa: 'validação', message: 'Selecione um ou mais arquivos DOCX.' }]
    });
    return;
  }

  const arquivoInvalido = arquivos.find(arquivo => !arquivo.name.toLowerCase().endsWith('.docx'));
  if (arquivoInvalido) {
    mostrarErro({
      message: 'Formato de arquivo inválido.',
      errors: [{ etapa: 'validação', message: `O arquivo ${arquivoInvalido.name} não possui extensão .docx.` }]
    });
    return;
  }
  if (arquivos.length > 20) {
    mostrarErro({
      message: 'Quantidade de arquivos excedida.',
      errors: [{ etapa: 'validação', message: 'Selecione no máximo 20 documentos por envio.' }]
    });
    return;
  }

  const progressId = (window.crypto && typeof window.crypto.randomUUID === 'function')
    ? window.crypto.randomUUID()
    : 'progress-' + Date.now() + '-' + Math.random().toString(16).slice(2);

  const formData = new FormData();
  formData.append('progressId', progressId);
  arquivos.forEach(arquivo => formData.append('arquivos', arquivo, arquivo.name));
  if (documentUrl) formData.append('documentUrl', documentUrl);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload?progressId=' + encodeURIComponent(progressId), true);
  submitButton.disabled = true;
  selectFilesButton.disabled = true;
  updateDocumentButton.disabled = true;
  submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>Processando...</span>';
  consultaIniciada = false;
  status.textContent = `Enviando ${arquivos.length} documento(s)...`;

  xhr.upload.onload = function () {
    atualizarProgresso(30);
    status.textContent = 'Upload concluído. Iniciando o processamento dos documentos...';
    if (!consultaIniciada) {
      consultaIniciada = true;
      iniciarConsultaProgresso(progressId);
    }
  };

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable) {
      const percentUpload = Math.round((e.loaded / e.total) * 100);
      atualizarProgresso(Math.round(percentUpload * 0.30));
      status.textContent = percentUpload < 100
        ? `Enviando documentos... ${percentUpload}%`
        : 'Upload concluído. Aguardando início do processamento...';
    }
  };

  xhr.onload = function () {
    if (!consultaIniciada && xhr.status >= 200) {
      pararConsultaProgresso();
      consultaIniciada = true;
    }
    let dados;
    try {
      dados = JSON.parse(xhr.responseText);
    } catch (_) {
      dados = {
        message: 'O servidor retornou uma resposta inesperada.',
        errors: [{ etapa: 'resposta do servidor', message: 'Tente novamente. Se o erro continuar, consulte o responsável pelo sistema.' }]
      };
    }

    if (xhr.status >= 200 && xhr.status < 300 && dados.success) {
      atualizarProgresso(100);
      status.textContent = 'Upload, processamento e criação das lições concluídos.';
      mostrarSucesso(dados);
      // Só oferece atualização quando os arquivos foram selecionados por um seletor
      // que fornece referências persistentes ao documento local.
      updateDocumentButton.hidden = referenciasArquivos.length === 0;
    } else {
      status.textContent = 'O processamento encontrou um problema.';
      mostrarErro(dados, 'Ocorreu um erro durante o processamento.');
      updateDocumentButton.hidden = true;
    }
  };

  xhr.onerror = function () {
    status.textContent = 'Falha na comunicação com o servidor.';
    mostrarErro({
      message: 'Não foi possível se comunicar com o servidor.',
      errors: [{ etapa: 'conexão', message: 'Verifique sua conexão e tente novamente.' }]
    }, 'Erro de conexão.');
    updateDocumentButton.hidden = true;
  };

  xhr.onloadend = function () {
    pararConsultaProgresso();
    submitButton.disabled = false;
    selectFilesButton.disabled = false;
    updateDocumentButton.disabled = false;
    submitButton.innerHTML = '<i class="bi bi-gear-wide-connected"></i><span>Enviar e processar</span>';
  };

  xhr.send(formData);
}

form.addEventListener('submit', function (e) {
  e.preventDefault();
  const arquivos = arquivosSelecionados.length
    ? arquivosSelecionados
    : Array.from(fileInput.files || []);
  const documentUrl = documentUrlInput ? documentUrlInput.value.trim() : '';
  processarDocumentos(arquivos, documentUrl);
});

updateDocumentButton.addEventListener('click', async () => {
  updateDocumentButton.disabled = true;
  const textoOriginal = updateDocumentButton.innerHTML;
  updateDocumentButton.innerHTML =
    '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>Atualizando documento...</span>';
  status.textContent = 'Buscando a versão mais recente dos documentos salvos...';

  try {
    const arquivosAtualizados = await obterVersoesAtualizadas();
    arquivosSelecionados = arquivosAtualizados;
    atualizarResumoArquivos(arquivosAtualizados);
    await processarDocumentos(arquivosAtualizados);
  } catch (erro) {
    mostrarErro({
      message: 'Não foi possível atualizar os documentos.',
      errors: [{
        etapa: 'atualização do documento',
        message: erro?.message || 'Verifique se os arquivos continuam disponíveis no computador.'
      }]
    });
  } finally {
    updateDocumentButton.disabled = false;
    updateDocumentButton.innerHTML = textoOriginal;
  }
});

const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('arquivo');
const documentUrlInput = document.getElementById('documentUrl');
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
    const etapa = erro.etapa ? erro.etapa + ': ' : '';
    item.textContent = etapa + (erro.message || 'Erro não detalhado.');
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
      linha.textContent = `${item.numeroLicao ? 'Lição ' + item.numeroLicao + ' — ' : ''}${item.nomeArquivo}: ${item.success ? 'gerada com sucesso' : 'falha: ' + (item.message || 'erro não identificado')}`;
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

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    documentUrlInput.value = '';
    const nomes = Array.from(fileInput.files).map(f => f.name);
    document.getElementById('fileHelp').textContent = `${nomes.length} arquivo(s) selecionado(s): ${nomes.join(', ')}`;
  } else {
    document.getElementById('fileHelp').textContent = 'O documento deve seguir o modelo esperado pela automação.';
  }
});

documentUrlInput.addEventListener('input', () => {
  if (documentUrlInput.value.trim()) fileInput.value = '';
  document.getElementById('fileHelp').textContent = 'O documento deve seguir o modelo esperado pela automação.';
});

form.addEventListener('submit', function (e) {
  e.preventDefault();
  limparResultado();
  atualizarProgresso(0);

  const arquivos = Array.from(fileInput.files || []);
  const documentUrl = documentUrlInput.value.trim();

  if (!arquivos.length && !documentUrl) {
    mostrarErro({ message: 'Informe os documentos que deseja processar.', errors: [{ etapa: 'validação', message: 'Selecione um ou mais arquivos DOCX ou informe um link do OneDrive.' }] });
    return;
  }
  if (arquivos.length && documentUrl) {
    mostrarErro({ message: 'Escolha apenas uma forma de envio.', errors: [{ etapa: 'validação', message: 'Carregue um arquivo ou informe um link, não os dois ao mesmo tempo.' }] });
    return;
  }
  const arquivoInvalido = arquivos.find(arquivo => !arquivo.name.toLowerCase().endsWith('.docx'));
  if (arquivoInvalido) {
    mostrarErro({ message: 'Formato de arquivo inválido.', errors: [{ etapa: 'validação', message: `O arquivo ${arquivoInvalido.name} não possui extensão .docx.` }] });
    return;
  }
  if (arquivos.length > 20) {
    mostrarErro({ message: 'Quantidade de arquivos excedida.', errors: [{ etapa: 'validação', message: 'Selecione no máximo 20 documentos por envio.' }] });
    return;
  }

  // Identificador compartilhado entre a interface e o servidor para consultar o progresso.
  const progressId = (window.crypto && typeof window.crypto.randomUUID === 'function')
    ? window.crypto.randomUUID()
    : 'progress-' + Date.now() + '-' + Math.random().toString(16).slice(2);

  const formData = new FormData();
  formData.append('progressId', progressId);
  arquivos.forEach(arquivo => formData.append('arquivos', arquivo));
  if (documentUrl) formData.append('documentUrl', documentUrl);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/upload?progressId=' + encodeURIComponent(progressId), true);
  submitButton.disabled = true;
  submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>Processando...</span>';
  consultaIniciada = false;
  status.textContent = arquivos.length
    ? `Enviando ${arquivos.length} documento(s)...`
    : 'Enviando solicitação para baixar o documento...';

  // Fase 1: o upload usa somente os primeiros 30% da barra.
  // A consulta do processamento começa apenas quando o corpo da requisição terminou de ser enviado.
  xhr.upload.onload = function () {
    atualizarProgresso(30);
    status.textContent = arquivos.length
      ? 'Upload concluído. Iniciando o processamento do arquivo...'
      : 'Solicitação enviada. Baixando e processando o documento...';
    if (!consultaIniciada) {
      consultaIniciada = true;
      iniciarConsultaProgresso(progressId);
    }
  };

  xhr.upload.onprogress = function (e) {
    if (e.lengthComputable) {
      const percentUpload = Math.round((e.loaded / e.total) * 100);
      const percentGeral = Math.round(percentUpload * 0.30);
      atualizarProgresso(percentGeral);
      status.textContent = percentUpload < 100
        ? `Enviando documentos... ${percentUpload}%`
        : 'Upload concluído. Aguardando início do processamento...';
    }
  };

  xhr.onload = function () {
    // Fallback para navegadores/erros em que o evento de upload não tenha iniciado a consulta.
    if (!consultaIniciada && xhr.status >= 200) {
      pararConsultaProgresso();
      consultaIniciada = true;
    }
    let dados;
    try {
      dados = JSON.parse(xhr.responseText);
    } catch (erro) {
      dados = { message: 'O servidor retornou uma resposta inesperada.', errors: [{ etapa: 'resposta do servidor', message: 'Tente novamente. Se o erro continuar, consulte o responsável pelo sistema.' }] };
    }

    if (xhr.status >= 200 && xhr.status < 300 && dados.success) {
      atualizarProgresso(100);
      status.textContent = 'Upload, processamento e criação das lições concluídos.';
      mostrarSucesso(dados);
    } else {
      status.textContent = 'O processamento encontrou um problema.';
      mostrarErro(dados, 'Ocorreu um erro durante o processamento.');
    }
  };

  xhr.onerror = function () {
    status.textContent = 'Falha na comunicação com o servidor.';
    mostrarErro({ message: 'Não foi possível se comunicar com o servidor.', errors: [{ etapa: 'conexão', message: 'Verifique sua conexão e tente novamente.' }] }, 'Erro de conexão.');
  };

  xhr.onloadend = function () {
    // A resposta final chegou (inclusive em erros como 413); não continue consultando o progresso.
    pararConsultaProgresso();
    submitButton.disabled = false;
    submitButton.innerHTML = '<i class="bi bi-gear-wide-connected"></i><span>Enviar e processar</span>';
  };

  xhr.send(formData);
});

const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('arquivo');
const templateOptions = document.getElementById('templateOptions');
const palettePicker = document.getElementById('palettePicker');
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
const fileSelectionSummary = document.getElementById('fileSelectionSummary');
const selectedFilesDetails = document.getElementById('selectedFilesDetails');
const selectedFilesList = document.getElementById('selectedFilesList');
let audioContextConclusao = null;

function atualizarAjudaArquivos(texto, nomes = []) {
  if (!fileSelectionSummary) {
    document.getElementById('fileHelp').textContent = texto;
    return;
  }

  fileSelectionSummary.textContent = texto;
  if (!selectedFilesDetails || !selectedFilesList) return;

  selectedFilesList.replaceChildren();
  nomes.forEach(nome => {
    const item = document.createElement('li');
    item.textContent = nome;
    selectedFilesList.appendChild(item);
  });
  selectedFilesDetails.hidden = nomes.length === 0;
  selectedFilesDetails.open = false;
}

function atualizarVisibilidadePaletas() {
  if (!palettePicker || !form) return;
  palettePicker.hidden = Boolean(templateOptions?.hidden)
    || !form.querySelector('input[name="modelo"]:checked');
}

if (form) {
  form.querySelectorAll('input[name="modelo"]').forEach(input => {
    input.addEventListener('change', atualizarVisibilidadePaletas);
  });
  atualizarVisibilidadePaletas();
}


function atualizarProgresso(percentual) {
  const valor = Math.max(0, Math.min(100, percentual));
  progressBar.style.width = valor + '%';
  progressPercent.textContent = valor + '%';
  progressContainer.setAttribute('aria-valuenow', String(valor));
}

function prepararAudioConclusao() {
  const AudioContextDisponivel = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextDisponivel) return;

  try {
    if (!audioContextConclusao) audioContextConclusao = new AudioContextDisponivel();
    if (audioContextConclusao.state === 'suspended') {
      audioContextConclusao.resume().catch(() => {});
    }
  } catch (_) {
    audioContextConclusao = null;
  }
}

function tocarAvisoConclusao() {
  const contexto = audioContextConclusao;
  if (!contexto || contexto.state === 'closed') return;

  const reproduzir = () => {
    if (contexto.state !== 'running') return;
    const instanteInicial = contexto.currentTime + 0.02;

    [784, 1047].forEach((frequencia, indice) => {
      const inicio = instanteInicial + indice * 0.18;
      const oscilador = contexto.createOscillator();
      const volume = contexto.createGain();
      oscilador.type = 'sine';
      oscilador.frequency.setValueAtTime(frequencia, inicio);
      volume.gain.setValueAtTime(0.0001, inicio);
      volume.gain.exponentialRampToValueAtTime(0.12, inicio + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.17);
      oscilador.connect(volume);
      volume.connect(contexto.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.18);
    });
  };

  if (contexto.state === 'suspended') {
    contexto.resume().then(reproduzir).catch(() => {});
  } else {
    reproduzir();
  }
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

    const etapa = String(erro.etapa || '').trim();
    const etapaFormatada = etapa
      ? etapa.charAt(0).toUpperCase() + etapa.slice(1).replace(/\\.$/, '') + '.'
      : '';

    if (etapaFormatada) {
      const rotuloEtapa = document.createElement('div');
      rotuloEtapa.className = 'small text-muted mb-1';
      rotuloEtapa.textContent = `Etapa: ${etapaFormatada}`;
      item.appendChild(rotuloEtapa);
    }

    const mensagem = document.createElement('div');
    mensagem.textContent = erro.message || 'Não foi possível concluir o processamento.';
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
let arquivosSelecionados = [];
let referenciasArquivos = [];
let versaoSelecaoArquivos = 0;

function atualizarVisibilidadeOpcoesModelo() {
  if (templateOptions) templateOptions.hidden = arquivosSelecionados.length === 0;
  atualizarVisibilidadePaletas();
}

function normalizarTextoPreferencia(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function lerCelulaWord(celula, namespaceWord) {
  return Array.from(celula.getElementsByTagNameNS(namespaceWord, 't'))
    .map(no => no.textContent || '')
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairCampoCabecalho(linhas, rotulos) {
  for (const celulas of linhas) {
    if (!celulas.length) continue;
    const primeiraCelula = normalizarTextoPreferencia(celulas[0]);

    for (const rotulo of rotulos) {
      const rotuloNormalizado = normalizarTextoPreferencia(rotulo);
      if (primeiraCelula === rotuloNormalizado) return celulas[1] || '';

      const prefixo = new RegExp(`^${rotuloNormalizado.replace(/\s+/g, '\\s+')}(?:\\s*:\\s*|\\s+)?(.*)$`, 'i');
      const correspondencia = celulas[0].match(prefixo);
      if (correspondencia) return correspondencia[1].trim() || celulas[1] || '';
    }
  }
  return '';
}

function converterNumeroModelo(valor) {
  const normalizado = normalizarTextoPreferencia(valor);
  const numero = normalizado.match(/^(?:modelo\s*)?(\d+)$/);
  if (!numero) return '';
  const id = `modelo${numero[1]}`;
  return form.querySelector(`input[name="modelo"][value="${id}"]`) ? id : '';
}

function converterNumeroPaleta(valor) {
  const normalizado = normalizarTextoPreferencia(valor);
  const porNumero = { '1': 'azul', '2': 'verde', '3': 'roxo' };
  const porNome = {
    'azul': 'azul',
    'azul institucional': 'azul',
    'verde': 'verde',
    'verde natural': 'verde',
    'roxo': 'roxo',
    'roxo contemporaneo': 'roxo'
  };
  return porNumero[normalizado] || porNome[normalizado] || '';
}

async function lerPreferenciasRoteiro(arquivo) {
  if (!window.JSZip) return {};

  const zip = await window.JSZip.loadAsync(await arquivo.arrayBuffer());
  const documento = zip.file('word/document.xml');
  if (!documento) return {};

  const namespaceWord = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const xml = new DOMParser().parseFromString(await documento.async('string'), 'application/xml');
  if (xml.querySelector('parsererror')) return {};

  const tabelaCabecalho = xml.getElementsByTagNameNS(namespaceWord, 'tbl')[0];
  if (!tabelaCabecalho) return {};

  const linhas = Array.from(tabelaCabecalho.children)
    .filter(no => no.localName === 'tr')
    .map(linha => Array.from(linha.children)
      .filter(no => no.localName === 'tc')
      .map(celula => lerCelulaWord(celula, namespaceWord)));

  return {
    modelo: converterNumeroModelo(extrairCampoCabecalho(linhas, ['Modelo Layout', 'Layout'])),
    paleta: converterNumeroPaleta(extrairCampoCabecalho(linhas, ['Modelo Cores', 'Modelo Cor', 'Paleta de Cores', 'Paleta']))
  };
}

function selecionarOpcao(name, value) {
  const radio = form.querySelector(`input[name="${name}"][value="${value}"]`);
  if (radio) radio.checked = true;
}

async function aplicarPreferenciasRoteiro(arquivos) {
  const versaoAtual = versaoSelecaoArquivos;
  const resultados = [];
  for (const arquivo of arquivos) {
    if (versaoAtual !== versaoSelecaoArquivos) return;
    try {
      resultados.push(await lerPreferenciasRoteiro(arquivo));
    } catch (_) {
      resultados.push({});
    }
  }

  if (versaoAtual !== versaoSelecaoArquivos) return;

  const preferenciasConsistentes = campo => {
    const valores = [...new Set(resultados.map(item => item[campo]).filter(Boolean))];
    return valores.length === 1 ? valores[0] : '';
  };

  const modelo = preferenciasConsistentes('modelo');
  const paleta = preferenciasConsistentes('paleta');
  if (modelo) selecionarOpcao('modelo', modelo);
  if (paleta) selecionarOpcao('paleta', paleta);
  atualizarVisibilidadeOpcoesModelo();

  const preferenciasLidas = [
    modelo ? 'layout' : '',
    paleta ? 'paleta de cores' : ''
  ].filter(Boolean);
  atualizarResumoArquivos(arquivos, preferenciasLidas);
}

async function limparSelecaoAtual() {
  versaoSelecaoArquivos += 1;
  arquivosSelecionados = [];
  referenciasArquivos = [];
  fileInput.value = '';
  form.querySelectorAll('input[name="modelo"]').forEach(input => { input.checked = false; });
  form.querySelectorAll('input[name="paleta"]').forEach(input => { input.checked = false; });
  atualizarVisibilidadeOpcoesModelo();
  if (window.AutomatoAtualizacao) await window.AutomatoAtualizacao.limpar();
  atualizarAjudaArquivos('Até 20 documentos DOCX. O Autômato ordena as lições pelo número encontrado no roteiro ou no nome do arquivo.');
}

function atualizarResumoArquivos(arquivos, preferenciasLidas = []) {
  const nomes = arquivos.map(arquivo => arquivo.name);
  const resumoPreferencias = preferenciasLidas.length
    ? ` O cabeçalho preencheu ${preferenciasLidas.join(' e ')}; você pode alterar abaixo.`
    : '';
  const quantidade = nomes.length === 1 ? '1 documento selecionado.' : `${nomes.length} documentos selecionados.`;
  atualizarAjudaArquivos(`${quantidade} O Autômato ordena as lições pelo número encontrado no roteiro ou no nome do arquivo.${resumoPreferencias}`, nomes);
}

selectFilesButton.addEventListener('click', async () => {
  // Uma nova seleção inicia um novo ciclo e invalida a opção de atualização anterior.
  await limparSelecaoAtual();
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
      atualizarVisibilidadeOpcoesModelo();
      if (window.AutomatoAtualizacao) await window.AutomatoAtualizacao.salvarHandles(handles);
      atualizarResumoArquivos(arquivos);
      await aplicarPreferenciasRoteiro(arquivos);
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

fileInput.addEventListener('change', async () => {
  referenciasArquivos = [];
  if (window.AutomatoAtualizacao) await window.AutomatoAtualizacao.limpar();
  arquivosSelecionados = Array.from(fileInput.files || []);
  if (arquivosSelecionados.length) {
    atualizarVisibilidadeOpcoesModelo();
    atualizarResumoArquivos(arquivosSelecionados);
    await aplicarPreferenciasRoteiro(arquivosSelecionados);
  } else {
    atualizarVisibilidadeOpcoesModelo();
    atualizarAjudaArquivos('Até 20 documentos DOCX. O Autômato ordena as lições pelo número encontrado no roteiro ou no nome do arquivo.');
  }
});

if (documentUrlInput) {
  documentUrlInput.addEventListener('input', () => {
    if (documentUrlInput.value.trim()) {
      limparSelecaoAtual();
    }
    atualizarAjudaArquivos('Até 20 documentos DOCX. O Autômato ordena as lições pelo número encontrado no roteiro ou no nome do arquivo.');
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

  const modeloSelecionado = form.querySelector('input[name="modelo"]:checked')?.value;
  if (!modeloSelecionado) {
    mostrarErro({
      message: 'Escolha um layout para o curso.',
      errors: [{ etapa: 'validação', message: 'Selecione um dos cartões de layout antes de iniciar.' }]
    });
    return;
  }
  const paletaSelecionada = form.querySelector('input[name="paleta"]:checked')?.value;
  if (!paletaSelecionada) {
    mostrarErro({
      message: 'Escolha uma paleta de cores para o curso.',
      errors: [{ etapa: 'validação', message: 'Selecione uma paleta ou preencha “Modelo Cores” no cabeçalho do roteiro.' }]
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
  formData.append('modelo', modeloSelecionado);
  formData.append('paleta', paletaSelecionada);
  arquivos.forEach(arquivo => formData.append('arquivos', arquivo, arquivo.name));
  if (documentUrl) formData.append('documentUrl', documentUrl);

  const xhr = new XMLHttpRequest();
  prepararAudioConclusao();
  xhr.open('POST', '/upload?progressId=' + encodeURIComponent(progressId), true);
  submitButton.disabled = true;
  selectFilesButton.disabled = true;
  if (window.AutomatoAtualizacao) window.AutomatoAtualizacao.definirProcessando(true);
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

  xhr.onload = async function () {
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
      if (referenciasArquivos.length && window.AutomatoAtualizacao) {
        await window.AutomatoAtualizacao.marcarPronto();
      }
    } else {
      status.textContent = 'O processamento encontrou um problema.';
      mostrarErro(dados, 'Ocorreu um erro durante o processamento.');
      if (window.AutomatoAtualizacao) window.AutomatoAtualizacao.limpar();
    }
  };

  xhr.onerror = function () {
    status.textContent = 'Falha na comunicação com o servidor.';
    mostrarErro({
      message: 'Não foi possível se comunicar com o servidor.',
      errors: [{ etapa: 'conexão', message: 'Verifique sua conexão e tente novamente.' }]
    }, 'Erro de conexão.');
    if (window.AutomatoAtualizacao) window.AutomatoAtualizacao.limpar();
  };

  xhr.onloadend = function () {
    pararConsultaProgresso();
    tocarAvisoConclusao();
    submitButton.disabled = false;
    selectFilesButton.disabled = false;
    if (window.AutomatoAtualizacao) window.AutomatoAtualizacao.definirProcessando(false);
    submitButton.innerHTML = '<i class="bi bi-gear-wide-connected"></i><span>Enviar e processar lote</span>';
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

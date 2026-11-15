(() => {
      const $ = id => document.getElementById(id);
      let projects = [];
      let selectedProject = '';
      let audioLessons = [];
      const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      async function api(url, options = {}) {
        const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
        const data = await response.json().catch(() => ({ message: 'Resposta inválida do servidor.' }));
        if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
        return data;
      }
      function projectUrl(suffix = '') { return '/api/projects/' + encodeURIComponent(selectedProject) + suffix; }
      async function loadProjects() {
        try {
          const data = await api('/api/projects'); projects = data.projects || [];
          const select = $('selectedProject'), previous = selectedProject;
          select.innerHTML = '<option value="">Selecione um curso...</option>' + projects.map(p => `<option value="${safe(p.name)}">${safe(p.name)}</option>`).join('');
          if (projects.some(p => p.name === previous)) { select.value = previous; await chooseProject(previous); }
          else { selectedProject = ''; select.value = ''; showManager(false); updatePublishState(); }
        } catch (e) { $('managerNoProject').innerHTML = `<div class="alert alert-danger">${safe(e.message)}</div>`; }
      }
      window.carregarProjetosGerenciador = loadProjects;
      function showManager(show) {
        $('projectTabs').hidden = !show;
        $('managerTabContent').hidden = !show;
        $('managerNoProject').hidden = show;
        if (!show) $('managerNoProject').textContent = 'Selecione um curso para continuar.';
      }
      function updatePublishState({ resetLayout = false } = {}) {
        const button = $('publishCourse'), projectName = $('publishProjectName'), projectMeta = $('publishProjectMeta'), status = $('publishStatus');
        if (!button || !projectName || !projectMeta) return;
        const project = projects.find(item => item.name === selectedProject);
        // A publicação permanece preparada para ativação futura, mas indisponível por enquanto.
        button.disabled = true;
        if (selectedProject) {
          projectName.textContent = project?.name || selectedProject;
          projectMeta.textContent = project
            ? `${project.lessons} arquivo(s) HTML · ${project.files} arquivo(s) de conteúdo prontos para publicação.`
            : 'Atualizando informações do curso selecionado...';
          if (status) status.textContent = 'Publicação indisponível por enquanto.';
        } else {
          projectName.textContent = 'Selecione um curso para habilitar a publicação.';
          projectMeta.textContent = 'Aguardando a seleção de um curso.';
          if (status) status.textContent = 'Em breve.';
        }
        if (resetLayout) {
          const layoutPadrao = $('publishLayout1');
          if (layoutPadrao) layoutPadrao.checked = true;
        }
      }
      async function chooseProject(name) {
        const previousProject = selectedProject;
        selectedProject = name || '';
        if (!selectedProject) { showManager(false); updatePublishState({ resetLayout: previousProject !== selectedProject }); return; }
        showManager(true);
        updatePublishState({ resetLayout: previousProject !== selectedProject });
        const p = projects.find(item => item.name === selectedProject);
        $('selectedProjectSummary').innerHTML = p ? `<div class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-3"><div><div class="fw-semibold">Curso: ${safe(p.name)}</div><div class="helper-text">${p.lessons} arquivo(s) HTML · ${p.files} arquivo(s) de conteúdo (HTML, CSS, JS e JSON)</div></div><div class="d-flex gap-2"><a class="btn btn-sm btn-outline-success" href="${safe(p.url)}" target="_blank" rel="noopener">Abrir curso</a><button class="btn btn-sm btn-outline-danger" id="deleteSelectedProject">Excluir curso</button></div></div>` : '';
        $('courseLessonSummary').innerHTML = '<div class="text-muted small">Carregando informações das lições...</div>';
        $('deleteSelectedProject').addEventListener('click', async () => {
          if (!confirm(`Excluir o curso "${selectedProject}" permanentemente? Não será criada cópia de segurança.`)) return;
          try { const d = await api(projectUrl(), { method: 'DELETE' }); alert(d.message); selectedProject = ''; await loadProjects(); }
          catch (e) { alert(e.message); }
        });
        $('audioFutureStatus').textContent = '';
        const currentProject = selectedProject;
        await Promise.all([loadLessons(), loadStyles()]);
        if (selectedProject === currentProject) updatePublishState();
      }
      $('selectedProject').addEventListener('change', e => chooseProject(e.target.value));
      $('publishCourse').addEventListener('click', async () => {
        if (!selectedProject) return;
        const layout = document.querySelector('input[name="publishLayout"]:checked')?.value;
        if (!layout) return;
        const button = $('publishCourse'), status = $('publishStatus');
        const layoutLabel = document.querySelector(`label[for="${document.querySelector('input[name="publishLayout"]:checked').id}"] .fw-semibold`)?.textContent || layout;
        if (!confirm(`Publicar o curso "${selectedProject}" com o ${layoutLabel}? Será gerado um ZIP exclusivo para o Discent, com a comunicação com o Avant ativada.`)) return;
        button.disabled = true;
        status.textContent = 'Gerando o pacote ZIP...';
        try {
          const response = await fetch(projectUrl('/publish'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout })
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Não foi possível gerar o pacote de publicação.');
          }
          const arquivo = await response.blob();
          const link = document.createElement('a');
          link.href = URL.createObjectURL(arquivo);
          link.download = `${selectedProject}-discent-${layout}.zip`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(link.href);
          status.textContent = 'ZIP gerado e baixado com sucesso.';
        } catch (erro) {
          status.textContent = erro.message;
        } finally {
          updatePublishState();
        }
      });
      async function loadLessons() {
        if (!selectedProject) return;
        try {
          const d = await api(projectUrl('/lessons'));
          audioLessons = (d.lessons || []).slice().sort((a, b) => Number(a.numeroLicao || 0) - Number(b.numeroLicao || 0));
          $('audioLessonSelect').innerHTML = audioLessons.length
            ? audioLessons.map(l => `<option value="${safe(l.path)}">${safe(l.nome)} (${safe(l.path.split('/').pop())})</option>`).join('')
            : '<option value="">Nenhuma lição encontrada</option>';
          $('lessonsList').innerHTML = d.lessons.length ? d.lessons.map(l => `<div class="list-group-item d-flex justify-content-between align-items-center gap-3"><div class="text-break"><div class="fw-semibold">${safe(l.nome)}</div><div class="helper-text">Pasta: ${safe(l.path)}</div><div class="helper-text">${l.totalTelas} tela(s) cadastrada(s) · ${l.count} arquivo(s) HTML</div></div><button class="btn btn-sm btn-outline-danger flex-shrink-0" data-delete-lesson="${safe(l.path)}">Excluir</button></div>`).join('') : '<div class="p-3 text-muted">Nenhuma lição HTML encontrada.</div>';
          $('courseLessonSummary').innerHTML = `<div class="d-flex justify-content-between align-items-center mb-2"><h6 class="mb-0">${safe(d.courseName || selectedProject)}</h6><span class="badge text-bg-secondary">${d.lessons.length} lição(ões)</span></div>` + (d.lessons.length ? `<div class="list-group">${d.lessons.map(l => `<div class="list-group-item"><div class="fw-semibold">${safe(l.nome)}</div><div class="helper-text">${safe(l.totalTelas)} tela(s) · ${safe(l.path)}</div></div>`).join('')}</div>` : '<p class="text-muted small mb-0">Nenhuma lição encontrada.</p>');
        }
        catch (e) { $('lessonsList').innerHTML = `<div class="alert alert-danger">${safe(e.message)}</div>`; }
      }
      $('lessonsList').addEventListener('click', async e => {
        const b = e.target.closest('[data-delete-lesson]'); if (!b) return; const lessonPath = b.dataset.deleteLesson; if (!confirm(`Excluir esta lição?
${lessonPath}`)) return; try { await api(projectUrl('/lessons'), { method: 'DELETE', body: JSON.stringify({ path: lessonPath }) }); await loadLessons(); } catch (err) { alert(err.message); }
      });
      async function loadStyles() {
        if (!selectedProject) return;
        try {
          const d = await api(projectUrl('/styles'));
          if (!d.variables.length) { $('styleEditor').innerHTML = '<p class="helper-text">Não encontrei variáveis de cor no bloco :root de styles/estilos-centralizados.css.</p>'; return; }
          $('styleEditor').innerHTML = d.variables.map((v, i) => `<div class="row align-items-center g-2 mb-3"><div class="col-md-5"><label class="form-label mb-0" for="cssvar${i}">${safe(v.name)}</label><div class="small text-muted">${safe(v.value)}</div></div><div class="col-4 col-md-3"><input type="color" class="form-control form-control-color" id="cssvar${i}" value="${/^#[0-9a-f]{6}$/i.test(v.value) ? v.value : '#245747'}" data-var="${safe(v.name)}" aria-label="Selecionar cor de ${safe(v.name)}"></div><div class="col-8 col-md-4"><input class="form-control form-control-sm" value="${safe(v.value)}" data-var-text="${safe(v.name)}" aria-label="Valor CSS de ${safe(v.name)}"></div></div>`).join('') + '<button id="saveStyles" class="btn btn-automato mt-2">Salvar alterações no CSS</button><span id="styleStatus" class="helper-text ms-3" role="status"></span>';
          $('styleEditor').querySelectorAll('[data-var]').forEach(el => el.addEventListener('input', () => { const t = $('styleEditor').querySelector(`[data-var-text="${el.dataset.var}"]`); if (t) t.value = el.value; }));
          $('styleEditor').querySelectorAll('[data-var-text]').forEach(el => el.addEventListener('change', () => { const c = $('styleEditor').querySelector(`[data-var="${el.dataset.varText}"]`); if (c && /^#[0-9a-f]{6}$/i.test(el.value)) c.value = el.value; }));
          $('saveStyles').addEventListener('click', async () => { const variables = [...$('styleEditor').querySelectorAll('[data-var-text]')].map(el => ({ name: el.dataset.varText, value: el.value })); try { const result = await api(projectUrl('/styles'), { method: 'PUT', body: JSON.stringify({ variables }) }); $('styleStatus').textContent = result.message; } catch (e) { $('styleStatus').textContent = e.message; } });
        } catch (e) { $('styleEditor').innerHTML = `<div class="alert alert-danger">${safe(e.message)}</div>`; }
      }
      const audioMode = $('audioGenerationMode');
      audioMode.addEventListener('change', () => { $('audioLessonField').hidden = audioMode.value !== 'single'; });
      function atualizarProgresso(atual, total, mensagem) {
        const pct = total ? Math.round(atual / total * 100) : 0;
        $('audioProgressWrap').hidden = false;
        $('audioProgressLabel').textContent = mensagem;
        $('audioProgressPercent').textContent = `${pct}%`;
        $('audioProgressBar').style.width = `${pct}%`;
        $('audioProgressWrap').querySelector('.progress').setAttribute('aria-valuenow', String(pct));
      }
      function registrarAudio(mensagem, erro = false) {
        const item = document.createElement('div');
        item.className = erro ? 'text-danger' : 'text-muted';
        item.textContent = mensagem;
        $('audioGenerationLog').appendChild(item);
      }
      async function carregarLameJs() {
        if (window.lamejs) return;
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Não foi possível carregar o codificador MP3 (lamejs).'));
          document.head.appendChild(script);
        });
        if (!window.lamejs) throw new Error('O codificador MP3 não ficou disponível no navegador.');
      }
      async function wavParaMp3(wavBlob) {
        await carregarLameJs();
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Este navegador não oferece suporte à decodificação de áudio necessária.');
        const context = new AudioContextClass();
        try {
          const buffer = await context.decodeAudioData(await wavBlob.arrayBuffer());
          const canal = buffer.getChannelData(0);
          const pcm = new Int16Array(canal.length);
          for (let i = 0; i < canal.length; i++) {
            const amostra = Math.max(-1, Math.min(1, canal[i]));
            pcm[i] = amostra < 0 ? amostra * 32768 : amostra * 32767;
          }
          const encoder = new window.lamejs.Mp3Encoder(1, buffer.sampleRate, 128);
          const blocos = [];
          for (let i = 0; i < pcm.length; i += 1152) {
            const parte = encoder.encodeBuffer(pcm.subarray(i, i + 1152));
            if (parte.length) blocos.push(new Uint8Array(parte));
          }
          const final = encoder.flush();
          if (final.length) blocos.push(new Uint8Array(final));
          return new Blob(blocos, { type: 'audio/mpeg' });
        } finally { await context.close(); }
      }
      let piperModulePromise;
      async function obterPiper() {
        if (!piperModulePromise) {
          piperModulePromise = import('https://cdn.jsdelivr.net/npm/@jtsage/piper-tts-web@1.2.0/+esm');
        }
        return piperModulePromise;
      }
      let audioCancelRequested = false;
      let audioUploadController = null;
      let audioGenerationRunning = false;
      async function gerarAudioDaLicao(lesson, voiceId, estado) {
        const lessonKey = lesson.path.split('/').pop();
        const manifest = await api(projectUrl(`/audio-manifest/${encodeURIComponent(lessonKey)}`));
        estado.total += manifest.audios.length;
        for (const registro of manifest.audios) {
          if (audioCancelRequested) return;
          const numero = estado.concluidos + estado.falhas + 1;
          atualizarProgresso(numero - 1, estado.total, `${lesson.nome}: preparando ${registro.nome}...`);
          try {
            const piper = await obterPiper();
            const wav = await piper.predict({ text: registro.texto, voiceId });
            // A inferência ONNX em andamento não oferece cancelamento imediato.
            // Se o usuário cancelar durante a síntese, descartamos o resultado e não salvamos o MP3.
            if (audioCancelRequested) return;
            const mp3 = await wavParaMp3(wav);
            if (audioCancelRequested) return;
            audioUploadController = new AbortController();
            const resposta = await fetch(projectUrl(`/audio/${encodeURIComponent(lessonKey)}/${encodeURIComponent(registro.nome)}`), {
              method: 'POST', headers: { 'Content-Type': 'audio/mpeg' }, body: mp3,
              signal: audioUploadController.signal
            });
            audioUploadController = null;
            const dados = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw new Error(dados.message || 'Falha ao salvar o MP3 no curso.');
            estado.concluidos++;
            registrarAudio(`✓ ${lessonKey}/${registro.nome}`);
          } catch (erro) {
            audioUploadController = null;
            if (audioCancelRequested || erro.name === 'AbortError') return;
            estado.falhas++;
            registrarAudio(`✕ ${lessonKey}/${registro.nome}: ${erro.message}`, true);
          }
          atualizarProgresso(estado.concluidos + estado.falhas, estado.total, `Processando ${lesson.nome}: ${registro.nome}`);
        }
      }
      $('cancelGenerateAudio').addEventListener('click', () => {
        if (!audioGenerationRunning || audioCancelRequested) return;
        audioCancelRequested = true;
        if (audioUploadController) audioUploadController.abort();
        $('cancelGenerateAudio').disabled = true;
        $('audioFutureStatus').textContent = 'Cancelamento solicitado. A síntese atual será descartada antes de continuar.';
      });
      $('askGenerateAudio').addEventListener('click', async () => {
        if (!selectedProject || audioGenerationRunning) return;
        const modo = audioMode.value;
        let escolhidas = [];
        if (modo === 'single') {
          const path = $('audioLessonSelect').value;
          escolhidas = audioLessons.filter(l => l.path === path);
          if (!escolhidas.length) { $('audioFutureStatus').textContent = 'Selecione uma lição válida.'; return; }
        } else {
          escolhidas = audioLessons.slice().sort((a, b) => Number(a.numeroLicao || 0) - Number(b.numeroLicao || 0));
          const numeros = escolhidas.map(l => Number(l.numeroLicao));
          const max = Math.max(0, ...numeros);
          const faltantes = [];
          for (let n = 1; n <= max; n++) if (!numeros.includes(n)) faltantes.push(n);
          if (faltantes.length) {
            $('audioFutureStatus').textContent = `Sequência incompleta. Não é possível gerar todas: faltam as lições ${faltantes.join(', ')}.`;
            return;
          }
        }
        if (!escolhidas.length) { $('audioFutureStatus').textContent = 'Não há lições disponíveis para sonorizar.'; return; }
        const voz = $('audioVoice').value;
        if (!confirm(`Gerar ${modo === 'all' ? 'todas as lições' : escolhidas[0].nome} do curso "${selectedProject}" usando a voz ${voz}?`)) return;
        audioGenerationRunning = true;
        audioCancelRequested = false;
        $('askGenerateAudio').disabled = true;
        $('cancelGenerateAudio').hidden = false;
        $('cancelGenerateAudio').disabled = false;
        $('audioGenerationMode').disabled = true;
        $('audioLessonSelect').disabled = true;
        $('audioVoice').disabled = true;
        $('audioFutureStatus').textContent = 'Iniciando síntese no navegador. Na primeira execução, o modelo Piper poderá precisar ser baixado.';
        $('audioGenerationLog').innerHTML = '';
        $('audioProgressWrap').hidden = false;
        const estado = { total: 0, concluidos: 0, falhas: 0 };
        try {
          // A primeira inferência carrega o modelo e o runtime WebAssembly no navegador.
          await obterPiper();
          for (const lesson of escolhidas) {
            if (audioCancelRequested) break;
            await gerarAudioDaLicao(lesson, voz, estado);
          }
          if (audioCancelRequested) {
            atualizarProgresso(estado.concluidos + estado.falhas, estado.total, 'Geração cancelada.');
            registrarAudio('Processo cancelado pelo usuário. Os áudios já salvos foram mantidos.');
            $('audioFutureStatus').textContent = `Cancelado: ${estado.concluidos} MP3 gerado(s) e ${estado.falhas} erro(s). Você já pode selecionar outra voz e iniciar uma nova geração.`;
          } else {
            atualizarProgresso(estado.concluidos + estado.falhas, estado.total, 'Geração finalizada.');
            $('audioFutureStatus').textContent = `Concluído: ${estado.concluidos} MP3 gerado(s), ${estado.falhas} erro(s).`;
          }
        } catch (erro) {
          $('audioFutureStatus').textContent = `Não foi possível iniciar o Piper: ${erro.message}`;
        } finally {
          audioGenerationRunning = false;
          audioUploadController = null;
          $('askGenerateAudio').disabled = false;
          $('cancelGenerateAudio').hidden = true;
          $('cancelGenerateAudio').disabled = false;
          $('audioGenerationMode').disabled = false;
          $('audioLessonSelect').disabled = false;
          $('audioVoice').disabled = false;
        }
      });
    })();
  



  (() => {
    const managerOnly = document.body.dataset.managerOnly === 'true';
    if (!managerOnly) return;
    const $ = id => document.getElementById(id);
    let selectedProject = '';
    const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function api(url, options = {}) {
      const response = await fetch(url, { cache:'no-store', headers:{'Content-Type':'application/json',...(options.headers||{})}, ...options });
      const data = await response.json().catch(() => ({message:'Resposta inválida do servidor.'}));
      if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
      return data;
    }
    const projectUrl = (suffix, project = selectedProject) => '/api/projects/' + encodeURIComponent(project) + (suffix || '');
    const formatSize = bytes => {
      if (!Number.isFinite(Number(bytes))) return '';
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = Number(bytes), unit = 0;
      while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
      return `${unit === 0 ? Math.round(size) : size.toLocaleString('pt-BR', {maximumFractionDigits:1})} ${units[unit]}`;
    };
    async function loadCourseFiles() {
      if (!selectedProject) {
        $('filesList').innerHTML = '<div class="text-muted p-3">Selecione um curso.</div>';
        $('projectStatus').textContent = '';
        return;
      }
      $('projectStatus').textContent = 'Carregando arquivos…';
      try {
        const data = await api(projectUrl('/assets'));
        const files = data.files || [];
        $('filesList').innerHTML = files.length
          ? `<div class="list-group">${files.map(file => `<div class="list-group-item course-file-row"><div class="course-file-info"><div class="fw-semibold text-break">${safe(file.name)}</div><div class="helper-text">${safe(file.extension || 'Arquivo')} · ${formatSize(file.size)}</div></div><div class="d-flex flex-wrap gap-2"><button type="button" class="btn btn-sm btn-outline-secondary" data-copy-file="${safe(file.name)}" aria-label="Copiar nome de ${safe(file.name)}"><i class="bi bi-copy me-1"></i>Copiar nome</button><button type="button" class="btn btn-sm btn-outline-danger" data-delete-file="${safe(file.name)}" aria-label="Excluir ${safe(file.name)}"><i class="bi bi-trash me-1"></i>Excluir</button></div></div>`).join('')}</div>`
          : '<div class="text-muted p-3">Ainda não há arquivos nesta pasta.</div>';
        $('projectStatus').textContent = `${files.length} arquivo(s) na pasta arquivos.`;
      } catch (error) {
        $('filesList').innerHTML = `<div class="alert alert-danger m-2">${safe(error.message)}</div>`;
        $('projectStatus').textContent = 'Falha ao atualizar.';
      }
    }
    async function copyFilename(filename) {
      try {
        let copied = false;
        if (navigator.clipboard?.writeText) {
          try { await navigator.clipboard.writeText(filename); copied = true; } catch (_) { }
        }
        if (!copied) {
          const input = document.createElement('textarea');
          input.value = filename;
          input.setAttribute('readonly', '');
          input.style.cssText = 'position:fixed;left:-10000px;top:0;';
          document.body.appendChild(input);
          input.select();
          try { copied = document.execCommand('copy'); } finally { input.remove(); }
        }
        if (!copied) throw new Error('Não foi possível copiar o nome.');
        $('projectStatus').textContent = `Nome copiado: ${filename}`;
      } catch (error) {
        $('projectStatus').textContent = error.message || 'Não foi possível copiar o nome.';
      }
    }
    async function sendCourseFile(file, project, replace = false) {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const url = projectUrl('/assets', project) + (replace ? '?replace=1' : '');
      const response = await fetch(url, { method: 'POST', body: formData, cache: 'no-store' });
      const data = await response.json().catch(() => ({message:'Resposta inválida do servidor.'}));
      if (response.status === 409 && data.exists && !replace) {
        if (!confirm(`${data.message}\n\nDeseja substituir o arquivo existente?`)) return {cancelled:true};
        return sendCourseFile(file, project, true);
      }
      if (!response.ok) throw new Error(data.message || 'Não foi possível enviar o arquivo.');
      return data;
    }
    $('courseFileUploadForm').addEventListener('submit', async event => {
      event.preventDefault();
      const files = Array.from($('courseFileInput').files || []);
      const project = $('selectedProject').value || '';
      if (!project) { $('fileUploadStatus').textContent = 'Selecione um curso antes de enviar.'; return; }
      if (!files.length) { $('fileUploadStatus').textContent = 'Escolha pelo menos um arquivo para enviar.'; return; }
      const button = $('uploadCourseFile');
      button.disabled = true;
      $('courseFileInput').disabled = true;
      try {
        const enviados = [];
        const ignorados = [];
        const falhas = [];
        for (let index = 0; index < files.length; index++) {
          const file = files[index];
          $('fileUploadStatus').textContent = `Enviando arquivo ${index + 1} de ${files.length}: ${file.name}…`;
          try {
            const result = await sendCourseFile(file, project);
            if (result.cancelled) ignorados.push(file.name);
            else enviados.push(file.name);
          } catch (error) {
            falhas.push({ name: file.name, message: error.message || 'Falha no envio.' });
          }
        }
        if (enviados.length && selectedProject === project) await loadCourseFiles();
        const resumo = [`${enviados.length} de ${files.length} arquivo(s) enviado(s).`];
        if (ignorados.length) resumo.push(`${ignorados.length} ignorado(s).`);
        if (falhas.length) resumo.push(`Falhas: ${falhas.map(item => `${item.name}: ${item.message}`).join('; ')}`);
        $('fileUploadStatus').textContent = resumo.join(' ');
      } catch (error) {
        $('fileUploadStatus').textContent = error.message;
      } finally {
        $('courseFileInput').value = '';
        $('courseFileInput').disabled = false;
        button.disabled = false;
      }
    });
    $('selectedProject').addEventListener('change', () => {
      selectedProject = $('selectedProject').value || '';
      loadCourseFiles();
    });
    $('refreshFiles').addEventListener('click', loadCourseFiles);
    $('filesTabButton').addEventListener('shown.bs.tab', () => {
      selectedProject = $('selectedProject').value || '';
      loadCourseFiles();
    });
    $('filesList').addEventListener('click', async event => {
      const copyButton = event.target.closest('[data-copy-file]');
      if (copyButton) { await copyFilename(copyButton.dataset.copyFile); return; }
      const deleteButton = event.target.closest('[data-delete-file]');
      if (!deleteButton) return;
      const filename = deleteButton.dataset.deleteFile;
      const project = selectedProject;
      if (!confirm(`Excluir o arquivo “${filename}” do curso “${project}”?`)) return;
      deleteButton.disabled = true;
      try {
        const data = await api(projectUrl('/assets/' + encodeURIComponent(filename), project), {method:'DELETE'});
        $('projectStatus').textContent = data.message;
        if (selectedProject === project) await loadCourseFiles();
      } catch (error) {
        $('projectStatus').textContent = error.message;
        deleteButton.disabled = false;
      }
    });
  })();
  



    (() => {
      const managerOnly = document.body.dataset.managerOnly === 'true';
      if (!managerOnly) return;
      document.body.classList.add('manager-only');
      const managerElement = document.getElementById('projectManagerModal');
      if (managerElement) {
        managerElement.classList.add('manager-page');
        managerElement.removeAttribute('aria-hidden');
      }
      if (typeof window.carregarProjetosGerenciador === 'function') {
        window.carregarProjetosGerenciador();
      }
    })();

(() => {
      const $ = id => document.getElementById(id);
      let projects = [];
      let selectedProject = '';
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
          else { selectedProject = ''; select.value = ''; showManager(false); }
        } catch (e) { $('managerNoProject').innerHTML = `<div class="alert alert-danger">${safe(e.message)}</div>`; }
      }
      window.carregarProjetosGerenciador = loadProjects;
      function showManager(show) {
        $('projectTabs').hidden = !show;
        $('managerTabContent').hidden = !show;
        $('managerNoProject').hidden = show;
        if (!show) $('managerNoProject').textContent = 'Selecione um curso para continuar.';
      }
      async function chooseProject(name) {
        selectedProject = name || '';
        if (!selectedProject) { showManager(false); return; }
        showManager(true);
        const p = projects.find(item => item.name === selectedProject);
        $('selectedProjectSummary').innerHTML = p ? `<div class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-3"><div><div class="fw-semibold">Curso: ${safe(p.name)}</div><div class="helper-text">${p.lessons} arquivo(s) HTML · ${p.files} arquivo(s) de conteúdo (HTML, CSS, JS e JSON)</div></div><div class="d-flex gap-2"><a class="btn btn-sm btn-outline-success" href="${safe(p.url)}" target="_blank" rel="noopener">Abrir curso</a><button class="btn btn-sm btn-outline-danger" id="deleteSelectedProject">Excluir curso</button></div></div>` : '';
        $('courseLessonSummary').innerHTML = '<div class="text-muted small">Carregando informações das lições...</div>';
        $('deleteSelectedProject').addEventListener('click', async () => {
          if (!confirm(`Excluir o curso "${selectedProject}" permanentemente? Não será criada cópia de segurança.`)) return;
          try { const d = await api(projectUrl(), { method: 'DELETE' }); alert(d.message); selectedProject = ''; await loadProjects(); }
          catch (e) { alert(e.message); }
        });
        $('audioFutureStatus').textContent = '';
        await Promise.all([loadLessons(), loadStyles()]);
      }
      $('selectedProject').addEventListener('change', e => chooseProject(e.target.value));
      async function loadLessons() {
        if (!selectedProject) return;
        try {
          const d = await api(projectUrl('/lessons'));
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
      $('askGenerateAudio').addEventListener('click', () => { const wantsAudio = confirm(`Gostaria de gerar os áudios do curso "${selectedProject}"?`); if (wantsAudio) { $('audioFutureStatus').textContent = 'Funcionalidade planejada. A geração será conectada a uma API em uma etapa futura; nenhum áudio foi gerado.'; } else { $('audioFutureStatus').textContent = 'Tudo bem. Você poderá solicitar a geração dos áudios quando essa funcionalidade estiver disponível.'; } });
    })();
  



  (() => {
    const managerOnly = document.body.dataset.managerOnly === 'true';
    if (!managerOnly) return;
    const $ = id => document.getElementById(id);
    let selectedProject = '', currentFile = '', codeEditor = null, monacoLoadPromise = null, lessonNames = new Map();
    const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const languageFor = filePath => ({html:'html',css:'css',js:'javascript'})[String(filePath||'').split('.').pop().toLowerCase()] || 'plaintext';
    async function api(url, options = {}) {
      const response = await fetch(url, { cache:'no-store', headers:{'Content-Type':'application/json',...(options.headers||{})}, ...options });
      const data = await response.json().catch(() => ({message:'Resposta inválida do servidor.'}));
      if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
      return data;
    }
    const projectUrl = suffix => '/api/projects/' + encodeURIComponent(selectedProject) + (suffix || '');
    function loadMonaco() {
      if (codeEditor) return Promise.resolve(codeEditor);
      if (monacoLoadPromise) return monacoLoadPromise;
      monacoLoadPromise = new Promise((resolve,reject) => {
        const start = () => {
          if (!window.require || !window.require.config) return reject(new Error('O carregador Monaco não ficou disponível.'));
          window.require.config({paths:{vs:'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'}});
          window.MonacoEnvironment = {getWorkerUrl:() => 'data:text/javascript;charset=utf-8,' + encodeURIComponent("self.MonacoEnvironment = { baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/' }; importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/base/worker/workerMain.js');")};
          window.require(['vs/editor/editor.main'], () => {
            codeEditor = window.monaco.editor.create($('fileEditor'), {value:'',language:'html',theme:'vs',automaticLayout:true,fontSize:13,minimap:{enabled:true},lineNumbers:'on',roundedSelection:false,scrollBeyondLastLine:false,wordWrap:'off',tabSize:2,insertSpaces:true,suggestOnTriggerCharacters:true,quickSuggestions:true,parameterHints:{enabled:true}});
            resolve(codeEditor);
          }, reject);
        };
        if (window.require && window.require.config) start();
        else { const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js';script.onload=start;script.onerror=()=>reject(new Error('Não foi possível carregar o Monaco. Verifique a conexão com a internet.'));document.head.appendChild(script); }
      }).catch(error => { monacoLoadPromise=null;$('fileEditor').hidden=true;$('fileEditorFallback').hidden=false;$('fileSaveStatus').textContent=error.message+' O editor de texto alternativo está disponível.';return null; });
      return monacoLoadPromise;
    }
    function editorValue(){return codeEditor ? codeEditor.getValue() : $('fileEditorFallback').value;}
    function setEditorValue(content,filePath){
      if(codeEditor){window.monaco.editor.setModelLanguage(codeEditor.getModel(),languageFor(filePath));codeEditor.setValue(content ?? '');}
      else $('fileEditorFallback').value=content ?? '';
    }
    function clearEditor(){currentFile='';$('editingFileLabel').textContent='Selecione um arquivo na lista';$('fileEditorWrap').hidden=true;$('fileEditorEmpty').hidden=false;$('fileSaveStatus').textContent='';$('saveFile').disabled=true;}
    function lessonGroup(filePath){
      const parts=filePath.split('/'),imagesIndex=parts.findIndex(part=>part.toLowerCase()==='images');
      if(imagesIndex>=0&&parts[imagesIndex+1]&&parts.length>imagesIndex+2){
        const folder=parts[imagesIndex+1], lessonPath=`images/${folder}`;
        const lesson=lessonNames.get(lessonPath);
        if(lesson){
          const number=lesson.numeroLicao ? ` ${lesson.numeroLicao}` : '';
          return `Lição${number} — ${lesson.nome}`;
        }
        const folderNumber=(folder.match(/(\d+)$/)||[])[1];
        return folderNumber ? `Lição ${Number(folderNumber)} — ${folder}` : `Lição — ${folder}`;
      }
      const name=parts[parts.length-1].toLowerCase();
      if(name==='index.html'&&parts.length===1)return 'Index do projeto';
      if(name==='index.html'&&!filePath.toLowerCase().includes('/images/'))return 'Index e HTML principal';
      return 'Outros arquivos HTML';
    }
    function groupPriority(group){
      const match=group.match(/^Lição(?:\s+(\d+))?\s+—/i);
      if(match)return 0;
      if(group==='Index do projeto'||group==='Index e HTML principal')return 1;
      if(group==='Outros arquivos HTML')return 2;
      if(group==='JavaScript')return 3;
      if(group==='CSS')return 4;
      return 5;
    }
    function groupFiles(files){
      const groups=new Map();
      const add=(group,file)=>{if(!groups.has(group))groups.set(group,[]);groups.get(group).push(file);};
      files.forEach(file=>{const ext=file.path.split('.').pop().toLowerCase();if(ext==='html')add(lessonGroup(file.path),file);else if(ext==='js')add('JavaScript',file);else if(ext==='css')add('CSS',file);});
      return [...groups.entries()].sort((a,b)=>{
        const pa=groupPriority(a[0]),pb=groupPriority(b[0]);
        if(pa!==pb)return pa-pb;
        const na=Number((a[0].match(/^Lição\s+(\d+)/i)||[])[1]||0),nb=Number((b[0].match(/^Lição\s+(\d+)/i)||[])[1]||0);
        if(na!==nb)return na-nb;
        return a[0].localeCompare(b[0],undefined,{numeric:true});
      });
    }
    async function loadFiles(){
      if(!selectedProject){$('filesList').innerHTML='<div class="text-muted p-3">Selecione um curso.</div>';clearEditor();return;}
      $('projectStatus').textContent='Atualizando arquivos...';
      try{
        const [lessonData, data]=await Promise.all([api(projectUrl('/lessons')),api(projectUrl('/files'))]);
        lessonNames=new Map((lessonData.lessons||[]).map(lesson=>[lesson.path,{numeroLicao:lesson.numeroLicao || null,nome:lesson.nome || lesson.sigla || lesson.path}]));
        const files=data.files||[];
        if(currentFile&&!files.some(file=>file.path===currentFile))clearEditor();
        const groups=groupFiles(files);
        $('filesList').innerHTML=groups.length?groups.map(([group,items])=>`<details class="file-group"><summary><span>${safe(group)}</span><span class="badge text-bg-secondary">${items.length}</span></summary><div class="file-group-items list-group">${items.sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true})).map(file=>`<button type="button" class="list-group-item list-group-item-action text-start ${file.path===currentFile?'active':''}" data-open-file="${safe(file.path)}" title="${safe(file.path)}"><i class="bi ${file.path.toLowerCase().endsWith('.css')?'bi-filetype-css':file.path.toLowerCase().endsWith('.js')?'bi-filetype-js':'bi-filetype-html'} me-2"></i>${safe(file.path.split('/').pop())}</button>`).join('')}</div></details>`).join(''):'<div class="p-3 text-muted">Nenhum arquivo HTML, CSS ou JavaScript encontrado (limite de 800 arquivos por curso).</div>';
        $('projectStatus').textContent=`${files.length} arquivo(s) encontrado(s).`;
      }catch(error){$('filesList').innerHTML=`<div class="alert alert-danger m-2">${safe(error.message)}</div>`;$('projectStatus').textContent='Falha ao atualizar.';}
    }
    async function openFile(path){
      try{
        const data=await api(projectUrl('/file?path='+encodeURIComponent(path)));currentFile=data.path;$('editingFileLabel').textContent=data.path;$('fileEditorWrap').hidden=false;$('fileEditorEmpty').hidden=true;$('saveFile').disabled=false;$('fileSaveStatus').textContent='Carregando editor...';
        const editor=await loadMonaco();setEditorValue(data.content,data.path);$('fileEditor').hidden=!editor;$('fileEditorFallback').hidden=!!editor;$('fileSaveStatus').textContent=editor?'':'Editor alternativo';
        $('filesList').querySelectorAll('[data-open-file]').forEach(item=>item.classList.toggle('active',item.dataset.openFile===currentFile));if(editor)setTimeout(()=>editor.layout(),50);
      }catch(error){$('fileSaveStatus').textContent=error.message;}
    }
    function syncSelectedProject(){selectedProject=$('selectedProject').value || '';clearEditor();if(selectedProject)loadFiles();else{$('filesList').innerHTML='<div class="text-muted p-3">Selecione um curso.</div>'; $('projectStatus').textContent='';}}
    $('selectedProject').addEventListener('change',syncSelectedProject);
    $('refreshFiles').addEventListener('click',loadFiles);
    document.getElementById('filesTabButton').addEventListener('shown.bs.tab',()=>{selectedProject=$('selectedProject').value || '';if(selectedProject)loadFiles();else $('filesList').innerHTML='<div class="text-muted p-3">Selecione um curso.</div>';});
    $('filesList').addEventListener('click',event=>{const button=event.target.closest('[data-open-file]');if(button)openFile(button.dataset.openFile);});
    $('saveFile').addEventListener('click',async()=>{if(!currentFile||!selectedProject)return;$('fileSaveStatus').textContent='Salvando...';try{const data=await api(projectUrl('/file'),{method:'PUT',body:JSON.stringify({path:currentFile,content:editorValue()})});$('fileSaveStatus').textContent=data.message||'Arquivo salvo.';}catch(error){$('fileSaveStatus').textContent=error.message;}});
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

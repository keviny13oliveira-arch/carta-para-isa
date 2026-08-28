/* Ponte v7: interface atual + memórias persistentes do Supabase. */
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function renderTexts(items) {
    const list = document.getElementById('textList');
    const empty = document.getElementById('textEmpty');
    if (!list) return;
    list.innerHTML = '';
    (items || []).forEach(function (item) {
      const card = document.createElement('article');
      card.className = 'text-card';
      const h = document.createElement('h3');
      h.textContent = item.title || 'Uma lembrança';
      const p = document.createElement('p');
      p.textContent = item.content || '';
      const small = document.createElement('small');
      small.textContent = item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '';

      const actions = document.createElement('div');
      actions.className = 'text-card-actions';
      actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'add-btn';
      edit.textContent = '✏️ Editar';
      edit.onclick = function () { editarTexto(item); };

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'nav-btn';
      remove.textContent = '🗑️ Excluir';
      remove.onclick = function () { excluirTexto(item); };

      actions.append(edit, remove);
      card.append(h, p, small, actions);
      list.appendChild(card);
    });
    if (empty) empty.style.display = (items && items.length) ? 'none' : 'block';
  }

  function createMediaActions(item, captionNode, refresh) {
    const actions = document.createElement('div');
    actions.className = item.media_type === 'photo' ? 'photo-actions' : 'video-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = item.media_type === 'photo' ? 'photo-action-btn edit-caption-btn' : 'add-btn';
    edit.textContent = '✏️ Editar legenda';
    edit.onclick = async function () {
      const next = prompt('Edite a legenda:', item.caption || '');
      if (next === null) return;
      try {
        await window.MemoriesCloud.updateMediaCaption(item.id, next.trim());
        item.caption = next.trim();
        captionNode.textContent = item.caption;
        await refresh();
      } catch (e) {
        console.error(e);
        alert('Não foi possível editar a legenda. Detalhes: ' + (e.message || e));
      }
    };

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = item.media_type === 'photo' ? 'photo-action-btn delete-photo-btn' : 'nav-btn';
    remove.textContent = '🗑️ Excluir';
    remove.onclick = async function () {
      if (!confirm('Deseja excluir esta memória? Essa ação não pode ser desfeita.')) return;
      try {
        await window.MemoriesCloud.deleteMedia(item.id, item.storage_path);
        await refresh();
      } catch (e) {
        console.error(e);
        alert('Não foi possível excluir a memória. Detalhes: ' + (e.message || e));
      }
    };

    actions.append(edit, remove);
    return actions;
  }

  async function refreshMedia() {
    renderCloudMedia(await window.MemoriesCloud.loadMedia());
  }

  function renderCloudMedia(items) {
    const grid = document.querySelector('.photo-grid');
    const videoPreview = document.getElementById('videoPreview');
    if (!grid) return;

    grid.querySelectorAll('.cloud-memory-card').forEach(function (node) { node.remove(); });

    (items || []).forEach(function (item) {
      if (!item.file_url || item.media_type !== 'photo') return;

      const article = document.createElement('article');
      article.className = 'photo-card cloud-memory-card';

      const img = document.createElement('img');
      img.alt = item.caption || 'Foto';
      img.src = item.file_url;
      img.loading = 'lazy';
      img.tabIndex = 0;
      img.onclick = function () {
        if (typeof abrirFoto === 'function') abrirFoto(img.src);
      };
      article.appendChild(img);

      const cap = document.createElement('div');
      cap.className = 'photo-caption';
      cap.textContent = item.caption || '';
      article.appendChild(cap);

      article.appendChild(createMediaActions(item, cap, refreshMedia));
      grid.appendChild(article);
    });

    if (videoPreview) {
      const videos = (items || []).filter(function (x) {
        return x.media_type === 'video' && x.file_url;
      });

      videoPreview.innerHTML = '';

      videos.forEach(function (item) {
        const wrap = document.createElement('div');
        wrap.className = 'video-card';

        const video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.src = item.file_url;
        wrap.appendChild(video);

        const cap = document.createElement('div');
        cap.className = 'photo-caption';
        cap.textContent = item.caption || '';
        wrap.appendChild(cap);

        wrap.appendChild(createMediaActions(item, cap, refreshMedia));
        videoPreview.appendChild(wrap);
      });
    }
  }

  function corrigirPortuguesDaCarta() {
    const carta = document.getElementById('carta');
    if (!carta) return;
    const trocar = function () {
      if (carta.textContent.indexOf('Because amar você') !== -1) {
        carta.textContent = carta.textContent.replace('Because amar você', 'Porque amar você');
      }
    };
    trocar();
    const observer = new MutationObserver(trocar);
    observer.observe(carta, { childList: true, characterData: true, subtree: true });
    setTimeout(function () { observer.disconnect(); trocar(); }, 30000);
  }

  ready(function () {
    if (!window.MemoriesCloud) {
      console.warn('MemoriesCloud não carregado.');
      return;
    }

    window.carregarTextos = async function () {
      try { renderTexts(await window.MemoriesCloud.loadTexts()); }
      catch (e) { console.error(e); }
    };

    window.salvarTexto = async function () {
      const titulo = document.getElementById('textoTitulo');
      const conteudo = document.getElementById('textoConteudo');
      if (!conteudo || !conteudo.value.trim()) { alert('Escreva algum texto antes de salvar.'); return; }
      const btn = document.querySelector('#textoForm button[onclick*="salvarTexto"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
      try {
        await window.MemoriesCloud.saveText(titulo ? titulo.value.trim() : '', conteudo.value.trim());
        if (titulo) titulo.value = '';
        conteudo.value = '';
        if (typeof toggleTextoForm === 'function') toggleTextoForm();
        await window.carregarTextos();
      } catch (e) {
        console.error(e);
        alert('Não foi possível salvar o texto na nuvem.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar texto'; }
      }
    };

    window.editarTexto = function (item) {
      const titulo = document.getElementById('textoTitulo');
      const conteudo = document.getElementById('textoConteudo');
      const form = document.getElementById('textoForm');
      if (!titulo || !conteudo || !form) return;
      titulo.value = item.title || '';
      conteudo.value = item.content || '';
      form.classList.add('open');
      window.__textoEditandoId = item.id;
      const btn = document.querySelector('#textoForm button[onclick*="salvarTexto"]');
      if (btn) btn.textContent = 'Salvar alterações';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const salvarOriginal = window.salvarTexto;
    window.salvarTexto = async function () {
      if (!window.__textoEditandoId) return salvarOriginal();
      const titulo = document.getElementById('textoTitulo');
      const conteudo = document.getElementById('textoConteudo');
      if (!conteudo || !conteudo.value.trim()) { alert('Escreva algum texto antes de salvar.'); return; }
      try {
        await window.MemoriesCloud.updateText(window.__textoEditandoId, titulo ? titulo.value.trim() : '', conteudo.value.trim());
        window.__textoEditandoId = null;
        if (titulo) titulo.value = '';
        conteudo.value = '';
        if (typeof toggleTextoForm === 'function') toggleTextoForm();
        const btn = document.querySelector('#textoForm button[onclick*="salvarTexto"]');
        if (btn) btn.textContent = 'Salvar texto';
        await window.carregarTextos();
      } catch (e) {
        console.error(e);
        alert('Não foi possível editar o texto na nuvem.');
      }
    };

    window.excluirTexto = async function (item) {
      if (!item || !item.id) return;
      if (!confirm('Excluir este texto? Essa ação não pode ser desfeita.')) return;
      try {
        await window.MemoriesCloud.deleteText(item.id);
        await window.carregarTextos();
      } catch (e) {
        console.error(e);
        alert('Não foi possível excluir o texto.');
      }
    };

    window.inserirVideo = async function (event) {
      const arquivo = event.target.files && event.target.files[0];
      if (!arquivo) return;
      if (!arquivo.type.startsWith('video/')) { alert('Escolha um arquivo de vídeo.'); return; }
      try {
        const caption = prompt('Quer adicionar uma legenda para este vídeo?') || '';
        const preview = document.getElementById('videoPreview');
        if (preview) preview.innerHTML = '<p>Enviando vídeo para a nuvem...</p>';
        await window.MemoriesCloud.saveVideo(arquivo, caption);
        renderCloudMedia(await window.MemoriesCloud.loadMedia());
        alert('Vídeo salvo na nuvem!');
      } catch (e) {
        console.error(e);
        alert('Não foi possível enviar o vídeo. Detalhes: ' + (e.message || e));
      } finally { event.target.value = ''; }
    };

    window.mostrarAvisoUploadFoto = function () {
      let input = document.getElementById('cloudPhotoInput');
      if (!input) {
        input = document.createElement('input');
        input.id = 'cloudPhotoInput';
        input.type = 'file';
        input.accept = 'image/*';
        input.hidden = true;
        document.body.appendChild(input);
        input.addEventListener('change', async function (event) {
          const file = event.target.files && event.target.files[0];
          if (!file) return;
          try {
            const caption = prompt('Quer adicionar uma legenda para esta foto?') || '';
            await window.MemoriesCloud.savePhoto(file, caption);
            renderCloudMedia(await window.MemoriesCloud.loadMedia());
            alert('Foto salva na nuvem!');
          } catch (e) {
            console.error(e);
            alert('Não foi possível enviar a foto. Detalhes: ' + (e.message || e));
          } finally { input.value = ''; }
        });
      }
      input.click();
    };

    window.addEventListener('memories-cloud-ready', function (event) {
      const data = event.detail || {};
      renderTexts(data.texts || []);
      renderCloudMedia(data.media || []);
    });

    window.addEventListener('memories-cloud-error', function (event) {
      console.warn('A nuvem não pôde ser carregada:', event.detail || 'erro desconhecido');
    });

    window.MemoriesCloud.loadTexts().then(renderTexts).catch(console.error);
    window.MemoriesCloud.loadMedia().then(renderCloudMedia).catch(console.error);
    corrigirPortuguesDaCarta();
  });
})();

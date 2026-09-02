/* Ponte v9: interface da carta + memórias persistentes do Supabase. */
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
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
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'add-btn';
      edit.textContent = '✏️ Editar';
      edit.onclick = function () { window.editarTexto(item); };
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-photo-btn';
      remove.textContent = '🗑️ Excluir';
      remove.onclick = function () { window.excluirTexto(item); };
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
        await refresh();
      } catch (error) {
        console.error(error);
        alert('Não foi possível editar a legenda. Detalhes: ' + (error.message || error));
      }
    };

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = item.media_type === 'photo' ? 'photo-action-btn delete-photo-btn' : 'delete-photo-btn';
    remove.textContent = '🗑️ Excluir';
    remove.onclick = async function () {
      if (!confirm('Deseja excluir esta memória? Essa ação não pode ser desfeita.')) return;
      try {
        await window.MemoriesCloud.deleteMedia(item.id, item.storage_path);
        await refresh();
      } catch (error) {
        console.error(error);
        alert('Não foi possível excluir a memória. Detalhes: ' + (error.message || error));
      }
    };
    actions.append(edit, remove);
    return actions;
  }

  async function refreshMedia() {
    renderCloudMedia(await window.MemoriesCloud.loadMedia());
  }

  function getPhotoGrid() {
    return document.getElementById('photoGrid') || document.querySelector('.photo-grid');
  }

  function getVideoList() {
    return document.getElementById('videoList') || document.getElementById('videoPreview');
  }

  function renderCloudMedia(items) {
    const grid = getPhotoGrid();
    const videoList = getVideoList();

    if (grid) {
      grid.innerHTML = '';
      const photos = (items || []).filter(function (item) {
        return item.media_type === 'photo' && item.file_url;
      });

      photos.forEach(function (item) {
        const article = document.createElement('article');
        article.className = 'photo-card cloud-memory-card';
        const img = document.createElement('img');
        img.alt = item.caption || 'Foto';
        img.src = item.file_url;
        img.loading = 'lazy';
        img.tabIndex = 0;
        img.onclick = function () {
          if (typeof window.abrirFoto === 'function') window.abrirFoto(img.src);
        };
        img.onkeydown = function (event) {
          if (event.key === 'Enter' && typeof window.abrirFoto === 'function') window.abrirFoto(img.src);
        };
        const cap = document.createElement('div');
        cap.className = 'photo-caption';
        cap.textContent = item.caption || '';
        article.append(img, cap);
        article.appendChild(createMediaActions(item, cap, refreshMedia));
        grid.appendChild(article);
      });

      if (!photos.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Ainda não há fotos adicionadas.';
        grid.appendChild(empty);
      }
    }

    if (videoList) {
      videoList.innerHTML = '';
      const videos = (items || []).filter(function (item) {
        return item.media_type === 'video' && item.file_url;
      });

      videos.forEach(function (item) {
        const wrap = document.createElement('div');
        wrap.className = 'video-card cloud-memory-card';
        const video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.src = item.file_url;
        const cap = document.createElement('div');
        cap.className = 'photo-caption';
        cap.textContent = item.caption || '';
        wrap.append(video, cap);
        wrap.appendChild(createMediaActions(item, cap, refreshMedia));
        videoList.appendChild(wrap);
      });

      if (!videos.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Ainda não há vídeos adicionados.';
        videoList.appendChild(empty);
      }
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

    /* O HTML antigo chama estas funções. Sobrescrevemos todas para impedir
       que localStorage e URLs temporárias concorram com o Supabase. */
    window.carregarFotos = function () {
      window.MemoriesCloud.loadMedia().then(renderCloudMedia).catch(console.error);
    };
    window.carregarVideos = window.carregarFotos;

    window.adicionarFotos = async function (event) {
      const arquivos = Array.from((event && event.target && event.target.files) || []);
      if (!arquivos.length) return;
      try {
        for (const arquivo of arquivos) {
          if (!arquivo.type || !arquivo.type.startsWith('image/')) continue;
          const caption = prompt('Quer adicionar uma legenda para esta foto?') || '';
          await window.MemoriesCloud.savePhoto(arquivo, caption);
        }
        await refreshMedia();
        alert(arquivos.length > 1 ? 'Fotos salvas na nuvem!' : 'Foto salva na nuvem!');
      } catch (error) {
        console.error(error);
        alert('Não foi possível enviar a foto. Detalhes: ' + (error.message || error));
      } finally {
        if (event && event.target) event.target.value = '';
      }
    };

    window.mostrarAvisoUploadFoto = function () {
      const input = document.getElementById('photoInput');
      if (input) input.click();
    };

    window.inserirVideo = async function (event) {
      const arquivos = Array.from((event && event.target && event.target.files) || []);
      if (!arquivos.length) return;
      try {
        for (const arquivo of arquivos) {
          if (!arquivo.type || !arquivo.type.startsWith('video/')) continue;
          const caption = prompt('Quer adicionar uma legenda para este vídeo?') || '';
          await window.MemoriesCloud.saveVideo(arquivo, caption);
        }
        await refreshMedia();
        alert(arquivos.length > 1 ? 'Vídeos salvos na nuvem!' : 'Vídeo salvo na nuvem!');
      } catch (error) {
        console.error(error);
        alert('Não foi possível enviar o vídeo. Detalhes: ' + (error.message || error));
      } finally {
        if (event && event.target) event.target.value = '';
      }
    };

    window.carregarTextos = async function () {
      try { renderTexts(await window.MemoriesCloud.loadTexts()); }
      catch (error) { console.error(error); }
    };

    window.__textoEditandoId = null;

    window.salvarTexto = async function () {
      const titulo = document.getElementById('textoTitulo');
      const conteudo = document.getElementById('textoConteudo');
      if (!conteudo || !conteudo.value.trim()) {
        alert('Escreva algum texto antes de salvar.');
        return;
      }
      try {
        if (window.__textoEditandoId) {
          await window.MemoriesCloud.updateText(
            window.__textoEditandoId,
            titulo ? titulo.value.trim() : '',
            conteudo.value.trim()
          );
        } else {
          await window.MemoriesCloud.saveText(
            titulo ? titulo.value.trim() : '',
            conteudo.value.trim()
          );
        }
        window.__textoEditandoId = null;
        if (titulo) titulo.value = '';
        conteudo.value = '';
        const form = document.getElementById('textoForm');
        if (form) form.classList.remove('open');
        await window.carregarTextos();
      } catch (error) {
        console.error(error);
        alert('Não foi possível salvar o texto na nuvem. Detalhes: ' + (error.message || error));
      }
    };

    window.editarTexto = function (item) {
      const titulo = document.getElementById('textoTitulo');
      const conteudo = document.getElementById('textoConteudo');
      const form = document.getElementById('textoForm');
      if (!item || !conteudo || !form) return;
      if (titulo) titulo.value = item.title || '';
      conteudo.value = item.content || '';
      window.__textoEditandoId = item.id;
      form.classList.add('open');
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.excluirTexto = async function (item) {
      if (!item || !item.id) return;
      if (!confirm('Excluir este texto? Essa ação não pode ser desfeita.')) return;
      try {
        await window.MemoriesCloud.deleteText(item.id);
        await window.carregarTextos();
      } catch (error) {
        console.error(error);
        alert('Não foi possível excluir o texto. Detalhes: ' + (error.message || error));
      }
    };

    window.addEventListener('memories-cloud-ready', function (event) {
      const data = event.detail || {};
      renderTexts(data.texts || []);
      renderCloudMedia(data.media || []);
    });

    window.MemoriesCloud.loadTexts().then(renderTexts).catch(console.error);
    window.MemoriesCloud.loadMedia().then(renderCloudMedia).catch(console.error);
    corrigirPortuguesDaCarta();
  });
})();
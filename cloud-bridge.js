/* Ponte v8: interface da carta + memórias persistentes do Supabase. */
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
      small.textContent = item.created_at
        ? new Date(item.created_at).toLocaleDateString('pt-BR')
        : '';

      const actions = document.createElement('div');
      actions.className = 'text-card-actions';
      actions.style.cssText =
        'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'add-btn';
      edit.textContent = '✏️ Editar';
      edit.onclick = function () { window.editarTexto(item); };

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'nav-btn';
      remove.textContent = '🗑️ Excluir';
      remove.onclick = function () { window.excluirTexto(item); };

      actions.append(edit, remove);
      card.append(h, p, small, actions);
      list.appendChild(card);
    });

    if (empty) {
      empty.style.display = (items && items.length) ? 'none' : 'block';
    }
  }

  function createMediaActions(item, captionNode, refresh) {
    const actions = document.createElement('div');
    actions.className =
      item.media_type === 'photo'
        ? 'photo-actions'
        : 'video-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className =
      item.media_type === 'photo'
        ? 'photo-action-btn edit-caption-btn'
        : 'add-btn';
    edit.textContent = '✏️ Editar legenda';

    edit.onclick = async function () {
      const next = prompt('Edite a legenda:', item.caption || '');
      if (next === null) return;

      try {
        await window.MemoriesCloud.updateMediaCaption(
          item.id,
          next.trim()
        );
        item.caption = next.trim();
        captionNode.textContent = item.caption;
        await refresh();
      } catch (error) {
        console.error(error);
        alert(
          'Não foi possível editar a legenda. Detalhes: ' +
          (error.message || error)
        );
      }
    };

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className =
      item.media_type === 'photo'
        ? 'photo-action-btn delete-photo-btn'
        : 'nav-btn';
    remove.textContent = '🗑️ Excluir';

    remove.onclick = async function () {
      if (!confirm(
        'Deseja excluir esta memória? Essa ação não pode ser desfeita.'
      )) return;

      try {
        await window.MemoriesCloud.deleteMedia(
          item.id,
          item.storage_path
        );
        await refresh();
      } catch (error) {
        console.error(error);
        alert(
          'Não foi possível excluir a memória. Detalhes: ' +
          (error.message || error)
        );
      }
    };

    actions.append(edit, remove);
    return actions;
  }

  async function refreshMedia() {
    const items = await window.MemoriesCloud.loadMedia();
    renderCloudMedia(items);
  }

  function renderCloudMedia(items) {
    const grid = document.querySelector('.photo-grid');
    let videoPreview = document.getElementById('videoPreview');

    if (!videoPreview) {
      const videoInput = document.getElementById('videoInput');
      const videoHost = videoInput
        ? videoInput.parentElement
        : null;

      if (videoHost) {
        videoPreview = document.createElement('div');
        videoPreview.id = 'videoPreview';
        videoHost.appendChild(videoPreview);
      }
    }

    if (grid) {
      grid.innerHTML = '';

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

        img.onkeydown = function (event) {
          if (event.key === 'Enter' && typeof abrirFoto === 'function') {
            abrirFoto(img.src);
          }
        };

        const cap = document.createElement('div');
        cap.className = 'photo-caption';
        cap.textContent = item.caption || '';

        article.append(img, cap);
        article.appendChild(
          createMediaActions(item, cap, refreshMedia)
        );

        grid.appendChild(article);
      });
    }

    if (videoPreview) {
      const videos = (items || []).filter(function (item) {
        return item.media_type === 'video' && item.file_url;
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

        const cap = document.createElement('div');
        cap.className = 'photo-caption';
        cap.textContent = item.caption || '';

        wrap.append(video, cap);
        wrap.appendChild(
          createMediaActions(item, cap, refreshMedia)
        );

        videoPreview.appendChild(wrap);
      });
    }
  }

  function corrigirPortuguesDaCarta() {
    const carta = document.getElementById('carta');
    if (!carta) return;

    const trocar = function () {
      if (carta.textContent.indexOf('Because amar você') !== -1) {
        carta.textContent = carta.textContent.replace(
          'Because amar você',
          'Porque amar você'
        );
      }
    };

    trocar();

    const observer = new MutationObserver(trocar);
    observer.observe(carta, {
      childList: true,
      characterData: true,
      subtree: true
    });

    setTimeout(function () {
      observer.disconnect();
      trocar();
    }, 30000);
  }

  ready(function () {
    if (!window.MemoriesCloud) {
      console.warn('MemoriesCloud não carregado.');
      return;
    }

    window.carregarTextos = async function () {
      try {
        renderTexts(await window.MemoriesCloud.loadTexts());
      } catch (error) {
        console.error(error);
      }
    };

    window.__textoEditandoId = null;

    window.salvarTexto = async function () {
      const titulo = document.getElementById('textoTitulo');
      const conteudo = document.getElementById('textoConteudo');

      if (!conteudo || !conteudo.value.trim()) {
        alert('Escreva algum texto antes de salvar.');
        return;
      }

      const btn = document.querySelector(
        '#textoForm button[onclick*="salvarTexto"]'
      );

      if (btn) {
        btn.disabled = true;
        btn.textContent = window.__textoEditandoId
          ? 'Salvando...'
          : 'Salvando...';
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

        if (btn) btn.textContent = 'Salvar texto';

        await window.carregarTextos();
      } catch (error) {
        console.error(error);
        alert(
          'Não foi possível salvar o texto na nuvem. Detalhes: ' +
          (error.message || error)
        );
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Salvar texto';
        }
      }
    };

    window.editarTexto = function (item) {
      const titulo = document.getElementById('textoTitulo');
      const conteudo = document.getElementById('textoConteudo');
      const form = document.getElementById('textoForm');

      if (!conteudo || !form) return;

      if (titulo) titulo.value = item.title || '';
      conteudo.value = item.content || '';

      window.__textoEditandoId = item.id;
      form.classList.add('open');

      const btn = document.querySelector(
        '#textoForm button[onclick*="salvarTexto"]'
      );
      if (btn) btn.textContent = 'Salvar alterações';

      form.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    };

    window.excluirTexto = async function (item) {
      if (!item || !item.id) return;

      if (!confirm(
        'Excluir este texto? Essa ação não pode ser desfeita.'
      )) return;

      try {
        await window.MemoriesCloud.deleteText(item.id);
        await window.carregarTextos();
      } catch (error) {
        console.error(error);
        alert(
          'Não foi possível excluir o texto. Detalhes: ' +
          (error.message || error)
        );
      }
    };

    window.inserirVideo = async function (event) {
      const arquivo =
        event.target.files && event.target.files[0];

      if (!arquivo) return;

      if (!arquivo.type.startsWith('video/')) {
        alert('Escolha um arquivo de vídeo.');
        event.target.value = '';
        return;
      }

      try {
        const caption =
          prompt('Quer adicionar uma legenda para este vídeo?') || '';

        const preview = document.getElementById('videoPreview');
        if (preview) {
          preview.innerHTML =
            '<p>Enviando vídeo para a nuvem...</p>';
        }

        await window.MemoriesCloud.saveVideo(
          arquivo,
          caption
        );

        await refreshMedia();
        alert('Vídeo salvo na nuvem!');
      } catch (error) {
        console.error(error);
        alert(
          'Não foi possível enviar o vídeo. Detalhes: ' +
          (error.message || error)
        );
      } finally {
        event.target.value = '';
      }
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

        input.addEventListener(
          'change',
          async function (event) {
            const file =
              event.target.files &&
              event.target.files[0];

            if (!file) return;

            try {
              const caption =
                prompt(
                  'Quer adicionar uma legenda para esta foto?'
                ) || '';

              await window.MemoriesCloud.savePhoto(
                file,
                caption
              );

              await refreshMedia();
              alert('Foto salva na nuvem!');
            } catch (error) {
              console.error(error);
              alert(
                'Não foi possível enviar a foto. Detalhes: ' +
                (error.message || error)
              );
            } finally {
              input.value = '';
            }
          }
        );
      }

      input.click();
    };

    window.addEventListener(
      'memories-cloud-ready',
      function (event) {
        const data = event.detail || {};
        renderTexts(data.texts || []);
        renderCloudMedia(data.media || []);
      }
    );

    window.addEventListener(
      'memories-cloud-error',
      function (event) {
        console.warn(
          'A nuvem não pôde ser carregada:',
          event.detail || 'erro desconhecido'
        );
      }
    );

    window.MemoriesCloud.loadTexts()
      .then(renderTexts)
      .catch(console.error);

    window.MemoriesCloud.loadMedia()
      .then(renderCloudMedia)
      .catch(console.error);

    corrigirPortuguesDaCarta();
  });
})();
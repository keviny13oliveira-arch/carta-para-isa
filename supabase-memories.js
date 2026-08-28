/* Memórias na nuvem — Isa-carta v8 */
const SUPABASE_URL = 'https://nhmgqktflcuwqzawfxan.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_mVmLJLRskPluXZwqIUDtew_tBiTYlmD';

(function () {
  const STORAGE_BUCKET = 'memory-media';
  const MEDIA_TABLE = 'memory_media';
  const TEXT_TABLE = 'text_memories';

  async function api(path, options = {}) {
    const headers = Object.assign({
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: 'Bearer ' + SUPABASE_PUBLIC_KEY,
      'Content-Type': 'application/json'
    }, options.headers || {});

    const response = await fetch(
      SUPABASE_URL + '/rest/v1/' + path,
      Object.assign({}, options, { headers })
    );

    if (!response.ok) throw new Error(await response.text());
    return response.status === 204 ? null : response.json();
  }

  async function upload(file, folder) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = folder + '/' + Date.now() + '_' + safeName;

    const response = await fetch(
      SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' +
      path.split('/').map(encodeURIComponent).join('/'),
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_PUBLIC_KEY,
          Authorization: 'Bearer ' + SUPABASE_PUBLIC_KEY,
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'false',
          'cache-control': '3600'
        },
        body: file
      }
    );

    if (!response.ok) {
      throw new Error('Storage ' + response.status + ': ' + await response.text());
    }

    return path;
  }

  function publicUrl(path) {
    if (!path) return '';
    return SUPABASE_URL +
      '/storage/v1/object/public/' +
      STORAGE_BUCKET + '/' +
      path.split('/').map(encodeURIComponent).join('/');
  }

  async function saveText(title, content) {
    return api(TEXT_TABLE, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        title: title || null,
        content: content
      })
    });
  }

  async function loadTexts() {
    return api(TEXT_TABLE + '?select=*&order=created_at.desc');
  }

  async function updateText(id, title, content) {
    return api(TEXT_TABLE + '?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        title: title || null,
        content: content
      })
    });
  }

  async function deleteText(id) {
    return api(TEXT_TABLE + '?id=eq.' + encodeURIComponent(id), {
      method: 'DELETE'
    });
  }

  async function saveMedia(file, mediaType, caption) {
    const folder = mediaType === 'video' ? 'videos' : 'photos';
    const storagePath = await upload(file, folder);
    const url = publicUrl(storagePath);

    try {
      return await api(MEDIA_TABLE, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          storage_path: storagePath,
          public_url: url,
          media_type: mediaType,
          caption: caption || ''
        })
      });
    } catch (error) {
      console.error('O upload foi concluído, mas o registro da memória falhou:', error);
      throw error;
    }
  }

  function savePhoto(file, caption) {
    return saveMedia(file, 'photo', caption);
  }

  function saveVideo(file, caption) {
    return saveMedia(file, 'video', caption);
  }

  async function updateMediaCaption(id, caption) {
    return api(MEDIA_TABLE + '?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ caption: caption || '' })
    });
  }

  async function removeStorage(path) {
    if (!path) return null;

    const response = await fetch(
      SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' +
      path.split('/').map(encodeURIComponent).join('/'),
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_PUBLIC_KEY,
          Authorization: 'Bearer ' + SUPABASE_PUBLIC_KEY
        }
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(await response.text());
    }
  }

  async function deleteMedia(id, storagePath) {
    await api(
      MEDIA_TABLE + '?id=eq.' + encodeURIComponent(id),
      { method: 'DELETE' }
    );

    try {
      await removeStorage(storagePath);
    } catch (error) {
      console.warn('Registro excluído, mas o arquivo não pôde ser removido:', error);
    }
  }

  async function loadMedia() {
    const rows = await api(
      MEDIA_TABLE + '?select=*&order=created_at.asc,id.asc'
    );

    return (rows || []).map(function (item) {
      return Object.assign({}, item, {
        file_url: item.public_url || publicUrl(item.storage_path)
      });
    });
  }

  async function init() {
    try {
      const results = await Promise.all([
        loadTexts(),
        loadMedia()
      ]);

      window.dispatchEvent(
        new CustomEvent('memories-cloud-ready', {
          detail: {
            texts: results[0],
            media: results[1]
          }
        })
      );
    } catch (error) {
      console.error('Falha ao carregar memórias da nuvem:', error);
      window.dispatchEvent(
        new CustomEvent('memories-cloud-error', {
          detail: error
        })
      );
    }
  }

  window.MemoriesCloud = {
    ready: true,
    saveText,
    loadTexts,
    updateText,
    deleteText,
    savePhoto,
    saveVideo,
    updateMediaCaption,
    deleteMedia,
    loadMedia
  };

  init();
})();
// Gallery grid rendering logic
export function renderGallery(container, { getState }) {
  const getClassIcon = (classVal) => {
    const configs = getState('classesConfig', {});
    return (configs[classVal] && configs[classVal].icon) || 'draft';
  };

  const getClassLabel = (classVal) => {
    const configs = getState('classesConfig', {});
    return (configs[classVal] && configs[classVal].label) || classVal;
  };

  const getMetadata = (obj) => {
    if (typeof obj.metadata === 'string') {
      try {
        return JSON.parse(obj.metadata);
      } catch {
        return {};
      }
    }
    return obj.metadata || {};
  };

  const objects = getState('objects', []);
  
  if (objects.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--md-sys-color-outline); font-size: 0.9rem;">
        No notes found.
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  objects.forEach(obj => {
    const meta = getMetadata(obj);
    const hasScore = (obj.class || obj.type) === 'golf';
    const classVal = obj.class || obj.type || 'note';
    
    const card = document.createElement('article');
    card.id = 'card-' + obj.id;
    card.className = 'card';
    card.onclick = () => {
      if (window.appInstance) {
        window.appInstance.actions.openTab(obj);
      }
    };

    let badgeHtml = '';
    if (meta._inbox) {
      badgeHtml = `
        <span class="card-inbox-badge">
          <span class="material-symbols-rounded" style="font-size: 0.95rem; vertical-align: middle;">inbox</span>
          <span style="font-size: 0.75rem; font-weight: 600; margin-left: 0.2rem;">INBOX</span>
        </span>
      `;
    }

    let bodyHtml = '';
    if (hasScore) {
      bodyHtml = `
        <div class="card-score">
          <strong>Score: ${meta.score !== undefined ? meta.score : 'N/A'}</strong>
        </div>
      `;
    } else {
      const text = (obj.content || '').substring(0, 100) + ((obj.content || '').length > 100 ? '...' : '');
      bodyHtml = `
        <div class="card-content">
          ${escapeHtml(text)}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-type-row">
        <span class="material-symbols-rounded card-icon">${getClassIcon(classVal)}</span>
        <span class="card-type">${getClassLabel(classVal)}</span>
        ${badgeHtml}
      </div>
      <h3>${escapeHtml(obj.title)}</h3>
      ${bodyHtml}
      <div class="card-location">📍 ${escapeHtml(meta.location || 'Unknown')}</div>
    `;
    
    container.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

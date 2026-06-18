import { renderGallery } from './gallery.js?v=52';

export function renderExplorer(container, { getState, setState }) {
  container.innerHTML = `
    <div class="explorer-dashboard">
      <div class="search-dashboard-container">
        <!-- AI Quick Add Panel -->
        <div class="quick-add-container">
          <div class="quick-add-input-wrapper">
            <input id="quick-add-input" type="text" placeholder="AI Quick Add: &quot;the gate code at the villa walk in gate is 1234&quot;...">
            <button id="btn-quick-add" class="btn-quick-add" title="Quick Add with AI">
              <span class="material-symbols-rounded" id="quick-add-icon">auto_awesome</span>
            </button>
          </div>
        </div>
        
        <!-- Search Panel -->
        <div class="search-main">
          <div class="search-input-wrapper">
            <input id="search-bar" type="text" placeholder="Search notes and tasks...">
            <button id="btn-clear-search" class="btn-clear-search hidden" title="Clear">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <button id="btn-toggle-advanced" title="Toggle Advanced Search">
            <span class="material-symbols-rounded">tune</span>
          </button>
        </div>
        
        <!-- Advanced Search Panel -->
        <div id="advanced-search-panel" class="advanced-search hidden">
          <select id="class-filter">
            <option value="">All Classes</option>
          </select>
          <input id="tag-filter" type="text" placeholder="Filter by #tag">
        </div>
      </div>
      
      <!-- Gallery Container -->
      <div id="note-list"></div>
    </div>
  `;
  
  const quickAddInput = container.querySelector('#quick-add-input');
  const btnQuickAdd = container.querySelector('#btn-quick-add');
  const quickAddIcon = container.querySelector('#quick-add-icon');
  const searchBar = container.querySelector('#search-bar');
  const btnClearSearch = container.querySelector('#btn-clear-search');
  const btnToggleAdvanced = container.querySelector('#btn-toggle-advanced');
  const advancedSearchPanel = container.querySelector('#advanced-search-panel');
  const classFilter = container.querySelector('#class-filter');
  const tagFilter = container.querySelector('#tag-filter');
  const noteList = container.querySelector('#note-list');
  
  quickAddInput.value = getState('quickAddText', '');
  searchBar.value = getState('searchQuery', '');
  tagFilter.value = getState('searchTag', '');
  
  const updateQuickAddButton = () => {
    const loading = getState('quickAddLoading', false);
    btnQuickAdd.disabled = !quickAddInput.value.trim() || loading;
    btnQuickAdd.className = `btn-quick-add ${loading ? 'loading' : ''}`;
    quickAddIcon.textContent = loading ? 'sync' : 'auto_awesome';
    quickAddInput.disabled = loading;
  };
  
  updateQuickAddButton();
  
  quickAddInput.oninput = (e) => {
    setState('quickAddText', e.target.value);
    updateQuickAddButton();
  };
  
  const triggerQuickAdd = () => {
    const val = getState('quickAddText', '');
    if (val && val.trim() && window.appInstance) {
      window.appInstance.actions.quickAddNote(val);
    }
  };
  
  quickAddInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerQuickAdd();
    }
  };
  
  btnQuickAdd.onclick = triggerQuickAdd;
  
  const handleSearchInput = () => {
    setState('searchQuery', searchBar.value);
    if (searchBar.value) {
      btnClearSearch.classList.remove('hidden');
    } else {
      btnClearSearch.classList.add('hidden');
    }
    if (window.appInstance) window.appInstance.actions.fetchObjects();
  };
  
  searchBar.oninput = handleSearchInput;
  if (searchBar.value) btnClearSearch.classList.remove('hidden');
  
  btnClearSearch.onclick = () => {
    searchBar.value = '';
    btnClearSearch.classList.add('hidden');
    setState('searchQuery', '');
    if (window.appInstance) window.appInstance.actions.fetchObjects();
  };
  
  const updateAdvancedSearchUI = () => {
    const open = getState('advancedSearchOpen', false);
    if (open) {
      advancedSearchPanel.classList.remove('hidden');
    } else {
      advancedSearchPanel.classList.add('hidden');
    }
  };
  updateAdvancedSearchUI();
  
  btnToggleAdvanced.onclick = () => {
    const nextVal = !getState('advancedSearchOpen', false);
    setState('advancedSearchOpen', nextVal);
    updateAdvancedSearchUI();
  };
  
  const classes = getState('classes', []);
  const configs = getState('classesConfig', {});
  const activeClass = getState('searchClass', '');
  
  classes.forEach(t => {
    const label = (configs[t] && configs[t].label) || (t.charAt(0).toUpperCase() + t.slice(1));
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = label;
    if (t === activeClass) opt.selected = true;
    classFilter.appendChild(opt);
  });
  
  classFilter.onchange = (e) => {
    setState('searchClass', e.target.value);
    if (window.appInstance) window.appInstance.actions.fetchObjects();
  };
  
  tagFilter.oninput = (e) => {
    setState('searchTag', e.target.value);
    if (window.appInstance) window.appInstance.actions.fetchObjects();
  };
  
  renderGallery(noteList, { getState });
}

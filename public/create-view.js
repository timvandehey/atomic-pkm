// Create Note View Component
export function renderCreateView(container, { getState, setState }) {
  container.innerHTML = `
    <div class="create-view">
      <div class="create-form">
        <h2 style="margin-top: 0; text-align: center;">New Note</h2>
        <input type="text" id="new-title" placeholder="Title">
        <div class="create-row">
          <select id="class-select"></select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <button id="btn-submit-create" class="btn-primary">Create</button>
          <button id="btn-cancel-create">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  const titleInput = container.querySelector('#new-title');
  const classSelect = container.querySelector('#class-select');
  const btnSubmit = container.querySelector('#btn-submit-create');
  const btnCancel = container.querySelector('#btn-cancel-create');
  
  titleInput.value = getState('newNoteTitle', '');
  
  const classes = getState('classes', []);
  const configs = getState('classesConfig', {});
  const activeClass = getState('newNoteClass', 'note');
  
  classes.forEach(c => {
    const label = (configs[c] && configs[c].label) || (c.charAt(0).toUpperCase() + c.slice(1));
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = label;
    if (c === activeClass) opt.selected = true;
    classSelect.appendChild(opt);
  });
  
  titleInput.oninput = (e) => {
    setState('newNoteTitle', e.target.value);
  };
  
  classSelect.onchange = (e) => {
    setState('newNoteClass', e.target.value);
  };
  
  btnSubmit.onclick = () => {
    if (window.appInstance) {
      window.appInstance.actions.submitNewNote();
    }
  };
  
  btnCancel.onclick = () => {
    if (window.appInstance) {
      window.appInstance.actions.cancelNewNote();
    }
  };
  
  setTimeout(() => {
    titleInput.focus();
    titleInput.select();
  }, 50);
}

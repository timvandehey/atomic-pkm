export const CreateNoteComponent = (props, { getState, setState }) => {
  return {
    div: {
      class: 'create-view',
      children: [
        {
          div: {
            class: 'create-form',
            children: [
              {
                h2: {
                  style: 'margin-top: 0; text-align: center;',
                  text: 'New Note'
                }
              },
              {
                input: {
                  type: 'text',
                  id: 'new-title',
                  placeholder: 'Title',
                  value: () => getState('newNoteTitle', ''),
                  oninput: (e) => setState('newNoteTitle', e.target.value)
                }
              },
              {
                div: {
                  class: 'create-row',
                  children: [
                    {
                      select: {
                        id: 'type-select',
                        value: () => getState('newNoteType', 'note'),
                        onchange: (e) => setState('newNoteType', e.target.value),
                        children: () => {
                          const types = getState('types', []);
                          const customTypes = types.filter(t => !['note', 'task', 'template', 'golf'].includes(t));
                          const baseOptions = [
                            { value: 'note', label: 'Note' },
                            { value: 'task', label: 'Task' },
                            { value: 'template', label: 'Template' },
                            { value: 'golf', label: 'Golf' }
                          ];
                          
                          const allOptions = [...baseOptions];
                          customTypes.forEach(t => {
                            allOptions.push({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) });
                          });

                          return allOptions.map(opt => ({
                            option: {
                              value: opt.value,
                              text: opt.label
                            }
                          }));
                        }
                      }
                    },
                    {
                      select: {
                        id: 'template-select',
                        value: () => getState('selectedTemplate', ''),
                        onchange: (e) => setState('selectedTemplate', e.target.value),
                        children: () => {
                          const objects = getState('objects', []);
                          const templates = objects.filter(o => o.type === 'template');
                          const allOptions = [{ value: '', label: 'No Template' }];
                          
                          templates.forEach(t => {
                            allOptions.push({ value: t.id, label: t.title });
                          });

                          return allOptions.map(opt => ({
                            option: {
                              value: opt.value,
                              text: opt.label
                            }
                          }));
                        }
                      }
                    }
                  ]
                }
              },
              {
                div: {
                  style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;',
                  children: [
                    {
                      button: {
                        class: 'btn-primary',
                        text: 'Create',
                        onclick: () => {
                          if (window.appInstance) {
                            window.appInstance.actions.submitNewNote();
                          }
                        }
                      }
                    },
                    {
                      button: {
                        text: 'Cancel',
                        onclick: () => {
                          if (window.appInstance) {
                            window.appInstance.actions.cancelNewNote();
                          }
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  };
};

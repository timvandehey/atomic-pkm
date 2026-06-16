export const CreateNoteComponent = (props, context) => {
  return {
    hooks: {
      onMount: () => {
        setTimeout(() => {
          const input = document.getElementById('new-title');
          if (input) {
            input.focus();
            input.select();
          }
        }, 50);
      }
    },
    render: () => {
      const { getState, setState } = context;
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
                      style: { marginTop: '0', textAlign: 'center' },
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
                            id: 'class-select',
                            value: () => getState('newNoteClass', 'note'),
                            onchange: (e) => setState('newNoteClass', e.target.value),
                            children: () => {
                              const classes = getState('classes', []);
                              const configs = getState('classesConfig', {});

                              return classes.map(c => {
                                const label = (configs[c] && configs[c].label) || (c.charAt(0).toUpperCase() + c.slice(1));
                                const isSelected = c === getState('newNoteClass', 'note');
                                return {
                                  option: {
                                    value: c,
                                    text: label,
                                    selected: isSelected
                                  }
                                };
                              });
                            }
                          }
                        }
                      ]
                    }
                  },
                  {
                    div: {
                      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
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
    }
  };
};


import { GalleryComponent } from './gallery.js?v=52';

export const ExplorerComponent = (props, { getState, setState }) => {
  return {
    div: {
      class: 'explorer-dashboard',
      children: [
        // Search & Filter Panel
        {
          div: {
            class: 'search-dashboard-container',
            children: [
              // AI Quick Add Panel
              {
                div: {
                  class: 'quick-add-container',
                  children: [
                    {
                      div: {
                        class: 'quick-add-input-wrapper',
                        children: [
                          {
                            input: {
                              id: 'quick-add-input',
                              type: 'text',
                              placeholder: 'AI Quick Add: "the gate code at the villa walk in gate is 1234"...',
                              value: () => getState('quickAddText', ''),
                              disabled: () => getState('quickAddLoading', false),
                              oninput: (e) => {
                                setState('quickAddText', e.target.value);
                              },
                              onkeydown: (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = getState('quickAddText', '');
                                  if (val && val.trim() && window.appInstance) {
                                    window.appInstance.actions.quickAddNote(val);
                                  }
                                }
                              }
                            }
                          },
                          {
                            button: {
                              class: () => `btn-quick-add ${getState('quickAddLoading', false) ? 'loading' : ''}`,
                              title: 'Quick Add with AI',
                              disabled: () => !getState('quickAddText', '').trim() || getState('quickAddLoading', false),
                              onclick: () => {
                                const val = getState('quickAddText', '');
                                if (val && val.trim() && window.appInstance) {
                                  window.appInstance.actions.quickAddNote(val);
                                }
                              },
                              children: [
                                {
                                  span: {
                                    class: 'material-symbols-rounded',
                                    text: () => getState('quickAddLoading', false) ? 'sync' : 'auto_awesome'
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
              },
              {
                div: {
                  class: 'search-main',
                  children: [
                    {
                      div: {
                        class: 'search-input-wrapper',
                        children: [
                          {
                            input: {
                              id: 'search-bar',
                              type: 'text',
                              placeholder: 'Search notes and tasks...',
                              value: () => getState('searchQuery', ''),
                              oninput: (e) => {
                                setState('searchQuery', e.target.value);
                                if (window.appInstance) window.appInstance.actions.fetchObjects();
                              }
                            }
                          },
                          {
                            button: {
                              class: () => `btn-clear-search ${getState('searchQuery', '') ? '' : 'hidden'}`,
                              title: 'Clear',
                              onclick: () => {
                                setState('searchQuery', '');
                                if (window.appInstance) window.appInstance.actions.fetchObjects();
                              },
                              children: [{ span: { class: 'material-symbols-rounded', text: 'close' } }]
                            }
                          }
                        ]
                      }
                    },
                    {
                      button: {
                        id: 'btn-toggle-advanced',
                        title: 'Toggle Advanced Search',
                        onclick: () => setState('advancedSearchOpen', !getState('advancedSearchOpen', false)),
                        children: [{ span: { class: 'material-symbols-rounded', text: 'tune' } }]
                      }
                    }
                  ]
                }
              },
              {
                div: {
                  class: () => `advanced-search ${getState('advancedSearchOpen', false) ? '' : 'hidden'}`,
                  children: [
                    {
                      select: {
                        id: 'class-filter',
                        value: () => getState('searchClass', ''),
                        onchange: (e) => {
                          setState('searchClass', e.target.value);
                          if (window.appInstance) window.appInstance.actions.fetchObjects();
                        },
                        children: () => {
                          const classes = getState('classes', []);
                          const configs = getState('classesConfig', {});
                          const options = [{ value: '', text: 'All Classes' }];
                          classes.forEach(t => {
                            const label = (configs[t] && configs[t].label) || (t.charAt(0).toUpperCase() + t.slice(1));
                            options.push({ value: t, text: label });
                          });
                          return options.map(opt => ({
                            option: {
                              value: opt.value,
                              text: opt.text
                            }
                          }));
                        }
                      }
                    },
                    {
                      input: {
                        id: 'tag-filter',
                        type: 'text',
                        placeholder: 'Filter by #tag',
                        value: () => getState('searchTag', ''),
                        oninput: (e) => {
                          setState('searchTag', e.target.value);
                          if (window.appInstance) window.appInstance.actions.fetchObjects();
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        // Grid Gallery of Note Cards
        GalleryComponent(props, { getState, setState })
      ]
    }
  };
};

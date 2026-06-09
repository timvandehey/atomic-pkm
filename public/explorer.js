import { GalleryComponent } from './gallery.js?v=5';

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
                        id: 'type-filter',
                        value: () => getState('searchType', ''),
                        onchange: (e) => {
                          setState('searchType', e.target.value);
                          if (window.appInstance) window.appInstance.actions.fetchObjects();
                        },
                        children: () => {
                          const types = getState('types', []);
                          const options = [{ value: '', text: 'All Types' }];
                          types.forEach(t => {
                            options.push({ value: t, text: t.charAt(0).toUpperCase() + t.slice(1) });
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

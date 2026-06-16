export const GalleryComponent = (props, { getState }) => {
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

  return {
    div: {
      id: 'note-list',
      children: () => {
        const objects = getState('objects', []);
        if (objects.length === 0) {
          return [
            {
              div: {
                style: { padding: '2rem', textAlign: 'center', color: 'var(--md-sys-color-outline)', fontSize: '0.9rem' },
                text: 'No notes found.'
              }
            }
          ];
        }

        return objects.map(obj => {
          const meta = getMetadata(obj);
          const hasScore = (obj.class || obj.type) === 'golf';
          
          return {
            article: {
              id: 'card-' + obj.id,
              class: 'card',
              onclick: () => {
                if (window.appInstance) {
                  window.appInstance.actions.openTab(obj);
                }
              },
              children: [
                {
                  div: {
                    class: 'card-type-row',
                    children: [
                      {
                        span: {
                          class: 'material-symbols-rounded card-icon',
                          text: getClassIcon(obj.class || obj.type)
                        }
                      },
                      {
                        span: {
                          class: 'card-type',
                          text: getClassLabel(obj.class || obj.type)
                        }
                      },
                      meta._inbox ? {
                        span: {
                          class: 'card-inbox-badge',
                          children: [
                            { span: { class: 'material-symbols-rounded', style: { fontSize: '0.95rem', verticalAlign: 'middle' }, text: 'inbox' } },
                            { span: { style: { fontSize: '0.75rem', fontWeight: '600', marginLeft: '0.2rem' }, text: 'INBOX' } }
                          ]
                        }
                      } : null
                    ]
                  }
                },
                {
                  h3: {
                    text: obj.title
                  }
                },
                hasScore ? {
                  div: {
                    class: 'card-score',
                    children: [
                      {
                        strong: {
                          text: `Score: ${meta.score !== undefined ? meta.score : 'N/A'}`
                        }
                      }
                    ]
                  }
                } : {
                  div: {
                    class: 'card-content',
                    text: (obj.content || '').substring(0, 100) + ((obj.content || '').length > 100 ? '...' : '')
                  }
                },
                {
                  div: {
                    class: 'card-location',
                    text: `📍 ${meta.location || 'Unknown'}`
                  }
                }
              ]
            }
          };
        });
      }
    }
  };
};

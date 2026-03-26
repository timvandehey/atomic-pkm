export function initEditor() {
    window.addEventListener('open-editor', (e) => {
        const obj = e.detail;
        const modal = document.getElementById('editor-modal');
        const meta = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata;

        // 1. Fill Body
        document.getElementById('body-editor').value = obj.content;
        
        // 2. Build Meta Form
        const formContainer = document.getElementById('metadata-form');
        formContainer.innerHTML = ''; 
        
        Object.keys(meta).forEach(key => {
            const div = document.createElement('div');
            div.className = 'form-row';
            div.innerHTML = `
                <label>${key}</label>
                <input type="text" data-key="${key}" value="${meta[key]}">
            `;
            formContainer.appendChild(div);
        });

        // 3. Attach Save Logic
        const saveBtn = modal.querySelector('button[onclick="saveObject()"]');
        saveBtn.onclick = () => saveObject(obj.id);

        modal.style.display = 'block';
    });
}

async function saveObject(id) {
    const content = document.getElementById('body-editor').value;
    const metaInputs = document.querySelectorAll('#metadata-form input');
    
    const metadata = {};
    metaInputs.forEach(input => {
        metadata[input.dataset.key] = input.value;
    });

    const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content, metadata })
    });

    if (response.ok) {
        document.getElementById('editor-modal').style.display = 'none';
        window.location.reload(); // Simple refresh for now to re-index
    }
}

window.closeEditor = () => {
    document.getElementById('editor-modal').style.display = 'none';
};
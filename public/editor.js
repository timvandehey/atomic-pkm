// Helper to determine the best HTML input type
function getInputType(key, value) {
    const k = key.toLowerCase();
    
    // 1. Check by Key Name
    if (k.includes('date')) return 'date';
    if (k.includes('color')) return 'color';
    
    // 2. Check by Value Type
    if (typeof value === 'boolean' || value === 'true' || value === 'false') return 'checkbox';
    
    // If it's a number (or a string that looks like one)
    if (!isNaN(value) && value.toString().trim() !== '') return 'number';
    
    return 'text';
}

export function initEditor() {
    window.addEventListener('open-editor', (e) => {
        const obj = e.detail;
        const modal = document.getElementById('editor-modal');
        
        // Ensure metadata is an object
        const meta = typeof obj.metadata === 'string' ? JSON.parse(obj.metadata) : obj.metadata;

        // Set Body
        document.getElementById('body-editor').value = obj.content;
        
        // Build Meta Form
        const formContainer = document.getElementById('metadata-form');
        formContainer.innerHTML = ''; 
        
        Object.keys(meta).forEach(key => {
            const val = meta[key];
            const type = getInputType(key, val);
            
            const div = document.createElement('div');
            div.className = 'form-row';
            
            let inputHtml = '';
            if (type === 'checkbox') {
                const isChecked = val === true || val === 'true';
                inputHtml = `<input type="checkbox" data-key="${key}" ${isChecked ? 'checked' : ''}>`;
            } else if (type === 'number') {
                // 'step="any"' allows decimals like 68.2
                inputHtml = `<input type="number" step="any" data-key="${key}" value="${val}">`;
            } else {
                inputHtml = `<input type="text" data-key="${key}" value="${val}">`;
            }

            div.innerHTML = `<label>${key}</label>${inputHtml}`;
            formContainer.appendChild(div);
        });

        const saveBtn = modal.querySelector('button[onclick="saveObject()"]');
        saveBtn.onclick = () => saveObject(obj.id);
        modal.style.display = 'block';
    });
}

async function saveObject(id) {
    const content = document.getElementById('body-editor').value;
    const inputs = document.querySelectorAll('#metadata-form input');
    
    const metadata = {};
    inputs.forEach(input => {
        const key = input.dataset.key;
        if (input.type === 'checkbox') {
            metadata[key] = input.checked;
        } else if (input.type === 'number') {
            metadata[key] = input.value.includes('.') ? parseFloat(input.value) : parseInt(input.value);
        } else {
            metadata[key] = input.value;
        }
    });

    const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content, metadata })
    });

    if (response.ok) {
        document.getElementById('editor-modal').style.display = 'none';
        // Force a reload to trigger the server-side re-index and refresh the UI
        window.location.reload(); 
    }
}

window.closeEditor = () => {
    document.getElementById('editor-modal').style.display = 'none';
};
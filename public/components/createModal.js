export class CreateModal extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Encapsulate styles
    }

    connectedCallback() {
        this.render();
    }

    show() {
        this.shadowRoot.getElementById('modal-overlay').style.display = 'flex';
        this.shadowRoot.getElementById('new-title').focus();
    }

    hide() {
        this.shadowRoot.getElementById('modal-overlay').style.display = 'none';
        this.shadowRoot.querySelectorAll('input').forEach(i => i.value = '');
    }

// Inside CreateModal.js -> handleSubmit()  
    async handleSubmit() {
        const title = this.shadowRoot.getElementById('new-title').value;
        const type = this.shadowRoot.getElementById('new-type').value;

        if (!title) return alert("Title is required");

        const response = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, type })
        });

        if (response.ok) {
            const result = await response.json(); // { success: true, id: "..." }
            this.hide();

            // This is the "Telegram" sent to the rest of the app
            this.dispatchEvent(new CustomEvent('object-created', { 
                detail: result, 
                bubbles: true, 
                composed: true // Required to cross the Shadow DOM boundary
            }));
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            #modal-overlay {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0; top: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.6);
                align-items: center; justify-content: center;
                font-family: sans-serif;
            }
            .content {
                background: white; padding: 2rem; border-radius: 12px;
                width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            }
            input { width: 100%; padding: 10px; margin: 10px 0; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
            button.primary { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; }
            button.secondary { width: 100%; background: none; border: none; color: #666; margin-top: 10px; cursor: pointer; }
        </style>
        <div id="modal-overlay">
            <div class="content">
                <h3>New Atomic Object</h3>
                <input type="text" id="new-title" placeholder="Title">
                <input type="text" id="new-type" value="note" placeholder="Type">
                <button class="primary" id="submit-btn">Create & Edit</button>
                <button class="secondary" id="cancel-btn">Cancel</button>
            </div>
        </div>
        `;

        this.shadowRoot.getElementById('submit-btn').onclick = () => this.handleSubmit();
        this.shadowRoot.getElementById('cancel-btn').onclick = () => this.hide();
    }
}

customElements.define('pkm-create-modal', CreateModal);
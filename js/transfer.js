const EDGE_FUNCTION_URL = 'https://xnwjvhbkzrazluihnzhw.supabase.co/functions/v1/transfer_memo';

const createTable = (data) => {
    if (!data || data.length === 0) {
        return '<p>No data available.</p>';
    }
    const headers = data[0];
    const rows = data.slice(1);

    let table = '<table class="transfer-table">';
    table += '<thead><tr>';
    headers.forEach(header => {
        table += `<th>${header}</th>`;
    });
    table += '</tr></thead>';
    table += '<tbody>';
    rows.forEach(row => {
        table += '<tr>';
        row.forEach(cell => {
            table += `<td>${cell}</td>`;
        });
        table += '</tr>';
    });
    table += '</tbody></table>';
    return table;
};

const fetchAndRenderTable = async (tabName, sheetName, container, supabaseClient) => {
    // Check if data has already been loaded
    if (container.dataset.loaded) {
        return;
    }

    container.innerHTML = '<p>Loading...</p>';

    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            throw sessionError;
        }

        if (!session) {
            throw new Error("User not authenticated.");
        }

        const accessToken = session.access_token;

        const response = await fetch(EDGE_FUNCTION_URL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const sheetData = result.data[sheetName];
        container.innerHTML = createTable(sheetData);
        container.dataset.loaded = true; // Mark as loaded
    } catch (error) {
        console.error(`Error fetching data for ${tabName}:`, error);
        container.innerHTML = `<p>Error loading data for ${tabName}. Please check the console for details.</p>`;
    }
};

class TransferFormManager {
    constructor(formId, supabaseClient) {
        this.form = document.getElementById(formId);
        this.supabaseClient = supabaseClient;
        this.dateInput = this.form.querySelector('input[type="date"]');
        this.productSearchInput = this.form.querySelector('input[id$="-product-search"]');
        this.suggestionsContainer = this.form.querySelector('.suggestions-container');
        this.itemCodeInput = this.form.querySelector('input[id$="-item-code"]');
        this.packingSizeInput = this.form.querySelector('input[id$="-packing-size"]');

        this.initialize();
        this.productSearchInput.addEventListener('input', (e) => this.onProductSearch(e.target.value));
        document.addEventListener('click', (e) => this.hideSuggestionsOnClickOutside(e));
    }

    initialize() {
        // Set default date to today
        this.dateInput.valueAsDate = new Date();
    }

    async onProductSearch(searchTerm) {
        if (searchTerm.length < 2) {
            this.hideSuggestions();
            return;
        }

        try {
            const { data, error } = await this.supabaseClient
                .from('products')
                .select('item_code, product_name, product_chinese_name, packing_size')
                .or(`product_name.ilike.%${searchTerm}%,item_code.ilike.%${searchTerm}%,product_chinese_name.ilike.%${searchTerm}%`)
                .limit(10);

            if (error) throw error;

            this.showProductSuggestions(data);
        } catch (error) {
            console.error('Error searching for products:', error);
        }
    }

    showProductSuggestions(products) {
        if (!products || products.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.suggestionsContainer.innerHTML = products.map(product => `
            <div class="suggestion-item" data-product='${JSON.stringify(product)}'>
                <strong>${product.item_code}</strong>
                <span>${product.product_name} (${product.product_chinese_name}) - ${product.packing_size}</span>
            </div>
        `).join('');

        this.suggestionsContainer.style.display = 'block';

        this.suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => this.onSuggestionClick(item));
        });
    }

    onSuggestionClick(item) {
        const product = JSON.parse(item.dataset.product);
        this.productSearchInput.value = `${product.product_name} (${product.product_chinese_name})`;
        this.itemCodeInput.value = product.item_code;
        this.packingSizeInput.value = product.packing_size;
        this.hideSuggestions();
    }

    hideSuggestions() {
        this.suggestionsContainer.style.display = 'none';
    }

    hideSuggestionsOnClickOutside(e) {
        if (!this.suggestionsContainer.contains(e.target) && e.target !== this.productSearchInput) {
            this.hideSuggestions();
        }
    }
}


window.loadTransferPage = (supabaseClient) => {
    const tabButtons = document.querySelectorAll('.transfer-tab-button');
    const tabPanes = document.querySelectorAll('.transfer-tab-pane');
    let goodsIssueFormManager, adjustmentFormManager;

    const initForms = (tab) => {
        if (tab === 'goods-issue' && !goodsIssueFormManager) {
            goodsIssueFormManager = new TransferFormManager('goods-issue-form', supabaseClient);
        } else if (tab === 'create-adjustment' && !adjustmentFormManager) {
            adjustmentFormManager = new TransferFormManager('adjustment-form', supabaseClient);
        }
    };

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const tab = button.getAttribute('data-tab');
            tabPanes.forEach(pane => {
                pane.classList.toggle('active', pane.id === tab);
            });

            if (tab === 'inventory-note') {
                const container = document.querySelector('#inventory-note-table');
                fetchAndRenderTable('Inventory Note', 'InventoryTranscationRecord', container, supabaseClient);
            } else if (tab === 'cr5-to-production') {
                const container = document.querySelector('#cr5-to-production-table');
                fetchAndRenderTable('CR5 to Production/Packing Room', 'CR5 transfer to PR', container, supabaseClient);
            }

            initForms(tab);
        });
    });

    // Initialize forms for the default active tab
    const activeTab = document.querySelector('.transfer-tab-button.active');
    if (activeTab) {
        const tabName = activeTab.getAttribute('data-tab');
        initForms(tabName);

        if (tabName === 'inventory-note') {
            const container = document.querySelector('#inventory-note-table');
            fetchAndRenderTable('Inventory Note', 'InventoryTranscationRecord', container, supabaseClient);
        } else if (tabName === 'cr5-to-production') {
            const container = document.querySelector('#cr5-to-production-table');
            fetchAndRenderTable('CR5 to Production/Packing Room', 'CR5 transfer to PR', container, supabaseClient);
        }
    }
};

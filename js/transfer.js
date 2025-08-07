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

        // Form Elements
        this.dateInput = this.form.querySelector('input[type="date"]');
        this.issueTypeSelect = this.form.querySelector('select[name="issue_type"]');
        this.productSearchInput = this.form.querySelector('input[id$="-product-search"]');
        this.itemCodeInput = this.form.querySelector('input[id$="-item-code"]');
        this.packingSizeInput = this.form.querySelector('input[id$="-packing-size"]');
        this.warehouseSelect = this.form.querySelector('select[name="warehouse_id"]');
        this.transferToWarehouseGroup = this.form.querySelector('[id$="-transfer-to-warehouse-group"]');
        this.batchNoInput = this.form.querySelector('input[id$="-batch-no"]');
        this.inventoryIdInput = this.form.querySelector('input[name="inventory_id"]');

        // Suggestion Containers
        this.productSuggestionsContainer = this.form.querySelector('[id$="-product-suggestions"]');
        this.batchSuggestionsContainer = this.form.querySelector('[id$="-batch-suggestions"]');

        this.initialize();
    }

    initialize() {
        // Set default date to today
        this.dateInput.valueAsDate = new Date();

        // Add event listeners
        this.productSearchInput.addEventListener('input', (e) => this.onProductSearch(e.target.value));

        if (this.issueTypeSelect) {
            this.issueTypeSelect.addEventListener('change', (e) => this.onIssueTypeChange(e.target.value));
            this.onIssueTypeChange(this.issueTypeSelect.value); // Initial check
        }

        this.batchNoInput.addEventListener('focus', () => this.onBatchSearch());

        document.addEventListener('click', (e) => {
            this.hideSuggestionsOnClickOutside(e, this.productSuggestionsContainer, this.productSearchInput);
            this.hideSuggestionsOnClickOutside(e, this.batchSuggestionsContainer, this.batchNoInput);
        });

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async onProductSearch(searchTerm) {
        if (searchTerm.length < 2) {
            this.hideSuggestions(this.productSuggestionsContainer);
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
            this.hideSuggestions(this.productSuggestionsContainer);
            return;
        }

        this.productSuggestionsContainer.innerHTML = products.map(product => `
            <div class="suggestion-item" data-product='${JSON.stringify(product)}'>
                <strong>${product.item_code}</strong>
                <span>${product.product_name} (${product.product_chinese_name}) - ${product.packing_size}</span>
            </div>
        `).join('');

        this.productSuggestionsContainer.style.display = 'block';

        this.productSuggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => this.onSuggestionClick(item));
        });
    }

    onSuggestionClick(item) {
        const product = JSON.parse(item.dataset.product);
        this.productSearchInput.value = `${product.product_name} (${product.product_chinese_name})`;
        this.itemCodeInput.value = product.item_code;
        this.packingSizeInput.value = product.packing_size;
        this.hideSuggestions(this.productSuggestionsContainer);
    }

    hideSuggestions(container) {
        if (container) {
            container.style.display = 'none';
        }
    }

    hideSuggestionsOnClickOutside(e, container, input) {
        if (container && !container.contains(e.target) && e.target !== input) {
            container.style.display = 'none';
        }
    }

    onIssueTypeChange(issueType) {
        const submitButton = this.form.querySelector('button[type="submit"]');

        if (this.transferToWarehouseGroup) {
            this.transferToWarehouseGroup.classList.toggle('hidden', issueType !== 'internal_transfer');
        }

        if (issueType === 'outbound') {
            this.batchNoInput.readOnly = false;
            submitButton.disabled = false;
        } else {
            this.batchNoInput.readOnly = true;
            this.hideSuggestions(this.batchSuggestionsContainer);
            submitButton.disabled = true;
        }
    }

    async onBatchSearch() {
        const issueType = this.issueTypeSelect ? this.issueTypeSelect.value : 'adjustment';
        if (issueType !== 'outbound') {
            this.hideSuggestions(this.batchSuggestionsContainer);
            return;
        }

        const itemCode = this.itemCodeInput.value;
        const warehouseId = this.warehouseSelect.value;

        if (!itemCode || !warehouseId) {
            console.warn("Please select a product and warehouse first.");
            return;
        }

        try {
            const { data, error } = await this.supabaseClient
                .from('inventory')
                .select('id, batch_no, quantity')
                .eq('item_code', itemCode)
                .eq('warehouse_id', warehouseId)
                .gt('quantity', 0)
                .limit(10);

            if (error) throw error;
            this.showBatchSuggestions(data);

        } catch (error) {
            console.error('Error searching for batches:', error);
        }
    }

    showBatchSuggestions(batches) {
        if (!batches || batches.length === 0) {
            this.hideSuggestions(this.batchSuggestionsContainer);
            return;
        }

        this.batchSuggestionsContainer.innerHTML = batches.map(batch => `
            <div class="suggestion-item" data-batch='${JSON.stringify(batch)}'>
                <strong>${batch.batch_no}</strong> (Qty: ${batch.quantity})
            </div>
        `).join('');

        this.batchSuggestionsContainer.style.display = 'block';

        this.batchSuggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const batch = JSON.parse(item.dataset.batch);
                this.batchNoInput.value = batch.batch_no;
                this.inventoryIdInput.value = batch.id; // Store the inventory ID
                this.hideSuggestions(this.batchSuggestionsContainer);
            });
        });
    }

    async handleSubmit(event) {
        event.preventDefault();
        const submitButton = this.form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        const formData = new FormData(this.form);
        const issueType = this.issueTypeSelect ? this.issueTypeSelect.value : 'adjustment';

        if (issueType !== 'outbound') {
            alert('This feature is currently only available for "Outbound" transactions.');
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';
            return;
        }

        try {
            const inventoryId = formData.get('inventory_id');
            const quantityToDeduct = parseFloat(formData.get('quantity'));

            if (!inventoryId || !quantityToDeduct || quantityToDeduct <= 0) {
                throw new Error("Invalid inventory ID or quantity.");
            }

            // 1. Get current quantity
            const { data: inventoryItem, error: fetchError } = await this.supabaseClient
                .from('inventory')
                .select('quantity')
                .eq('id', inventoryId)
                .single();

            if (fetchError) throw fetchError;
            if (!inventoryItem) throw new Error("Inventory item not found.");
            if (inventoryItem.quantity < quantityToDeduct) {
                throw new Error("Not enough stock for this transaction.");
            }

            // 2. Decrement inventory quantity
            const newQuantity = inventoryItem.quantity - quantityToDeduct;
            const { error: updateError } = await this.supabaseClient
                .from('inventory')
                .update({ quantity: newQuantity })
                .eq('id', inventoryId);

            if (updateError) throw updateError;

            // 3. Create transaction record
            const transactionData = {
                transaction_type: 'outbound',
                item_code: formData.get('item_code'),
                warehouse_id: formData.get('warehouse_id'),
                batch_no: formData.get('batch_no'),
                quantity: quantityToDeduct,
                transaction_date: formData.get('transaction_date'),
                note: formData.get('note'),
                inventory_id: inventoryId
            };

            const { error: insertError } = await this.supabaseClient
                .from('transactions')
                .insert([transactionData]);

            if (insertError) throw insertError;

            alert('Transaction successful!');
            this.form.reset();
            this.initialize(); // Reset date

        } catch (error) {
            console.error('Error submitting transaction:', error);
            alert(`Error: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';
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

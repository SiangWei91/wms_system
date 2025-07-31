window.loadPackagingMaterialPage = async (supabase) => {
    const tableBody = document.getElementById('inventory-table-body');
    const tabs = document.querySelectorAll('.tab-nav-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const fetchInventory = async () => {
        const { data, error } = await supabase
            .from('p_material')
            .select('name, packing_size, quantity, uom');

        if (error) {
            console.error('Error fetching inventory:', error);
            return [];
        }
        return data;
    };

    const renderInventoryTable = (inventory) => {
        tableBody.innerHTML = '';
        if (inventory.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">No data available</td></tr>';
            return;
        }

        inventory.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.packing_size || ''}</td>
                <td>${item.quantity}</td>
                <td>${item.uom}</td>
            `;
            tableBody.appendChild(row);
        });
    };

    const transactionTableBody = document.getElementById('transaction-table-body');

    const fetchTransactions = async () => {
        const { data, error } = await supabase
            .from('p_transaction')
            .select(`
                transaction_date,
                name,
                transaction_type,
                quantity,
                p_material (
                    packing_size,
                    uom
                )
            `)
            .order('transaction_date', { ascending: false });

        if (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
        return data;
    };

    const renderTransactionTable = (transactions) => {
        transactionTableBody.innerHTML = '';
        if (transactions.length === 0) {
            transactionTableBody.innerHTML = '<tr><td colspan="6">No transactions found</td></tr>';
            return;
        }

        transactions.forEach(tx => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${tx.transaction_date}</td>
                <td>${tx.name}</td>
                <td>${tx.p_material.packing_size || ''}</td>
                <td>${tx.transaction_type}</td>
                <td>${tx.quantity}</td>
                <td>${tx.p_material.uom}</td>
            `;
            transactionTableBody.appendChild(row);
        });
    };

    const switchTab = async (tabId) => {
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');

        tabs.forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.tab-nav-button[data-tab="${tabId}"]`).classList.add('active');

        if (tabId === 'transaction-record') {
            const transactions = await fetchTransactions();
            renderTransactionTable(transactions);
        }
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });

    // Modal logic
    const modal = document.getElementById('transaction-modal');
    const closeButton = document.querySelector('.close-button');
    const transactionForm = document.getElementById('transaction-form');
    const stockInBtn = document.getElementById('stock-in-btn');
    const stockOutBtn = document.getElementById('stock-out-btn');
    const transactionTypeInput = document.getElementById('transaction-type-input');

    const openModal = (item) => {
        document.getElementById('item-name').value = item.name;
        document.getElementById('packing-size').value = item.packing_size || '';
        document.getElementById('current-quantity').value = item.quantity;
        document.getElementById('uom').value = item.uom;
        modal.style.display = 'block';
    };

    const closeModal = () => {
        modal.style.display = 'none';
        transactionForm.reset();
        stockInBtn.classList.remove('active');
        stockOutBtn.classList.remove('active');
    };

    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeModal();
        }
    });

    tableBody.addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (!row) return;

        const name = row.cells[0].textContent;
        const packing_size = row.cells[1].textContent;
        const quantity = row.cells[2].textContent;
        const uom = row.cells[3].textContent;

        openModal({ name, packing_size, quantity, uom });
    });

    stockInBtn.addEventListener('click', () => {
        transactionTypeInput.value = 'Stock In';
        stockInBtn.classList.add('active');
        stockOutBtn.classList.remove('active');
    });

    stockOutBtn.addEventListener('click', () => {
        transactionTypeInput.value = 'Stock Out';
        stockOutBtn.classList.add('active');
        stockInBtn.classList.remove('active');
    });

    const updateInventoryQuantity = async (name, newQuantity) => {
        const { error } = await supabase
            .from('p_material')
            .update({ quantity: newQuantity })
            .eq('name', name);

        if (error) {
            console.error('Error updating quantity:', error);
            alert('Failed to update quantity.');
            return false;
        }
        return true;
    };

    const createTransaction = async (name, transactionType, quantity) => {
        const { error } = await supabase
            .from('p_transaction')
            .insert([{
                transaction_date: new Date().toISOString().split('T')[0],
                name: name,
                transaction_type: transactionType,
                quantity: quantity
            }]);

        if (error) {
            console.error('Error creating transaction:', error);
            alert('Failed to create transaction record.');
            return false;
        }
        return true;
    };

    transactionForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const name = document.getElementById('item-name').value;
        const transactionType = transactionTypeInput.value;
        const quantity = parseInt(document.getElementById('quantity').value, 10);
        const currentQuantity = parseInt(document.getElementById('current-quantity').value, 10);

        if (!transactionType) {
            alert('Please select a transaction type (Stock In or Stock Out).');
            return;
        }

        if (isNaN(quantity) || quantity <= 0) {
            alert('Please enter a valid quantity.');
            return;
        }

        let newQuantity;
        if (transactionType === 'Stock In') {
            newQuantity = currentQuantity + quantity;
        } else if (transactionType === 'Stock Out') {
            if (quantity > currentQuantity) {
                alert('Stock out quantity cannot be greater than current quantity.');
                return;
            }
            newQuantity = currentQuantity - quantity;
        }

        const quantityUpdated = await updateInventoryQuantity(name, newQuantity);
        if (quantityUpdated) {
            const transactionCreated = await createTransaction(name, transactionType, quantity);
            if (transactionCreated) {
                alert('Transaction successful!');
                closeModal();
                // Refresh inventory table
                inventory = await fetchInventory();
                renderInventoryTable(inventory);
            }
        }
    });


    // Initial load
    let inventory = await fetchInventory();
    renderInventoryTable(inventory);
    switchTab('inventory-summary'); // Ensure the first tab is active
};

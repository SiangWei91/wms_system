window.loadPackagingMaterialPage = async (supabase) => {
    const tableBody = document.getElementById('inventory-table-body');
    const tabs = document.querySelectorAll('.tab-nav-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const fetchInventory = async () => {
        const { data, error } = await supabase
            .from('p_material')
            .select('item_code, name, packing_size, quantity, uom')
            .order('index', { ascending: true });

        if (error) {
            console.error('Error fetching inventory:', error);
            return [];
        }
        return data;
    };

    const renderInventoryTable = (inventory) => {
        tableBody.innerHTML = '';
        if (inventory.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No data available</td></tr>';
            return;
        }

        inventory.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.item_code}</td>
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

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const renderTransactionTable = (transactions) => {
        transactionTableBody.innerHTML = '';
        if (transactions.length === 0) {
            transactionTableBody.innerHTML = '<tr><td colspan="6">No transactions found</td></tr>';
            return;
        }

        transactions.forEach(tx => {
            const row = document.createElement('tr');
            let quantityCell;
            let typeCellClass = '';

            switch (tx.transaction_type) {
                case 'Stock In':
                    typeCellClass = 'text-green';
                    quantityCell = `<td class="${typeCellClass}">+${tx.quantity}</td>`;
                    break;
                case 'Stock Out':
                    typeCellClass = 'text-red';
                    quantityCell = `<td class="${typeCellClass}">-${tx.quantity}</td>`;
                    break;
                default:
                    quantityCell = `<td>${tx.quantity}</td>`;
                    break;
            }

            row.innerHTML = `
                <td>${formatDate(tx.transaction_date)}</td>
                <td>${tx.name}</td>
                <td>${tx.p_material.packing_size || ''}</td>
                <td class="${typeCellClass}">${tx.transaction_type}</td>
                ${quantityCell}
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

    // Modal logic for both transaction and add product modals
    const transactionModal = document.getElementById('transaction-modal');
    const addProductModal = document.getElementById('add-product-modal');
    const closeButtons = document.querySelectorAll('.close-button');

    const openModal = (modal) => {
        modal.style.display = 'block';
    };

    const closeModal = (modal) => {
        modal.style.display = 'none';
    };

    closeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const modal = event.target.closest('.modal');
            closeModal(modal);
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target);
        }
    });

    // Transaction Modal specific logic
    const transactionForm = document.getElementById('transaction-form');
    const stockInBtn = document.getElementById('stock-in-btn');
    const stockOutBtn = document.getElementById('stock-out-btn');
    const transactionTypeInput = document.getElementById('transaction-type-input');

    const openTransactionModal = (item) => {
        document.getElementById('item-name').value = item.name;
        document.getElementById('packing-size').value = item.packing_size || '';
        document.getElementById('current-quantity').value = item.quantity;
        document.getElementById('uom').value = item.uom;
        openModal(transactionModal);
    };

    tableBody.addEventListener('click', (event) => {
        const row = event.target.closest('tr');
        if (!row) return;

        const item_code = row.cells[0].textContent;
        const name = row.cells[1].textContent;
        const packing_size = row.cells[2].textContent;
        const quantity = row.cells[3].textContent;
        const uom = row.cells[4].textContent;

        openTransactionModal({ item_code, name, packing_size, quantity, uom });
    });

    // Add Product Modal specific logic
    const addProductBtn = document.getElementById('add-product-btn');
    const addProductForm = document.getElementById('add-product-form');

    addProductBtn.addEventListener('click', () => {
        openModal(addProductModal);
    });

    const createProduct = async (product) => {
        const { error } = await supabase
            .from('p_material')
            .insert([product]);

        if (error) {
            console.error('Error creating product:', error);
            alert('Failed to create product.');
            return false;
        }
        return true;
    };

    const refreshInventory = async () => {
        inventory = await fetchInventory();
        renderInventoryTable(inventory);
        searchBar.value = ''; // Clear search bar
        // Also refresh transaction tab if it's active
        if (document.querySelector('.tab-nav-button[data-tab="transaction-record"]').classList.contains('active')) {
            const transactions = await fetchTransactions();
            renderTransactionTable(transactions);
        }
    };

    addProductForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newProduct = {
            item_code: document.getElementById('new-item-code').value,
            name: document.getElementById('new-name').value,
            category: document.getElementById('new-category').value,
            packing_size: document.getElementById('new-packing-size').value,
            quantity: parseInt(document.getElementById('new-quantity').value, 10),
            uom: document.getElementById('new-uom').value,
            location: document.getElementById('new-location').value
        };

        if (isNaN(newProduct.quantity)) {
            alert('Please enter a valid quantity.');
            return;
        }

        const productCreated = await createProduct(newProduct);
        if (productCreated) {
            alert('Product added successfully!');
            addProductForm.reset();
            closeModal(addProductModal);
            await refreshInventory();
        }
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

    const createTransaction = async (name, transactionType, quantity, date) => {
        const transactionDate = date || new Date().toISOString().split('T')[0];
        const { error } = await supabase
            .from('p_transaction')
            .insert([{
                transaction_date: transactionDate,
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
        const transactionDate = document.getElementById('transaction-date').value;

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
            const transactionCreated = await createTransaction(name, transactionType, quantity, transactionDate);
            if (transactionCreated) {
                alert('Transaction successful!');
                transactionForm.reset();
                stockInBtn.classList.remove('active');
                stockOutBtn.classList.remove('active');
                closeModal(transactionModal);
                await refreshInventory();
            }
        }
    });


    // Search functionality
    const searchBar = document.getElementById('search-bar');
    searchBar.addEventListener('keyup', () => {
        const searchTerm = searchBar.value.toLowerCase();
        const filteredInventory = inventory.filter(item => {
            const name = item.name || '';
            const itemCode = item.item_code || '';
            return (
                name.toLowerCase().includes(searchTerm) ||
                itemCode.toLowerCase().includes(searchTerm)
            );
        });
        renderInventoryTable(filteredInventory);
    });

    // Initial load
    let inventory = await fetchInventory();
    renderInventoryTable(inventory);
    switchTab('inventory-summary'); // Ensure the first tab is active
};

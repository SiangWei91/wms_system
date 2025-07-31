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
                <td>${item.item_code || ''}</td>
                <td>${item.name || ''}</td>
                <td>${item.packing_size || ''}</td>
                <td>${item.quantity || 0}</td>
                <td>${item.uom || ''}</td>
            `;
            tableBody.appendChild(row);
        });
    };

    const transactionTableBody = document.getElementById('transaction-table-body');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');

    let currentPage = 0;
    const rowsPerPage = 15;
    let totalTransactions = 0;

    const fetchTransactions = async (page = 0) => {
        const from = page * rowsPerPage;
        const to = from + rowsPerPage - 1;

        const { data, error, count } = await supabase
            .from('p_transaction')
            .select(`
                id,
                transaction_date,
                name,
                transaction_type,
                quantity,
                system_quantity,
                actual_quantity,
                p_material (
                    packing_size,
                    uom
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Error fetching transactions:', error);
            return { data: [], count: 0 };
        }
        return { data, count };
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const adjustmentTableBody = document.getElementById('adjustment-table-body');

    const renderAdjustmentTable = (inventory) => {
        adjustmentTableBody.innerHTML = '';
        if (inventory.length === 0) {
            adjustmentTableBody.innerHTML = '<tr><td colspan="6">No data available</td></tr>';
            return;
        }

        inventory.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.name = item.name;
            row.dataset.quantity = item.quantity;
            row.innerHTML = `
                <td>${item.item_code || ''}</td>
                <td>${item.name || ''}</td>
                <td>${item.packing_size || ''}</td>
                <td>${item.quantity || 0}</td>
                <td>${item.uom || ''}</td>
                <td><input type="number" class="actual-value-input"></td>
            `;
            adjustmentTableBody.appendChild(row);
        });
    };

    const renderTransactionTable = (transactions, count) => {
        transactionTableBody.innerHTML = '';
        totalTransactions = count;

        if (transactions.length === 0) {
            transactionTableBody.innerHTML = '<tr><td colspan="7">No transactions found</td></tr>';
            pageInfo.textContent = '';
            prevPageBtn.disabled = true;
            nextPageBtn.disabled = true;
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
                default: // Handles 'Adjustment' and any other types
                    if (tx.transaction_type === 'Adjustment') {
                        quantityCell = `<td>${tx.system_quantity} → ${tx.actual_quantity}</td>`;
                    } else {
                        quantityCell = `<td>${tx.quantity}</td>`;
                    }
                    break;
            }

            const deleteButtonCell = tx.transaction_type !== 'Adjustment'
                ? `<td><button class="delete-btn" data-id="${tx.id}" data-name="${tx.name}" data-type="${tx.transaction_type}" data-quantity="${tx.quantity}">&times;</button></td>`
                : '<td></td>';

            row.innerHTML = `
                <td>${formatDate(tx.transaction_date)}</td>
                <td>${tx.name}</td>
                <td>${tx.p_material.packing_size || ''}</td>
                <td class="${typeCellClass}">${tx.transaction_type}</td>
                ${quantityCell}
                <td>${tx.p_material.uom}</td>
                ${deleteButtonCell}
            `;
            transactionTableBody.appendChild(row);
        });

        const totalPages = Math.ceil(totalTransactions / rowsPerPage);
        pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 0;
        nextPageBtn.disabled = currentPage >= totalPages - 1;
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
            currentPage = 0;
            const { data, count } = await fetchTransactions(currentPage);
            renderTransactionTable(data, count);
        } else if (tabId === 'adjustment') {
            const inventory = await fetchInventory();
            renderAdjustmentTable(inventory);
        }
    };

    prevPageBtn.addEventListener('click', async () => {
        if (currentPage > 0) {
            currentPage--;
            const { data, count } = await fetchTransactions(currentPage);
            renderTransactionTable(data, count);
        }
    });

    nextPageBtn.addEventListener('click', async () => {
        const totalPages = Math.ceil(totalTransactions / rowsPerPage);
        if (currentPage < totalPages - 1) {
            currentPage++;
            const { data, count } = await fetchTransactions(currentPage);
            renderTransactionTable(data, count);
        }
    });

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
        // Reset form before populating
        transactionForm.reset();
        stockInBtn.classList.remove('active');
        stockOutBtn.classList.remove('active');

        document.getElementById('item-name').value = item.name;
        document.getElementById('packing-size').value = item.packing_size || '';
        document.getElementById('current-quantity').value = item.quantity;
        document.getElementById('uom').value = item.uom;

        // Set defaults
        document.getElementById('transaction-date').valueAsDate = new Date();
        stockOutBtn.click(); // Default to stock out

        openModal(transactionModal);

        // Focus on quantity input
        setTimeout(() => {
            document.getElementById('quantity').focus();
        }, 100); // Timeout to ensure modal is visible
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

    const deleteTransaction = async (id) => {
        const { error } = await supabase
            .from('p_transaction')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting transaction:', error);
            alert('Failed to delete transaction.');
            return false;
        }
        return true;
    };

    transactionTableBody.addEventListener('click', async (event) => {
        if (!event.target.classList.contains('delete-btn')) {
            return;
        }

        const button = event.target;
        const id = button.dataset.id;
        const name = button.dataset.name;
        const type = button.dataset.type;
        const quantity = parseInt(button.dataset.quantity, 10);

        const { data: material, error: materialError } = await supabase
            .from('p_material')
            .select('quantity')
            .eq('name', name)
            .single();

        if (materialError) {
            console.error('Error fetching material quantity:', materialError);
            alert('Could not fetch material details to revert stock.');
            return;
        }

        let revertedQuantity;
        if (type === 'Stock In') {
            revertedQuantity = material.quantity - quantity;
        } else if (type === 'Stock Out') {
            revertedQuantity = material.quantity + quantity;
        } else {
            return; // Do nothing for other types
        }

        const quantityUpdated = await updateInventoryQuantity(name, revertedQuantity);
        if (quantityUpdated) {
            const transactionDeleted = await deleteTransaction(id);
            if (transactionDeleted) {
                currentPage = 0; // Reset to first page
                await refreshInventory();
            }
        }
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
            const { data, count } = await fetchTransactions(currentPage);
            renderTransactionTable(data, count);
        }
    };

    addProductForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Get the last index
        const { data: lastProduct, error: lastProductError } = await supabase
            .from('p_material')
            .select('index')
            .order('index', { ascending: false })
            .limit(1)
            .single();

        if (lastProductError && lastProductError.code !== 'PGRST116') { // Ignore 'exact one row' error if table is empty
            console.error('Error fetching last index:', lastProductError);
            alert('Could not determine new product index.');
            return;
        }

        const newIndex = lastProduct ? lastProduct.index + 1 : 1;

        const newProduct = {
            item_code: document.getElementById('new-item-code').value,
            name: document.getElementById('new-name').value,
            category: document.getElementById('new-category').value,
            packing_size: document.getElementById('new-packing-size').value,
            quantity: parseInt(document.getElementById('new-quantity').value, 10),
            uom: document.getElementById('new-uom').value,
            location: document.getElementById('new-location').value,
            index: newIndex
        };

        if (isNaN(newProduct.quantity)) {
            alert('Please enter a valid quantity.');
            return;
        }

        const productCreated = await createProduct(newProduct);
        if (productCreated) {
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

    const createTransaction = async (transactionData) => {
        const payload = {
            transaction_date: transactionData.date || new Date().toISOString().split('T')[0],
            name: transactionData.name,
            transaction_type: transactionData.transaction_type,
            quantity: transactionData.quantity
        };

        if (transactionData.transaction_type === 'Adjustment') {
            payload.system_quantity = transactionData.system_quantity;
            payload.actual_quantity = transactionData.actual_quantity;
        }

        const { error } = await supabase
            .from('p_transaction')
            .insert([payload]);

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
            const transactionCreated = await createTransaction({ name, transaction_type: transactionType, quantity, date: transactionDate });
            if (transactionCreated) {
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

    const adjustBtn = document.getElementById('adjust-btn');
    adjustBtn.addEventListener('click', async () => {
        const updates = [];
        const transactions = [];
        const rows = adjustmentTableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const input = row.querySelector('.actual-value-input');
            const actualValue = input.value;

            if (actualValue !== '') {
                const name = row.dataset.name;
                const oldQuantity = parseInt(row.dataset.quantity, 10);
                const newQuantity = parseInt(actualValue, 10);

                if (oldQuantity !== newQuantity) {
                    updates.push({ name: name, quantity: newQuantity });
                    transactions.push({
                        name: name,
                        transaction_type: 'Adjustment',
                        quantity: newQuantity - oldQuantity,
                        system_quantity: oldQuantity,
                        actual_quantity: newQuantity,
                        date: new Date().toISOString().split('T')[0]
                    });
                }
            }
        });

        if (updates.length > 0) {
            const updatePromises = updates.map(u => updateInventoryQuantity(u.name, u.quantity));
            const transactionPromises = transactions.map(t => createTransaction(t));

            const updateResults = await Promise.all(updatePromises);
            const transactionResults = await Promise.all(transactionPromises);

            if (updateResults.includes(false) || transactionResults.includes(false)) {
                alert('One or more adjustments failed. Please check the console for details.');
            } else {
                alert('Adjustments successful!');
                await refreshInventory();
                // After refresh, switch back to the adjustment tab to see the changes
                await switchTab('adjustment');
            }
        }
    });
};

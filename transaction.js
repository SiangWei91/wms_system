// State variables for pagination
let transactionFetchController = null;
const TRANSACTIONS_PER_PAGE = 15;
let transactionCurrentPageNum = 1;
let transactionTotalNumPages = 1;
let transactionTotalNumItems = 0;
let transactionGlobalHasNextPage = false;

window.loadTransactions = async function(contentElement, supabase) {
    if (!contentElement) {
        console.error("Content element not found. Cannot load transactions page.");
        return;
    }

    contentElement.innerHTML = `
        <div class="transactions">
            <div class="page-header">
                <h1>Transaction List</h1>
            </div>
            <div class="search-container" style="margin-bottom: 20px;">
                <form id="transaction-search-form" class="modern-filters">
                    <div class="form-group">
                        <label for="start-date">Start Date</label>
                        <input type="date" id="start-date" name="start-date">
                    </div>
                    <div class="form-group">
                        <label for="end-date">End Date</label>
                        <input type="date" id="end-date" name="end-date">
                    </div>
                    <div class="form-group">
                        <label for="warehouse">Warehouse</label>
                        <select id="warehouse" name="warehouse">
                            <option value="">All</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="transaction-type">Transaction Type</label>
                        <select id="transaction-type" name="transaction-type">
                            <option value="">All</option>
                            <option value="inbound">Inbound</option>
                            <option value="outbound">Outbound</option>
                            <option value="internal_transfer">Internal Transfer</option>
                            <option value="to_production">To Production</option>
                            <option value="from_production">From Production</option>
                            <option value="adjustment">Adjustment</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="product-search">Product</label>
                        <input type="text" id="product-search" name="product-search" placeholder="Code or Name" list="product-list">
                        <datalist id="product-list"></datalist>
                    </div>
                    <div class="form-group">
                        <label for="operator">Operator</label>
                        <select id="operator" name="operator">
                            <option value="">All</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Search</button>
                    <button type="reset" class="btn btn-secondary">Reset</button>
                </form>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Transaction Date</th>
                            <th>Item Code</th>
                            <th>Product Description</th>
                            <th>Warehouse</th>
                            <th>Quantity</th>
                            <th>Operator</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="transactions-table-body">
                    </tbody>
                </table>
                <div class="pagination" id="pagination">
                </div>
            </div>
        </div>
    `;

    transactionCurrentPageNum = 1;
    await fetchTransactions({ page: transactionCurrentPageNum }, supabase);
    await populateFilterOptions(supabase);

    const searchForm = document.getElementById('transaction-search-form');
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(searchForm);
        const searchParams = {
            start_date: formData.get('start-date'),
            end_date: formData.get('end-date'),
            warehouse_id: formData.get('warehouse'),
            product_search: formData.get('product-search'),
            operator_id: formData.get('operator'),
            transaction_type: formData.get('transaction-type'),
        };
        transactionCurrentPageNum = 1;
        fetchTransactions({ page: transactionCurrentPageNum, searchParams }, supabase);
    });

    searchForm.addEventListener('reset', () => {
        transactionCurrentPageNum = 1;
        fetchTransactions({ page: transactionCurrentPageNum }, supabase);
    });

    const tableBody = document.getElementById('transactions-table-body');
    tableBody.addEventListener('click', (e) => {
        const button = e.target.closest('.delete-btn');
        if (button) {
            const transactionId = button.dataset.id;
            const inventoryId = button.dataset.inventoryId;
            const destInventoryId = button.dataset.destInventoryId;
            const quantity = parseInt(button.dataset.quantity, 10);
            const type = button.dataset.type;

            if (confirm(`Are you sure you want to delete this transaction? This will also update the inventory.`)) {
                deleteTransaction(transactionId, inventoryId, destInventoryId, quantity, type, supabase);
            }
        }
    });
}

async function populateFilterOptions(supabase) {
    try {
        const { data: warehouses, error: warehouseError } = await supabase.from('warehouses').select('warehouse_id, name');
        if (warehouseError) throw warehouseError;

        const warehouseSelect = document.getElementById('warehouse');
        warehouses.forEach(w => {
            const option = document.createElement('option');
            option.value = w.warehouse_id;
            option.textContent = w.name;
            warehouseSelect.appendChild(option);
        });

        const { data: transactions, error: transactionError } = await supabase.from('transactions').select('operator_id');
        if (transactionError) throw transactionError;

        const operatorSelect = document.getElementById('operator');
        const uniqueOperators = [...new Set(transactions.map(t => t.operator_id).filter(id => id))];

        uniqueOperators.forEach(opId => {
            const option = document.createElement('option');
            option.value = opId;
            option.textContent = opId;
            operatorSelect.appendChild(option);
        });

        const { data: products, error: productError } = await supabase.from('products').select('item_code, product_name');
        if (productError) throw productError;

        const productList = document.getElementById('product-list');
        const productSearch = document.getElementById('product-search');
        let allProducts = products;

        productSearch.addEventListener('input', () => {
            const searchTerm = productSearch.value.toLowerCase();
            productList.innerHTML = '';
            const filteredProducts = allProducts.filter(p =>
                p.item_code.toLowerCase().includes(searchTerm) ||
                p.product_name.toLowerCase().includes(searchTerm)
            );
            filteredProducts.forEach(p => {
                const option = document.createElement('option');
                option.value = `${p.item_code} - ${p.product_name}`;
                productList.appendChild(option);
            });
        });


    } catch (error) {
        console.error('Failed to populate filter options:', error);
    }
}

async function fetchTransactions({ page = 1, searchParams = {} }, supabase) {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) {
        console.error("Transactions table body not found. Cannot fetch transactions.");
        return;
    }
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">Loading transactions...</td></tr>`;

    if (transactionFetchController) {
        transactionFetchController.abort();
    }
    transactionFetchController = new AbortController();
    const signal = transactionFetchController.signal;

    try {
        let query = supabase
            .from('transactions')
            .select(`
                *,
                products (
                    product_name
                )
            `, { count: 'exact' });

        if (searchParams.start_date && searchParams.end_date) {
            query = query.gte('transaction_date', searchParams.start_date);
            query = query.lte('transaction_date', searchParams.end_date);
        } else if (searchParams.start_date) {
            query = query.eq('transaction_date', searchParams.start_date);
        } else if (searchParams.end_date) {
            query = query.eq('transaction_date', searchParams.end_date);
        }
        if (searchParams.warehouse_id) {
            query = query.eq('warehouse_id', searchParams.warehouse_id);
        }
        if (searchParams.operator_id) {
            query = query.eq('operator_id', searchParams.operator_id);
        }
        if (searchParams.transaction_type) {
            query = query.eq('transaction_type', searchParams.transaction_type);
        }
        if (searchParams.product_search) {
            const productSearchTerm = searchParams.product_search;
            const productCode = productSearchTerm.split(' - ')[0];

            let { data: products, error: productError } = await supabase
                .from('products')
                .select('item_code')
                .or(`item_code.ilike.%${productCode}%,product_name.ilike.%${productSearchTerm}%`);

            if (productError) {
                throw productError;
            }

            if (products && products.length > 0) {
                const itemCodes = products.map(p => p.item_code);
                query = query.in('item_code', itemCodes);
            } else {
                // If no product is found, return an empty result
                query = query.eq('item_code', '---'); // This will likely return no results
            }
        }

        const { data: transactions, error, count } = await query
            .order('created_at', { ascending: false })
            .range((page - 1) * TRANSACTIONS_PER_PAGE, page * TRANSACTIONS_PER_PAGE - 1);

        if (signal.aborted) {
            console.log("Transaction fetch aborted");
            return;
        }

        if (error) {
            throw error;
        }

        const warehouseIds = [...new Set(transactions.map(t => t.warehouse_id).concat(transactions.map(t => t.source_warehouse_id)).concat(transactions.map(t => t.destination_warehouse_id)))].filter(id => id);
        const { data: warehouses, error: warehouseError } = await supabase
            .from('warehouses')
            .select('warehouse_id, name')
            .in('warehouse_id', warehouseIds);

        if (warehouseError) {
            throw warehouseError;
        }

        const warehouseMap = warehouses.reduce((acc, w) => {
            acc[w.warehouse_id] = w.name;
            return acc;
        }, {});

        renderTransactionsTable(transactions, warehouseMap);

        transactionTotalNumItems = count;
        transactionTotalNumPages = Math.ceil(transactionTotalNumItems / TRANSACTIONS_PER_PAGE);
        transactionCurrentPageNum = page;
        transactionGlobalHasNextPage = page < transactionTotalNumPages;

        renderPagination(supabase);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted by user.');
        } else {
            console.error('Failed to fetch transaction list:', error);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading transactions: ${escapeHtml(error.message)}</td></tr>`;
            const paginationDiv = document.getElementById('pagination');
            if (paginationDiv) {
                paginationDiv.innerHTML = '<p class="text-danger text-center">Pagination unavailable.</p>';
            }
        }
    } finally {
        transactionFetchController = null;
    }
}

function renderTransactionsTable(transactions, warehouseMap) {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data text-center">
                    No transactions found.
                </td>
            </tr>
        `;
        return;
    }

    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        const productName = transaction.products ? transaction.products.product_name : 'N/A';

        let warehouseDisplay = '';
        if (transaction.transaction_type === 'internal_transfer') {
            const sourceName = warehouseMap[transaction.warehouse_id] || transaction.warehouse_id;
            const destName = warehouseMap[transaction.destination_warehouse_id] || transaction.destination_warehouse_id;
            warehouseDisplay = `${escapeHtml(sourceName)} <i class="fas fa-arrow-right"></i> ${escapeHtml(destName)}`;
        } else {
            warehouseDisplay = escapeHtml(warehouseMap[transaction.warehouse_id] || transaction.warehouse_id);
        }

        let quantityDisplay = '';
        switch (transaction.transaction_type) {
            case 'inbound':
                quantityDisplay = `<span class="text-success fw-bold">+${escapeHtml(transaction.quantity)}</span>`;
                break;
            case 'outbound':
                quantityDisplay = `<span class="text-danger fw-bold">-${escapeHtml(transaction.quantity)}</span>`;
                break;
            default:
                quantityDisplay = escapeHtml(transaction.quantity);
        }

        const date = new Date(transaction.transaction_date);
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

        row.innerHTML = `
            <td>${escapeHtml(formattedDate)}</td>
            <td>${escapeHtml(transaction.item_code || '')}</td>
            <td>${escapeHtml(productName)}</td>
            <td>${warehouseDisplay}</td>
            <td>${quantityDisplay}</td>
            <td>${escapeHtml(transaction.operator_id || '')}</td>
            <td class="actions">
                <button class="btn-icon delete-btn" data-id="${transaction.id}" data-inventory-id="${transaction.inventory_id}" data-dest-inventory-id="${transaction.destination_inventory_id}" data-quantity="${transaction.quantity}" data-type="${transaction.transaction_type}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderPagination(supabase) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;
    paginationDiv.innerHTML = '';

    if (transactionTotalNumItems === 0) return;
    if (transactionTotalNumPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn-pagination';
    prevBtn.disabled = transactionCurrentPageNum <= 1;
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
    prevBtn.addEventListener('click', () => {
        if (transactionCurrentPageNum > 1) {
            fetchTransactions({ page: transactionCurrentPageNum - 1 }, supabase);
        }
    });
    paginationDiv.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Page ${transactionCurrentPageNum} of ${transactionTotalNumPages} (${transactionTotalNumItems} items)`;
    paginationDiv.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-pagination';
    nextBtn.disabled = !transactionGlobalHasNextPage;
    nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
    nextBtn.addEventListener('click', () => {
        if (transactionGlobalHasNextPage) {
            fetchTransactions({ page: transactionCurrentPageNum + 1 }, supabase);
        }
    });
    paginationDiv.appendChild(nextBtn);
}

async function deleteTransaction(transactionId, inventoryId, destInventoryId, quantity, type, supabase) {
    try {
        const { data: transaction, error: fetchTransactionError } = await supabase.from('transactions').select('inventory_details, warehouse_id').eq('id', transactionId).single();
        if (fetchTransactionError) throw fetchTransactionError;

        const { error: deleteError } = await supabase.from('transactions').delete().match({ id: transactionId });
        if (deleteError) throw deleteError;

        const palletWarehouses = ['jordon', 'lineage', 'singlong'];

        if (type === 'inbound') {
            const { data: inventory, error: fetchError } = await supabase.from('inventory').select('quantity').eq('id', inventoryId).single();
            if(fetchError) throw fetchError;
            const newQuantity = inventory.quantity - quantity;
            const { error: updateError } = await supabase.from('inventory').update({ quantity: newQuantity }).eq('id', inventoryId);
            if (updateError) throw updateError;
        } else if (type === 'outbound') {
            const { data: inventory, error: fetchError } = await supabase.from('inventory').select('quantity').eq('id', inventoryId).single();
            if(fetchError) throw fetchError;
            const newQuantity = inventory.quantity + quantity;
            const { error: updateError } = await supabase.from('inventory').update({ quantity: newQuantity }).eq('id', inventoryId);
            if (updateError) throw updateError;
        } else if (type === 'internal_transfer') {
            const pallet = transaction.inventory_details ? transaction.inventory_details.pallet : null;

            // Add to source
            const { data: sourceInventory, error: sourceFetchError } = await supabase.from('inventory').select('quantity, details').eq('id', inventoryId).single();
            if(sourceFetchError) throw sourceFetchError;
            const newSourceQuantity = sourceInventory.quantity + quantity;
            let newSourceInventoryDetails = sourceInventory.details;
            if (pallet && palletWarehouses.includes(transaction.warehouse_id)) {
                newSourceInventoryDetails = { ...sourceInventory.details, pallet: sourceInventory.details.pallet ? `${sourceInventory.details.pallet},${pallet}` : pallet };
            }
            const { error: sourceUpdateError } = await supabase.from('inventory').update({ quantity: newSourceQuantity, details: newSourceInventoryDetails }).eq('id', inventoryId);
            if (sourceUpdateError) throw sourceUpdateError;

            // Subtract from destination
            const { data: destInventory, error: destFetchError } = await supabase.from('inventory').select('quantity, details').eq('id', destInventoryId).single();
            if(destFetchError) throw destFetchError;
            const newDestQuantity = destInventory.quantity - quantity;
            let newDestInventoryDetails = destInventory.details;
            if (pallet && palletWarehouses.includes(transaction.warehouse_id) && destInventory.details && typeof destInventory.details.pallet === 'string') {
                const destPallets = destInventory.details.pallet.split(',');
                const newDestPallets = destPallets.filter(p => p !== pallet);
                newDestInventoryDetails = { ...destInventory.details, pallet: newDestPallets.join(',') };
            }
            const { error: destUpdateError } = await supabase.from('inventory').update({ quantity: newDestQuantity, details: newDestInventoryDetails }).eq('id', destInventoryId);
            if (destUpdateError) throw destUpdateError;
        }

        alert('Transaction deleted and inventory updated successfully!');
        fetchTransactions({ page: transactionCurrentPageNum }, supabase);

    } catch (error) {
        console.error('Failed to delete transaction:', error);
        alert('Failed to delete transaction: ' + error.message);
    }
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

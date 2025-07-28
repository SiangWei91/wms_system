// State variables for pagination
let transactionFetchController = null;
const TRANSACTIONS_PER_PAGE = 15;
let currentPageNum = 1;
let totalNumPages = 1;
let totalNumItems = 0;
let globalHasNextPage = false;

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

    currentPageNum = 1;
    await fetchTransactions({ page: currentPageNum }, supabase);
}

async function fetchTransactions({ page = 1 }, supabase) {
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
        const { data: transactions, error, count } = await supabase
            .from('transactions')
            .select(`
                *,
                products (
                    product_name
                )
            `, { count: 'exact' })
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

        totalNumItems = count;
        totalNumPages = Math.ceil(totalNumItems / TRANSACTIONS_PER_PAGE);
        currentPageNum = page;
        globalHasNextPage = page < totalNumPages;

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
            const sourceName = warehouseMap[transaction.source_warehouse_id] || transaction.source_warehouse_id;
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

        row.innerHTML = `
            <td>${escapeHtml(new Date(transaction.transaction_date).toLocaleDateString())}</td>
            <td>${escapeHtml(transaction.item_code || '')}</td>
            <td>${escapeHtml(productName)}</td>
            <td>${warehouseDisplay}</td>
            <td>${quantityDisplay}</td>
            <td>${escapeHtml(transaction.operator_id || '')}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderPagination(supabase) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;
    paginationDiv.innerHTML = '';

    if (totalNumItems === 0) return;
    if (totalNumPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn-pagination';
    prevBtn.disabled = currentPageNum <= 1;
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
    prevBtn.addEventListener('click', () => {
        if (currentPageNum > 1) {
            fetchTransactions({ page: currentPageNum - 1 }, supabase);
        }
    });
    paginationDiv.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Page ${currentPageNum} of ${totalNumPages} (${totalNumItems} items)`;
    paginationDiv.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-pagination';
    nextBtn.disabled = !globalHasNextPage;
    nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
    nextBtn.addEventListener('click', () => {
        if (globalHasNextPage) {
            fetchTransactions({ page: currentPageNum + 1 }, supabase);
        }
    });
    paginationDiv.appendChild(nextBtn);
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

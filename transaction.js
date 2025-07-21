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
                            <th>Item Code</th>
                            <th>Product Description</th>
                            <th>Warehouse</th>
                            <th>Batch No</th>
                            <th>Operator</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody id="transactions-table-body">
                    </tbody>
                </table>
            </div>
        </div>
    `;

    await fetchTransactions(supabase);
}

async function fetchTransactions(supabase) {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) {
        console.error("Transactions table body not found. Cannot fetch transactions.");
        return;
    }
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">Loading transactions...</td></tr>`;

    try {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select(`
                *,
                products (
                    product_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        renderTransactionsTable(transactions);

    } catch (error) {
        console.error('Failed to fetch transaction list:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading transactions: ${escapeHtml(error.message)}</td></tr>`;
    }
}

function renderTransactionsTable(transactions) {
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
        row.innerHTML = `
            <td>${escapeHtml(transaction.item_code || '')}</td>
            <td>${escapeHtml(productName)}</td>
            <td>${escapeHtml(transaction.warehouse_id || '')}</td>
            <td>${escapeHtml(transaction.batch_no || '')}</td>
            <td>${escapeHtml(transaction.operator_id || '')}</td>
            <td>${escapeHtml(transaction.quantity || '')}</td>
        `;
        tbody.appendChild(row);
    });
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

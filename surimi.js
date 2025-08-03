// Mock data
let inventory = {
    mainWarehouse: {},
    defrostRoom: {},
    publicWarehouse: {}
};

async function fetchInventoryData(supabaseClient) {
    // Step 1: Fetch item_codes for products of type 'surimi'
    const { data: productsData, error: productsError } = await supabaseClient
        .from('products')
        .select('item_code')
        .eq('type', 'surimi');

    if (productsError) {
        console.error('Error fetching surimi products:', productsError);
        return [];
    }

    const surimiItemCodes = productsData.map(p => p.item_code);

    // Step 2: Fetch inventory data for the surimi products in the specified warehouse
    const { data: inventoryData, error: inventoryError } = await supabaseClient
        .from('inventory')
        .select(`
            quantity,
            batch_no,
            products (
                product_name,
                type
            )
        `)
        .eq('warehouse_id', 'coldroom5')
        .in('item_code', surimiItemCodes);

    if (inventoryError) {
        console.error('Error fetching inventory data:', inventoryError);
        return [];
    }

    return inventoryData;
}

let activeProducts = new Set(Object.keys(inventory.defrostRoom));
let dailyRecords = {};

// Update time
function updateTime() {
    document.getElementById('currentTime').textContent = '';
}

// Update status indicator
function updateStatusIndicator() {
    const indicator = document.getElementById('statusIndicator');
    indicator.textContent = '';
}

// Toggle section visibility
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const content = section.querySelector('div:not(h3)');
    const button = section.querySelector('button:not(.btn)');

    if (section.style.opacity === '0.3') {
        section.style.opacity = '1';
        content.style.display = 'block';
        button.textContent = '×';
        button.title = 'Hide this section';
    } else {
        section.style.opacity = '0.3';
        content.style.display = 'none';
        button.textContent = '+';
        button.title = 'Show this section';
    }
}

// Switch tabs
function showTab(tabName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected section and tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');

    // Update inventory display if inventory tab
    if (tabName === 'inventory') {
        updateInventoryDisplay();
    }
}

// Remove product from active list
function removeProduct(product) {
    activeProducts.delete(product);
    initializeForms();
}

// Initialize forms
async function initializeForms(supabaseClient) {
    const inventoryData = await fetchInventoryData(supabaseClient);

    inventory.mainWarehouse = {};
    inventory.defrostRoom = {};

    inventoryData.forEach(item => {
        if (item.products) {
            const productName = item.products.product_name;
            inventory.mainWarehouse[productName] = item.quantity;
            inventory.defrostRoom[productName] = 0;
        }
    });

    activeProducts = new Set(Object.keys(inventory.defrostRoom));
    const products = Array.from(activeProducts);

    // Initialize main warehouse transfer form
    let transferHTML = '<div class="form-row transfer-row" style="background: #e3f2fd; font-weight: bold;"><div>Product Name</div><div>Main Stock</div><div>Batch Number</div><div>Transfer Qty</div><div>Current Defrost</div><div>Action</div></div>';
    products.forEach(productName => {
        const item = inventoryData.find(i => i.products && i.products.product_name === productName);
        if (item) {
            transferHTML += `
                <div class="form-row transfer-row">
                    <div class="product-name">${productName}</div>
                    <div>${inventory.mainWarehouse[productName]}</div>
                    <input type="text" id="batch_transfer_${productName}" value="${item.batch_no}" readonly>
                    <input type="number" id="transfer_${productName}" value="${inventory.mainWarehouse[productName]}" min="0" max="${inventory.mainWarehouse[productName]}" style="border: none;">
                    <div class="zero-stock">${inventory.defrostRoom[productName]}</div>
                    <button class="remove-btn" onclick="removeProduct('${productName}')" title="Remove this product">×</button>
                </div>
            `;
        }
    });
    document.getElementById('transferFromMain').innerHTML = transferHTML;

    // Initialize other forms
    initializeSupplementForm();
    initializeOrderForm();
    initializeReturnForm();
}

function initializeSupplementForm() {
    const products = Array.from(activeProducts);
    let supplementHTML = '<div class="form-row supplement-row" style="background: #e8f5e8; font-weight: bold;"><div>Product Name</div><div>Public Stock</div><div>Batch Number</div><div>Defrost Stock</div></div>';
    products.forEach(product => {
        supplementHTML += `
            <div class="form-row supplement-row">
                <div class="product-name">${product}</div>
                <div>${inventory.publicWarehouse[product]}</div>
                <input type="text" id="batch_supplement_${product}" placeholder="Auto-retrieved batch" maxlength="20">
                <div id="supplement_result_${product}">${inventory.defrostRoom[product]}</div>
            </div>
        `;
    });
    document.getElementById('supplementFromPublic').innerHTML = supplementHTML;
}

function initializeOrderForm() {
    const products = Array.from(activeProducts);
    let orderHTML = '<div class="form-row order-row" style="background: #f3e5f5; font-weight: bold;"><div>Product Name</div><div>Current Stock</div><div>Order 1 Qty</div><div>Order 2 Qty</div><div>Order 3 Qty</div><div>After Dispatch</div></div>';
    products.forEach(product => {
        orderHTML += `
            <div class="form-row order-row">
                <div class="product-name">${product}</div>
                <div id="order_current_${product}">${inventory.defrostRoom[product]}</div>
                <input type="number" id="order1_${product}" value="0" min="0" onchange="updateOrderResult('${product}')">
                <input type="number" id="order2_${product}" value="0" min="0" onchange="updateOrderResult('${product}')">
                <input type="number" id="order3_${product}" value="0" min="0" onchange="updateOrderResult('${product}')">
                <div id="order_result_${product}">${inventory.defrostRoom[product]}</div>
            </div>
        `;
    });
    document.getElementById('orderDispatch1').innerHTML = orderHTML;
}

function initializeReturnForm() {
    const products = Array.from(activeProducts);
    let returnHTML = '<div class="form-row return-row" style="background: #fff3e0; font-weight: bold;"><div>Product Name</div><div>Current Stock</div><div>Return Qty</div><div>Updated Stock</div><div>Return Batch Number</div></div>';
    products.forEach(product => {
        returnHTML += `
            <div class="form-row return-row">
                <div class="product-name">${product}</div>
                <div id="return_current_${product}">${inventory.defrostRoom[product]}</div>
                <input type="number" id="return_${product}" value="0" min="0" onchange="updateReturnResult('${product}')">
                <div id="return_result_${product}">${inventory.defrostRoom[product]}</div>
                <input type="text" id="batch_return_${product}" placeholder="Return Batch No." maxlength="20">
            </div>
        `;
    });
    document.getElementById('returnFromProduction').innerHTML = returnHTML;
}

function updateOrderResult(product) {
    const current = inventory.defrostRoom[product];
    const order1 = parseInt(document.getElementById(`order1_${product}`).value) || 0;
    const order2 = parseInt(document.getElementById(`order2_${product}`).value) || 0;
    const order3 = parseInt(document.getElementById(`order3_${product}`).value) || 0;
    const total = order1 + order2 + order3;
    const remaining = current - total;

    document.getElementById(`order_result_${product}`).textContent = remaining;
    document.getElementById(`order_result_${product}`).className = remaining < 0 ? 'has-stock' : '';
}

function updateReturnResult(product) {
    const current = inventory.defrostRoom[product];
    const returnQty = parseInt(document.getElementById(`return_${product}`).value) || 0;
    const updated = current + returnQty;

    document.getElementById(`return_result_${product}`).textContent = updated;
}

// Transfer from main warehouse
function transferFromMainWarehouse() {
    const products = Array.from(activeProducts);
    let success = true;
    let batchInfo = {};

    products.forEach(product => {
        const transferQty = parseInt(document.getElementById(`transfer_${product}`).value) || 0;
        const batchNo = document.getElementById(`batch_transfer_${product}`).value.trim();

        if (transferQty > 0) {
            if (!batchNo) {
                success = false;
                return;
            }

            if (transferQty > inventory.mainWarehouse[product]) {
                success = false;
                return;
            }

            batchInfo[product] = batchNo;
        }
    });

    if (success) {
        products.forEach(product => {
            const transferQty = parseInt(document.getElementById(`transfer_${product}`).value) || 0;
            inventory.mainWarehouse[product] -= transferQty;
            inventory.defrostRoom[product] += transferQty;
        });

        initializeForms();
        updateStatusIndicator();
    }
}

// Supplement stock (auto-retrieve from public warehouse)
function supplementStock() {
    const products = Array.from(activeProducts);
    let supplemented = false;

    products.forEach(product => {
        const batchNo = document.getElementById(`batch_supplement_${product}`).value.trim();

        // Auto supplement if defrost room stock is low and batch number is provided
        if (batchNo && inventory.defrostRoom[product] < 50) {
            const supplementQty = Math.min(50, inventory.publicWarehouse[product]);
            inventory.publicWarehouse[product] -= supplementQty;
            inventory.defrostRoom[product] += supplementQty;
            supplemented = true;
            document.getElementById(`supplement_result_${product}`).textContent = inventory.defrostRoom[product];
        }
    });

    if (supplemented) {
        initializeForms();
        updateStatusIndicator();
    }
}

// Dispatch orders
function dispatchOrders() {
    const products = Array.from(activeProducts);
    let success = true;

    products.forEach(product => {
        const order1Qty = parseInt(document.getElementById(`order1_${product}`).value) || 0;
        const order2Qty = parseInt(document.getElementById(`order2_${product}`).value) || 0;
        const order3Qty = parseInt(document.getElementById(`order3_${product}`).value) || 0;
        const totalOrderQty = order1Qty + order2Qty + order3Qty;

        if (totalOrderQty > inventory.defrostRoom[product]) {
            success = false;
            return;
        }

        inventory.defrostRoom[product] -= totalOrderQty;
    });

    if (success) {
        initializeForms();
        updateStatusIndicator();
    }
}

// Process returns
function processReturns() {
    const products = Array.from(activeProducts);
    let batchInfo = {};
    let hasReturns = false;

    products.forEach(product => {
        const returnQty = parseInt(document.getElementById(`return_${product}`).value) || 0;
        const batchNo = document.getElementById(`batch_return_${product}`).value.trim();

        if (returnQty > 0) {
            hasReturns = true;
            if (!batchNo) {
                return;
            }
            batchInfo[product] = batchNo;
        }

        inventory.defrostRoom[product] += returnQty;
        document.getElementById(`return_result_${product}`).textContent = inventory.defrostRoom[product];
    });

    if (hasReturns) {
        initializeForms();
        updateStatusIndicator();
    }
}

// Final check and return to main
function finalCheck() {
    const products = Array.from(activeProducts);
    const total = products.reduce((sum, product) => sum + inventory.defrostRoom[product], 0);

    if (total === 0) {
        return;
    }

    // Show current stock details
    let stockDetails = 'Current defrost room stock:\n';
    let returnItems = [];

    products.forEach(product => {
        const qty = inventory.defrostRoom[product];
        if (qty > 0) {
            stockDetails += `${product}: ${qty} units\n`;
            returnItems.push(product);
        }
    });

    if (returnItems.length > 0) {
        // Create a form for batch numbers
        let batchForm = '';
        returnItems.forEach(product => {
            batchForm += `${product} (${inventory.defrostRoom[product]} units) - Batch Number: `;
            const batchNumber = ''; //prompt(`${stockDetails}\nEnter batch number for ${product} (${inventory.defrostRoom[product]} units):`);
            if (!batchNumber || batchNumber.trim() === '') {
                return;
            }
        });

        // Return all defrost room stock to main warehouse
        products.forEach(product => {
            inventory.mainWarehouse[product] += inventory.defrostRoom[product];
            inventory.defrostRoom[product] = 0;
        });

        // Save daily record
        const today = new Date().toISOString().split('T')[0];
        dailyRecords[today] = JSON.parse(JSON.stringify(inventory));

        initializeForms();
        updateStatusIndicator();
    }
}

// Update inventory display
function updateInventoryDisplay() {
    // Main warehouse stock
    let mainHTML = '';
    Object.entries(inventory.mainWarehouse).forEach(([product, qty]) => {
        mainHTML += `<div class="summary-item"><span>${product}</span><span>${qty}</span></div>`;
    });
    const mainTotal = Object.values(inventory.mainWarehouse).reduce((sum, qty) => sum + qty, 0);
    mainHTML += `<div class="summary-item"><span>Total</span><span>${mainTotal}</span></div>`;
    document.getElementById('mainWarehouseInventory').innerHTML = mainHTML;

    // Defrost room stock (only show active products)
    let defrostHTML = '';
    Array.from(activeProducts).forEach(product => {
        const qty = inventory.defrostRoom[product];
        const className = qty === 0 ? 'zero-stock' : 'has-stock';
        defrostHTML += `<div class="summary-item"><span>${product}</span><span class="${className}">${qty}</span></div>`;
    });
    const defrostTotal = Array.from(activeProducts).reduce((sum, product) => sum + inventory.defrostRoom[product], 0);
    const totalClassName = defrostTotal === 0 ? 'zero-stock' : 'has-stock';
    defrostHTML += `<div class="summary-item"><span>Total</span><span class="${totalClassName}">${defrostTotal}</span></div>`;
    document.getElementById('defrostRoomInventory').innerHTML = defrostHTML;

    // Public warehouse stock
    let publicHTML = '';
    Object.entries(inventory.publicWarehouse).forEach(([product, qty]) => {
        publicHTML += `<div class="summary-item"><span>${product}</span><span>${qty}</span></div>`;
    });
    const publicTotal = Object.values(inventory.publicWarehouse).reduce((sum, qty) => sum + qty, 0);
    publicHTML += `<div class="summary-item"><span>Total</span><span>${publicTotal}</span></div>`;
    document.getElementById('publicWarehouseInventory').innerHTML = publicHTML;
}

// Load historical record
function loadHistoryRecord() {
    const selectedDate = document.getElementById('historyDate').value;
    if (!selectedDate) {
        alert('Please select a date to query');
        return;
    }

    const record = dailyRecords[selectedDate];
    if (!record) {
        document.getElementById('historyResults').innerHTML =
            `<p style="text-align: center; color: #666; padding: 40px;">No records found for ${selectedDate}</p>`;
        return;
    }

    let historyHTML = `
        <div class="history-record">
            <div class="record-header">${selectedDate} End of Day Inventory Record</div>
            <div class="record-content">
                <div class="record-row" style="background: #f8f9fa; font-weight: bold;">
                    <div>Product Name</div>
                    <div>Main Warehouse</div>
                    <div>Defrost Room</div>
                    <div>Public Warehouse</div>
                    <div>Status</div>
                </div>
    `;

    Object.keys(record.defrostRoom).forEach(product => {
        const defrostQty = record.defrostRoom[product];
        const status = defrostQty === 0 ? '✅ Normal' : '⚠️ Abnormal';
        const statusClass = defrostQty === 0 ? 'zero-stock' : 'has-stock';

        historyHTML += `
            <div class="record-row">
                <div>${product}</div>
                <div>${record.mainWarehouse[product]}</div>
                <div class="${statusClass}">${defrostQty}</div>
                <div>${record.publicWarehouse[product]}</div>
                <div class="${statusClass}">${status}</div>
            </div>
        `;
    });

    const totalDefrost = Object.values(record.defrostRoom).reduce((sum, qty) => sum + qty, 0);
    const totalStatus = totalDefrost === 0 ? '✅ System Normal' : '⚠️ Attention Required';
    const totalClass = totalDefrost === 0 ? 'zero-stock' : 'has-stock';

    historyHTML += `
                <div class="record-row total-row">
                    <div><strong>Total</strong></div>
                    <div>${Object.values(record.mainWarehouse).reduce((sum, qty) => sum + qty, 0)}</div>
                    <div class="${totalClass}"><strong>${totalDefrost}</strong></div>
                    <div>${Object.values(record.publicWarehouse).reduce((sum, qty) => sum + qty, 0)}</div>
                    <div class="${totalClass}"><strong>${totalStatus}</strong></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('historyResults').innerHTML = historyHTML;
}

window.loadSurimiPage = (supabaseClient) => {
    updateTime();
    updateStatusIndicator();
    initializeForms(supabaseClient);
    updateInventoryDisplay();

    // Set default date to today
    document.getElementById('historyDate').value = new Date().toISOString().split('T')[0];
};

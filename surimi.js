let inventory = {
    mainWarehouse: {},
    defrostRoom: {},
    publicWarehouse: {}
};

async function fetchInventoryData(supabaseClient) {
    try {
        // 获取 type 为 'Surimi' 的产品
        const { data: productsData, error: productsError } = await supabaseClient
            .from('products')
            .select('item_code, product_name, type')
            .eq('type', 'Surimi');

        if (productsError) {
            console.error('Error fetching Surimi products:', productsError);
            return [];
        }
        
        if (!productsData || productsData.length === 0) {
            return [];
        }

        const surimiItemCodes = productsData.map(p => p.item_code);

        // 获取库存数据，只获取数量大于0的记录
        const { data: inventoryData, error: inventoryError } = await supabaseClient
            .from('inventory')
            .select(`
                id,
                item_code,
                quantity,
                batch_no,
                warehouse_id,
                products (
                    item_code,
                    product_name,
                    type
                )
            `)
            .eq('warehouse_id', 'coldroom5')
            .in('item_code', surimiItemCodes)
            .gt('quantity', 0); // 只获取数量大于0的记录

        if (inventoryError) {
            console.error('Error fetching inventory data:', inventoryError);
            return [];
        }

        return inventoryData || [];

    } catch (error) {
        console.error('Unexpected error in fetchInventoryData:', error);
        return [];
    }
}

// 修改：获取 defrost 仓库的库存数据，根据选择的日期过滤
async function fetchDefrostInventoryData(supabaseClient, selectedDate) {
    try {
        // 获取 type 为 'Surimi' 的产品
        const { data: productsData, error: productsError } = await supabaseClient
            .from('products')
            .select('item_code, product_name, type')
            .eq('type', 'Surimi');

        if (productsError) {
            console.error('Error fetching Surimi products:', productsError);
            return [];
        }
        
        if (!productsData || productsData.length === 0) {
            return [];
        }

        const surimiItemCodes = productsData.map(p => p.item_code);

        // 构建日期过滤条件
        const startDate = `${selectedDate}T00:00:00.000Z`;
        const endDate = `${selectedDate}T23:59:59.999Z`;

        // 获取 defrost 仓库的库存数据，根据updated_at过滤日期
        const { data: defrostData, error: defrostError } = await supabaseClient
            .from('inventory')
            .select(`
                id,
                item_code,
                quantity,
                batch_no,
                warehouse_id,
                updated_at,
                products (
                    item_code,
                    product_name,
                    type
                )
            `)
            .eq('warehouse_id', 'defrost')
            .in('item_code', surimiItemCodes)
            .gte('updated_at', startDate)
            .lte('updated_at', endDate);

        if (defrostError) {
            console.error('Error fetching defrost inventory data:', defrostError);
            return [];
        }

        return defrostData || [];

    } catch (error) {
        console.error('Unexpected error in fetchDefrostInventoryData:', error);
        return [];
    }
}

let activeProducts = new Set();
let dailyRecords = {};

// Date change handler
function onDateChange() {
    const selectedDate = document.getElementById('operationDate').value;
    if (selectedDate && window.supabaseClient) {
        initializeForms(window.supabaseClient);
    }
}

// Update status indicator
function updateStatusIndicator() {
    const indicator = document.getElementById('statusIndicator');
    if (indicator) {
        indicator.textContent = '';
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
    
    // 从库存数据中移除该产品
    delete inventory.mainWarehouse[product];
    delete inventory.defrostRoom[product];
    delete inventory.publicWarehouse[product];
    
    // 重新生成所有表单
    initializeSupplementForm();
    initializeOrderForm();
    initializeReturnForm();
    
    // 重新生成转移表单
    const products = Array.from(activeProducts);
    if (products.length === 0) {
        document.getElementById('transferFromMain').innerHTML = 
            '<div style="text-align: center; padding: 20px; color: #666;">No products selected</div>';
        return;
    }

    let transferHTML = '<div class="form-row transfer-row" style="background: #e3f2fd; font-weight: bold;"><div>Product Name</div><div>Main Stock</div><div>Batch Number</div><div>Transfer Qty</div><div>Current Defrost</div><div>Action</div></div>';
    
    products.forEach(productName => {
        const mainItem = inventory.mainWarehouse[productName];
        if (mainItem) {
            transferHTML += `
                <div class="form-row transfer-row">
                    <div class="product-name">${productName}</div>
                    <div>${mainItem.quantity}</div>
                    <input type="text" id="batch_transfer_${productName}" value="${mainItem.batch_no}" readonly>
                    <input type="number" id="transfer_${productName}" value="${mainItem.quantity}" min="0" max="${mainItem.quantity}" style="border: none;" step="0.1">
                    <div class="zero-stock">${inventory.defrostRoom[productName]}</div>
                    <button class="remove-btn" onclick="removeProduct('${productName}')" title="Remove this product">×</button>
                </div>
            `;
        }
    });
    
    document.getElementById('transferFromMain').innerHTML = transferHTML;
    updateInventoryDisplay();
}

// Initialize forms
async function initializeForms(supabaseClient) {
    const selectedDate = document.getElementById('operationDate').value || new Date().toISOString().split('T')[0];
    
    const inventoryData = await fetchInventoryData(supabaseClient);
    const defrostData = await fetchDefrostInventoryData(supabaseClient, selectedDate);

    // 重置库存数据
    inventory.mainWarehouse = {};
    inventory.defrostRoom = {};
    inventory.publicWarehouse = {};

    // 处理 coldroom5 的数据
    if (inventoryData && inventoryData.length > 0) {
        inventoryData.forEach(item => {
            if (item.products && item.products.product_name) {
                const productName = item.products.product_name;
                inventory.mainWarehouse[productName] = {
                    quantity: item.quantity || 0,
                    batch_no: item.batch_no || '',
                    inventory_id: item.id
                };
                inventory.defrostRoom[productName] = 0;
            }
        });
    }

    // 处理 defrost 仓库的数据
    if (defrostData && defrostData.length > 0) {
        defrostData.forEach(item => {
            if (item.products && item.products.product_name) {
                const productName = item.products.product_name;
                inventory.publicWarehouse[productName] = {
                    quantity: item.quantity || 0,
                    batch_no: item.batch_no || '',
                    inventory_id: item.id
                };
            }
        });
    }

    // 合并所有产品（包括在coldroom5和defrost中的产品）
    const allProducts = new Set([
        ...Object.keys(inventory.mainWarehouse),
        ...Object.keys(inventory.publicWarehouse)
    ]);

    // 确保所有产品都有完整的库存记录
    allProducts.forEach(productName => {
        if (!inventory.mainWarehouse[productName]) {
            inventory.mainWarehouse[productName] = {
                quantity: 0,
                batch_no: '',
                inventory_id: null
            };
        }
        if (!inventory.defrostRoom[productName]) {
            inventory.defrostRoom[productName] = 0;
        }
        if (!inventory.publicWarehouse[productName]) {
            inventory.publicWarehouse[productName] = {
                quantity: 0,
                batch_no: '',
                inventory_id: null
            };
        }
    });

    activeProducts = allProducts;
    
    const products = Array.from(activeProducts);

    if (products.length === 0) {
        document.getElementById('transferFromMain').innerHTML = 
            '<div style="text-align: center; padding: 20px; color: #666;">No Surimi products found</div>';
        return;
    }

    // 生成转移表单的 HTML
    let transferHTML = '<div class="form-row transfer-row" style="background: #e3f2fd; font-weight: bold;"><div>Product Name</div><div>Main Stock</div><div>Batch Number</div><div>Transfer Qty</div><div>Current Defrost</div><div>Action</div></div>';
    
    products.forEach(productName => {
        const mainItem = inventory.mainWarehouse[productName];
        if (mainItem && mainItem.quantity > 0) { // 只显示有库存的产品
            transferHTML += `
                <div class="form-row transfer-row">
                    <div class="product-name">${productName}</div>
                    <div>${mainItem.quantity}</div>
                    <input type="text" id="batch_transfer_${productName}" value="${mainItem.batch_no}" readonly>
                    <input type="number" id="transfer_${productName}" value="${mainItem.quantity}" min="0" max="${mainItem.quantity}" style="border: none;" step="0.1">
                    <div class="zero-stock">${inventory.defrostRoom[productName]}</div>
                    <button class="remove-btn" onclick="removeProduct('${productName}')" title="Remove this product">×</button>
                </div>
            `;
        }
    });
    
    document.getElementById('transferFromMain').innerHTML = transferHTML;

    // 初始化其他表单
    initializeSupplementForm();
    initializeOrderForm();
    initializeReturnForm();
    initializeDefrostBalanceTable();
}

function initializeDefrostBalanceTable() {
    const products = Array.from(activeProducts);
    let tableHTML = `
        <div class="form-row" style="font-weight: bold;">
            <div>Product</div>
            <div>Quantity</div>
            <div>Batch Number</div>
        </div>
    `;
    products.forEach(product => {
        const qty = inventory.defrostRoom[product];
        tableHTML += `
            <div class="form-row">
                <div>${product}</div>
                <div id="defrost_balance_${product}">${qty}</div>
                <input type="text" id="final_batch_${product}" placeholder="Enter Batch No." maxlength="20">
            </div>
        `;
    });
    document.getElementById('defrostBalanceTable').innerHTML = tableHTML;
}

function initializeSupplementForm() {
    const products = Array.from(activeProducts);
    let supplementHTML = '<div class="form-row supplement-row" style="background: #e8f5e8; font-weight: bold;"><div>Product Name</div><div>Public Stock</div><div>Batch Number</div><div>Defrost Stock</div></div>';
    
    // 只显示在Public Warehouse有库存的产品（quantity > 0）
    products.forEach(product => {
        const publicItem = inventory.publicWarehouse[product];
        const publicQuantity = publicItem ? publicItem.quantity : 0;
        
        if (publicQuantity > 0) {
            const publicBatch = publicItem ? publicItem.batch_no || '' : '';
            
            supplementHTML += `
                <div class="form-row supplement-row">
                    <div class="product-name">${product}</div>
                    <div>${publicQuantity}</div>
                    <input type="text" id="batch_supplement_${product}" value="${publicBatch}" placeholder="Auto-retrieved batch" maxlength="20">
                    <div id="supplement_result_${product}">${inventory.defrostRoom[product]}</div>
                </div>
            `;
        }
    });
    
    // 如果没有产品有库存，显示提示信息
    const hasStock = products.some(product => {
        const publicItem = inventory.publicWarehouse[product];
        return publicItem && publicItem.quantity > 0;
    });
    
    if (!hasStock) {
        supplementHTML += '<div style="text-align: center; padding: 20px; color: #666;">No Surimi products available in Public Warehouse</div>';
    }
    
    document.getElementById('supplementFromPublic').innerHTML = supplementHTML;
}

function initializeOrderForm() {
    const products = Array.from(activeProducts);
    let orderHTML = '<div class="form-row order-row" style="background: #f3e5f5; font-weight: bold;"><div>Product</div><div>Current</div><div>1st</div><div>2nd</div><div>Premium</div><div>Replenish</div><div>After</div></div>';
    products.forEach(product => {
        orderHTML += `
            <div class="form-row order-row">
                <div class="product-name">${product}</div>
                <div id="order_current_${product}">${inventory.defrostRoom[product]}</div>
                <input type="number" id="order1_${product}" placeholder="" min="0" step="0.5" oninput="divideOrderInput(this)" onchange="updateOrderResult('${product}')">
                <input type="number" id="order2_${product}" placeholder="" min="0" step="0.5" oninput="divideOrderInput(this)" onchange="updateOrderResult('${product}')">
                <input type="number" id="order3_${product}" placeholder="" min="0" step="0.5" oninput="divideOrderInput(this)" onchange="updateOrderResult('${product}')">
                <input type="number" id="order4_${product}" placeholder="" min="0" step="0.5" oninput="divideOrderInput(this)" onchange="updateOrderResult('${product}')">
                <div id="order_result_${product}">${inventory.defrostRoom[product]}</div>
            </div>
        `;
    });
    document.getElementById('orderDispatch1').innerHTML = orderHTML;
}

function divideOrderInput(element) {
    if (element.value === '') {
        element.dataset.divided = 'false';
        return;
    }
    if (element.dataset.divided !== 'true') {
        if (element.value) {
            setTimeout(() => {
                let value = parseFloat(element.value);
                if (!isNaN(value)) {
                    element.value = value / 2;
                    element.dataset.divided = 'true';
                }
            }, 800);
        }
    }
}

function initializeReturnForm() {
    const products = Array.from(activeProducts);
    let returnHTML = '<div class="form-row return-row" style="background: #fff3e0; font-weight: bold;"><div>Product Name</div><div>Current Stock</div><div>Return Qty</div><div>Updated Stock</div></div>';
    products.forEach(product => {
        returnHTML += `
            <div class="form-row return-row">
                <div class="product-name">${product}</div>
                <div id="return_current_${product}">${inventory.defrostRoom[product]}</div>
                <input type="number" id="return_${product}" placeholder="" min="0" step="0.5" onchange="updateReturnResult('${product}')">
                <div id="return_result_${product}">${inventory.defrostRoom[product]}</div>
            </div>
        `;
    });
    document.getElementById('returnFromProduction').innerHTML = returnHTML;
}

// 更新所有表单的库存显示
function updateAllFormsStock() {
    const products = Array.from(activeProducts);
    
    // 更新 Order 表单的 Current Stock
    products.forEach(product => {
        const orderCurrentElement = document.getElementById(`order_current_${product}`);
        if (orderCurrentElement) {
            orderCurrentElement.textContent = inventory.defrostRoom[product];
        }
        
        const orderResultElement = document.getElementById(`order_result_${product}`);
        if (orderResultElement) {
            orderResultElement.textContent = inventory.defrostRoom[product];
        }
    });
    
    // 更新 Return 表单的 Current Stock
    products.forEach(product => {
        const returnCurrentElement = document.getElementById(`return_current_${product}`);
        if (returnCurrentElement) {
            returnCurrentElement.textContent = inventory.defrostRoom[product];
        }
        
        const returnResultElement = document.getElementById(`return_result_${product}`);
        if (returnResultElement) {
            returnResultElement.textContent = inventory.defrostRoom[product];
        }
    });
    
    // 更新 Supplement 表单的 Defrost Stock
    products.forEach(product => {
        const supplementResultElement = document.getElementById(`supplement_result_${product}`);
        if (supplementResultElement) {
            supplementResultElement.textContent = inventory.defrostRoom[product];
        }
    });

    // 更新 Defrost Balance table
    initializeDefrostBalanceTable();
}

function updateOrderResult(product) {
    const current = inventory.defrostRoom[product];
    const order1 = parseFloat(document.getElementById(`order1_${product}`).value) || 0;
    const order2 = parseFloat(document.getElementById(`order2_${product}`).value) || 0;
    const order3 = parseFloat(document.getElementById(`order3_${product}`).value) || 0;
    const order4 = parseFloat(document.getElementById(`order4_${product}`).value) || 0;
    const total = order1 + order2 + order3 + order4;
    const remaining = parseFloat((current - total).toFixed(1));

    document.getElementById(`order_result_${product}`).textContent = remaining;
    document.getElementById(`order_result_${product}`).className = remaining < 0 ? 'has-stock' : '';
}

function updateReturnResult(product) {
    const current = inventory.defrostRoom[product];
    const returnQty = parseFloat(document.getElementById(`return_${product}`).value) || 0;
    const updated = parseFloat((current + returnQty).toFixed(1));

    document.getElementById(`return_result_${product}`).textContent = updated;
}

// Transfer from main warehouse
function transferFromMainWarehouse() {
    const products = Array.from(activeProducts);
    let success = true;
    let batchInfo = {};

    products.forEach(product => {
        const transferElement = document.getElementById(`transfer_${product}`);
        const batchElement = document.getElementById(`batch_transfer_${product}`);
        
        if (transferElement && batchElement) {
            const transferQty = parseFloat(transferElement.value) || 0;
            const batchNo = batchElement.value.trim();

            if (transferQty > 0) {
                if (!batchNo) {
                    success = false;
                    return;
                }

                const mainItem = inventory.mainWarehouse[product];
                if (transferQty > (mainItem ? mainItem.quantity : 0)) {
                    success = false;
                    return;
                }

                batchInfo[product] = batchNo;
            }
        }
    });

    if (success) {
        products.forEach(product => {
            const transferElement = document.getElementById(`transfer_${product}`);
            if (transferElement) {
                const transferQty = parseFloat(transferElement.value) || 0;
                const mainItem = inventory.mainWarehouse[product];
                if (mainItem && transferQty > 0) {
                    mainItem.quantity = parseFloat((mainItem.quantity - transferQty).toFixed(1));
                    inventory.defrostRoom[product] = parseFloat((inventory.defrostRoom[product] + transferQty).toFixed(1));
                }
            }
        });

        updateStatusIndicator();
        updateInventoryDisplay();
        updateAllFormsStock();
        
        // 更新显示
        products.forEach(product => {
            const mainItem = inventory.mainWarehouse[product];
            const transferElement = document.getElementById(`transfer_${product}`);
            if (mainItem && transferElement) {
                const transferRow = transferElement.parentNode;
                transferRow.children[1].textContent = mainItem.quantity;
                transferElement.setAttribute('max', mainItem.quantity);
                transferElement.value = mainItem.quantity;
                transferRow.children[4].textContent = inventory.defrostRoom[product];
            }
        });
    }
}

// Supplement stock (auto-retrieve from public warehouse)
function supplementStock() {
    const products = Array.from(activeProducts);
    let supplemented = false;

    products.forEach(product => {
        const batchElement = document.getElementById(`batch_supplement_${product}`);
        
        if (batchElement) {
            const batchNo = batchElement.value.trim();

            // Auto supplement if defrost room stock is low and batch number is provided
            if (batchNo && inventory.defrostRoom[product] < 50) {
                const publicItem = inventory.publicWarehouse[product];
                const availableQty = publicItem ? publicItem.quantity : 0;
                const supplementQty = Math.min(50, availableQty);
                
                if (supplementQty > 0 && publicItem) {
                    publicItem.quantity -= supplementQty;
                    inventory.defrostRoom[product] += supplementQty;
                    supplemented = true;
                    document.getElementById(`supplement_result_${product}`).textContent = inventory.defrostRoom[product];
                }
            }
        }
    });

    if (supplemented) {
        updateStatusIndicator();
        updateInventoryDisplay();
        updateAllFormsStock();
    }
}

// Dispatch orders
function dispatchOrders() {
    const products = Array.from(activeProducts);
    let success = true;

    products.forEach(product => {
        const order1Qty = parseFloat(document.getElementById(`order1_${product}`).value) || 0;
        const order2Qty = parseFloat(document.getElementById(`order2_${product}`).value) || 0;
        const order3Qty = parseFloat(document.getElementById(`order3_${product}`).value) || 0;
        const order4Qty = parseFloat(document.getElementById(`order4_${product}`).value) || 0;
        const totalOrderQty = order1Qty + order2Qty + order3Qty + order4Qty;

        if (totalOrderQty > inventory.defrostRoom[product]) {
            success = false;
            return;
        }
    });

    if (success) {
        products.forEach(product => {
            const order1Qty = parseFloat(document.getElementById(`order1_${product}`).value) || 0;
            const order2Qty = parseFloat(document.getElementById(`order2_${product}`).value) || 0;
            const order3Qty = parseFloat(document.getElementById(`order3_${product}`).value) || 0;
            const order4Qty = parseFloat(document.getElementById(`order4_${product}`).value) || 0;
            const totalOrderQty = order1Qty + order2Qty + order3Qty + order4Qty;
            
            inventory.defrostRoom[product] = parseFloat((inventory.defrostRoom[product] - totalOrderQty).toFixed(1));
        });

        updateStatusIndicator();
        updateInventoryDisplay();
        updateAllFormsStock();
        
        // 重置订单输入
        products.forEach(product => {
            document.getElementById(`order1_${product}`).value = '';
            document.getElementById(`order2_${product}`).value = '';
            document.getElementById(`order3_${product}`).value = '';
            document.getElementById(`order4_${product}`).value = '';
        });
    }
}

// Process returns
function processReturns() {
    const products = Array.from(activeProducts);
    let hasReturns = false;

    products.forEach(product => {
        const returnQty = parseFloat(document.getElementById(`return_${product}`).value) || 0;

        if (returnQty > 0) {
            hasReturns = true;
        }

        inventory.defrostRoom[product] = parseFloat((inventory.defrostRoom[product] + returnQty).toFixed(1));
        document.getElementById(`return_result_${product}`).textContent = inventory.defrostRoom[product];
    });

    if (hasReturns) {
        updateStatusIndicator();
        updateInventoryDisplay();
        updateAllFormsStock();
        
        // 重置返回输入
        products.forEach(product => {
            document.getElementById(`return_${product}`).value = '';
        });
    }
}

// Final check and return to main
function finalCheck() {
    const products = Array.from(activeProducts);
    let allBatchNumbersEntered = true;
    const batchNumbers = {};

    products.forEach(product => {
        const qty = inventory.defrostRoom[product];
        if (qty > 0) {
            const batchInput = document.getElementById(`final_batch_${product}`);
            if (!batchInput.value.trim()) {
                allBatchNumbersEntered = false;
                batchInput.style.border = '1px solid red';
            } else {
                batchNumbers[product] = batchInput.value.trim();
                batchInput.style.border = '1px solid #e9ecef';
            }
        }
    });

    if (!allBatchNumbersEntered) {
        alert('Please enter all batch numbers.');
        return;
    }

    // Return all defrost room stock to main warehouse
    products.forEach(product => {
        if (inventory.defrostRoom[product] > 0) {
            const mainItem = inventory.mainWarehouse[product];
            if (mainItem) {
                mainItem.quantity += inventory.defrostRoom[product];
            }
            inventory.defrostRoom[product] = 0;
        }
    });

    // Save daily record
    const today = new Date().toISOString().split('T')[0];
    dailyRecords[today] = JSON.parse(JSON.stringify(inventory));

    updateStatusIndicator();
    updateInventoryDisplay();
    updateAllFormsStock();

    if (window.supabaseClient) {
        initializeForms(window.supabaseClient);
    }
}

// Update inventory display
function updateInventoryDisplay() {
    // Main warehouse stock
    let mainHTML = '';
    Object.entries(inventory.mainWarehouse).forEach(([product, item]) => {
        const qty = item ? item.quantity : 0;
        mainHTML += `<div class="summary-item"><span>${product}</span><span>${qty}</span></div>`;
    });
    const mainTotal = Object.values(inventory.mainWarehouse).reduce((sum, item) => sum + (item ? item.quantity : 0), 0);
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
    Object.entries(inventory.publicWarehouse).forEach(([product, item]) => {
        const qty = item ? item.quantity : 0;
        publicHTML += `<div class="summary-item"><span>${product}</span><span>${qty}</span></div>`;
    });
    const publicTotal = Object.values(inventory.publicWarehouse).reduce((sum, item) => sum + (item ? item.quantity : 0), 0);
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
        const mainItem = record.mainWarehouse[product];
        const publicItem = record.publicWarehouse[product];

        historyHTML += `
            <div class="record-row">
                <div>${product}</div>
                <div>${mainItem ? mainItem.quantity : 0}</div>
                <div class="${statusClass}">${defrostQty}</div>
                <div>${publicItem ? publicItem.quantity : 0}</div>
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
                    <div>${Object.values(record.mainWarehouse).reduce((sum, item) => sum + (item ? item.quantity : 0), 0)}</div>
                    <div class="${totalClass}"><strong>${totalDefrost}</strong></div>
                    <div>${Object.values(record.publicWarehouse).reduce((sum, item) => sum + (item ? item.quantity : 0), 0)}</div>
                    <div class="${totalClass}"><strong>${totalStatus}</strong></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('historyResults').innerHTML = historyHTML;
}

window.loadSurimiPage = (supabaseClient) => {
    // 存储 supabaseClient 供其他函数使用
    window.supabaseClient = supabaseClient;
    
    // 设置默认日期为今天
    const operationDateElement = document.getElementById('operationDate');
    const historyDateElement = document.getElementById('historyDate');
    const today = new Date().toISOString().split('T')[0];
    
    if (operationDateElement) {
        operationDateElement.value = today;
    }
    if (historyDateElement) {
        historyDateElement.value = today;
    }
    
    updateStatusIndicator();
    initializeForms(supabaseClient);
    updateInventoryDisplay();
};
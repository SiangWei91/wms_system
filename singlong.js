window.loadSingLongPage = (supabaseClient) => {
    const warehouseId = 'singlong';
    let eventController = null;

    const STOCK_OUT_KEY = `stockOut_${warehouseId}`;

    const saveStockOutData = () => {
        const stockOutTableBody = document.querySelector(`#${warehouseId}-stock-out-table tbody`);
        if (!stockOutTableBody) return;
        const stockOutData = [];
        const rows = stockOutTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                stockOutData.push({
                    productName: cells[0].textContent,
                    packingSize: cells[1].textContent,
                    batchNo: cells[2].textContent,
                    location: cells[3].textContent,
                    lotNumber: cells[4].textContent,
                    withdrawQuantity: cells[5].textContent,
                    withdrawPallet: cells[6].textContent
                });
            }
        });
        if (!window.warehouseStockOutData) {
            window.warehouseStockOutData = {};
        }
        window.warehouseStockOutData[STOCK_OUT_KEY] = stockOutData;
    };

    const loadStockOutData = () => {
        const stockOutTableBody = document.querySelector(`#${warehouseId}-stock-out-table tbody`);
        if (!stockOutTableBody) return;
        if (window.warehouseStockOutData && window.warehouseStockOutData[STOCK_OUT_KEY]) {
            const stockOutData = window.warehouseStockOutData[STOCK_OUT_KEY];
            stockOutTableBody.innerHTML = '';
            stockOutData.forEach(item => {
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td>${item.productName}</td>
                    <td>${item.packingSize}</td>
                    <td>${item.batchNo}</td>
                    <td>${item.location}</td>
                    <td>${item.lotNumber}</td>
                    <td>${item.withdrawQuantity}</td>
                    <td>${item.withdrawPallet}</td>
                    <td><button class="remove-stock-out-btn" style="background: #ff4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">&times;</button></td>
                `;
                stockOutTableBody.appendChild(newRow);
            });
            addRemoveStockOutListeners();
        }
    };

    const addRemoveStockOutListeners = () => {
        const removeButtons = document.querySelectorAll(`#${warehouseId}-stock-out-table .remove-stock-out-btn`);
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                if (confirm('确定要删除这条 Stock Out 记录吗？')) {
                    e.target.closest('tr').remove();
                    saveStockOutData();
                }
            });
        });
    };

    const clearStockOutData = () => {
        const stockOutTableBody = document.querySelector(`#${warehouseId}-stock-out-table tbody`);
        if (stockOutTableBody) {
            stockOutTableBody.innerHTML = '';
        }
        if (window.warehouseStockOutData) {
            delete window.warehouseStockOutData[STOCK_OUT_KEY];
        }
    };

    const loadInventoryData = async () => {
        try {
            if (eventController) {
                eventController.abort();
            }
            eventController = new AbortController();
            const signal = eventController.signal;

            const { data: inventoryData, error: inventoryError } = await supabaseClient
                .from('inventory')
                .select('*')
                .eq('warehouse_id', warehouseId)
                .order('details->>lotNumber', { ascending: true });

            if (inventoryError) throw inventoryError;

            const { data: productsData, error: productsError } = await supabaseClient
                .from('products')
                .select('item_code, product_name, packing_size');

            if (productsError) throw productsError;

            const productsMap = new Map(productsData.map(p => [p.item_code, p]));

            const inventorySummaryTable = document.querySelector(`#${warehouseId}-inventory-summary-table`);
            if (inventorySummaryTable && !document.getElementById(`${warehouseId}-search-container`)) {
                const searchContainer = document.createElement('div');
                searchContainer.id = `${warehouseId}-search-container`;
                searchContainer.style.marginBottom = '20px';
                searchContainer.style.display = 'flex';
                searchContainer.style.alignItems = 'center';
                searchContainer.style.backgroundColor = '#f5f5f5';
                searchContainer.style.borderRadius = '16px';
                searchContainer.style.padding = '4px 12px';
                searchContainer.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.08)';
                searchContainer.style.width = '25%';
                searchContainer.style.height = '40px';

                const searchInput = document.createElement('input');
                searchInput.type = 'text';
                searchInput.id = `${warehouseId}-search-input`;
                searchInput.placeholder = 'Search...';
                searchInput.style.border = 'none';
                searchInput.style.outline = 'none';
                searchInput.style.background = 'transparent';
                searchInput.style.width = '100%';
                searchInput.style.fontSize = '0.875rem';

                searchContainer.appendChild(searchInput);
                inventorySummaryTable.parentNode.insertBefore(searchContainer, inventorySummaryTable);
            }

            const inventorySummaryTableBody = document.querySelector(`#${warehouseId}-inventory-summary-table tbody`);
            inventorySummaryTableBody.innerHTML = '';
            let summaryTotalQuantity = 0;
            let summaryTotalPallet = 0;

            inventoryData.filter(item => item.quantity > 0).forEach(item => {
                const product = productsMap.get(item.item_code) || {};
                const row = document.createElement('tr');
                row.dataset.inventoryId = item.id;

                const formatDate = (dateString) => {
                    if (!dateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return '';
                    const parts = dateString.split('/');
                    return `${parts[0]}/${parts[1]}/${parts[2]}`;
                };

                const calculateDaysLeft = (dueDateString) => {
                    if (!dueDateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dueDateString)) return 'N/A';
                    const parts = dueDateString.split('/');
                    const dueDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diffTime = dueDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays;
                };

                const palletDueDate = item.details.pallet_due_date || '';
                const daysLeft = calculateDaysLeft(palletDueDate);

                row.innerHTML = `
                    <td>${item.item_code}</td>
                    <td>${product.product_name || ''}</td>
                    <td>${product.packing_size || ''}</td>
                    <td>${item.details.lotNumber || ''}</td>
                    <td>${item.batch_no || ''}</td>
                    <td>${formatDate(item.details.dateStored)}</td>
                    <td>${item.container || ''}</td>
                    <td>${formatDate(palletDueDate)}</td>
                    <td>${daysLeft}</td>
                    <td>${item.quantity}</td>
                    <td>${item.details.pallet}</td>
                `;
                inventorySummaryTableBody.appendChild(row);
                summaryTotalQuantity += item.quantity;
                summaryTotalPallet += Number(item.details.pallet);
            });

            const summaryFooter = document.querySelector(`#${warehouseId}-inventory-summary-table tfoot`);
            if (summaryFooter) {
                summaryFooter.innerHTML = `
                    <tr>
                        <td colspan="8">Total:</td>
                        <td>${summaryTotalQuantity}</td>
                        <td>${summaryTotalPallet}</td>
                    </tr>
                `;
            }

            inventorySummaryTableBody.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const row = e.target.closest('tr');
                if (!row) return;

                const cellsToEdit = [3, 4, 5, 6, 7]; // Corresponds to Lot Number, Batch No, Date Stored, Container Number, Pallet Due Date
                cellsToEdit.forEach(index => {
                    if(row.cells[index]) {
                        row.cells[index].contentEditable = true;
                    }
                });
                row.focus();

                const focusOutListener = () => {
                    updateInventoryRow(row);
                    row.removeEventListener('focusout', focusOutListener);
                };
                row.addEventListener('focusout', focusOutListener);
            });

            inventorySummaryTableBody.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (!row) return;

                const modal = document.getElementById('modal-container');
                const modalBody = document.getElementById('jordon-modal-body');
                if (!modal || !modalBody) return;

                const getDefaultStockOutDate = () => {
                    const today = new Date();
                    if (today.getDay() === 6) { // Saturday
                        today.setDate(today.getDate() + 2);
                    } else {
                        today.setDate(today.getDate() + 1);
                    }
                    return today.toISOString().split('T')[0];
                };

                const rowIndex = Array.from(inventorySummaryTableBody.children).indexOf(row);
                const item = inventoryData.filter(i => i.quantity > 0)[rowIndex];

                if (!item) return;

                const { id: inventory_id, item_code, batch_no, container, details } = item;
                const { lotNumber, location, pallet_due_date, dateStored } = details;
                const product = productsMap.get(item_code) || {};

                modal.setAttribute('data-current-warehouse', 'singlong');
                modal.dataset.inventoryId = inventory_id;
                modal.dataset.itemCode = item_code;
                modal.dataset.batchNo = batch_no;
                modal.dataset.location = location || '';

                modalBody.innerHTML = `
                    <p><strong>Item Code:</strong> ${item_code}</p>
                    <p><strong>Product Name:</strong> ${product.product_name || ''}</p>
                    <p><strong>Packaging Size:</strong> ${product.packing_size || ''}</p>
                    <p><strong>Lot Number:</strong> ${lotNumber || ''}</p>
                    <p><strong>Current Quantity:</strong> ${item.quantity}</p>
                    <p><strong>Current Pallet:</strong> ${item.details.pallet}</p>
                    <div class="form-group">
                        <label>Quantity:</label>
                        <input type="number" id="singlong-stock-out-quantity" class="withdraw-quantity" min="0">
                    </div>
                    <div class="form-group">
                        <label>Pallet:</label>
                        <input type="number" id="singlong-stock-out-pallet" class="withdraw-pallet" min="0">
                    </div>
                `;

                modal.style.display = 'flex';
            }, { signal });

            const searchInput = document.getElementById(`${warehouseId}-search-input`);
            if (searchInput) {
                searchInput.addEventListener('keyup', () => {
                    const searchTerm = searchInput.value.toLowerCase();
                    const tableRows = document.querySelectorAll(`#${warehouseId}-inventory-summary-table tbody tr`);
                    tableRows.forEach(row => {
                        const itemCode = row.cells[0].textContent.toLowerCase();
                        const productName = row.cells[1].textContent.toLowerCase();
                        const lotNumber = row.cells[3].textContent.toLowerCase();
                        const container = row.cells[5].textContent.toLowerCase();

                        if (itemCode.includes(searchTerm) || productName.includes(searchTerm) || lotNumber.includes(searchTerm) || container.includes(searchTerm)) {
                            row.style.display = '';
                        } else {
                            row.style.display = 'none';
                        }
                    });
                }, { signal });
            }

            loadStockOutData();

        } catch (error) {
            console.error('Error loading inventory data:', error);
        }
    };

    const initTabs = () => {
        const tabContainer = document.querySelector(`.${warehouseId}-container .tab-nav`);
        if (tabContainer) {
            tabContainer.addEventListener('click', (e) => {
                const link = e.target.closest('.tab-button');
                if (!link) return;
                const tab = link.dataset.tab;
                document.querySelectorAll(`.${warehouseId}-container .tab-button`).forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                document.querySelectorAll(`.${warehouseId}-container .tab-pane`).forEach(pane => {
                    if (pane.id === tab) {
                        pane.classList.add('active');
                    } else {
                        pane.classList.remove('active');
                    }
                });
            });
        }
    };

    const handleModalSubmit = async (e) => {
        const modal = document.getElementById('modal-container');
        const modalBody = document.getElementById('jordon-modal-body');
        const stockOutTableBody = document.querySelector('#singlong-stock-out-table tbody');

        const productName = modalBody.querySelector('p:nth-child(2)').textContent.replace('Product Name: ', '');
        const packingSize = modalBody.querySelector('p:nth-child(3)').textContent.replace('Packaging Size: ', '');
        const lotNumber = modalBody.querySelector('p:nth-child(4)').textContent.replace('Lot Number: ', '');
        const batchNo = modal.dataset.batchNo;
        const quantity = document.getElementById('singlong-stock-out-quantity').value;
        const pallet = document.getElementById('singlong-stock-out-pallet').value;

        if (quantity > 0 || pallet > 0) {
            const { data: warehouses, error } = await supabaseClient
                .from('warehouses')
                .select('warehouse_id, name')
                .like('details', '%for_3pl_list%');

            if (error) {
                console.error('Error fetching warehouses:', error);
                alert('Error fetching warehouses.');
                return;
            }

            const warehouseOptions = warehouses.map(w => `<option value="${w.warehouse_id}">${w.name}</option>`).join('');

            const newRow = document.createElement('tr');
            newRow.dataset.inventoryId = modal.dataset.inventoryId;
            newRow.dataset.itemCode = modal.dataset.itemCode;
            newRow.innerHTML = `
                <td>${productName}</td>
                <td>${packingSize}</td>
                <td>${batchNo}</td>
                <td>${lotNumber}</td>
                <td>${quantity}</td>
                <td>${pallet}</td>
                <td>
                    <select class="transfer-to-select">
                        ${warehouseOptions}
                    </select>
                </td>
                <td><button class="remove-stock-out-btn" style="background: transparent; color: red; border: none; font-size: 1.2rem; cursor: pointer;">&times;</button></td>
            `;
            const select = newRow.querySelector('.transfer-to-select');
            if(select) {
                const defrostRoomOption = Array.from(select.options).find(option => option.text === 'Defrost Room');
                if (defrostRoomOption) {
                    select.value = defrostRoomOption.value;
                }
            }
            stockOutTableBody.appendChild(newRow);
            addRemoveStockOutListeners();
        }

        modal.style.display = 'none';
    };

    const modal = document.getElementById('modal-container');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'jordon-modal-close-button' || e.target.closest('.close-button')) {
                modal.style.display = 'none';
            } else if (e.target.id === 'modal-submit-btn') {
                handleModalSubmit(e);
            }
        });
    }

    const generateStockInPrintHTML = (orderNumber, date, items) => {
        const tableRows = items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.productName}</td>
                <td>${item.packingSize}</td>
                <td>${item.lotNumber}</td>
                <td>${item.batchNo}</td>
                <td>${item.quantity}</td>
                <td>${item.pallet}</td>
            </tr>
        `).join('');

        const formattedDate = new Date(date).toLocaleDateString('en-GB');

        const htmlContent = `
        <html>
        <head>
            <title>Sing Long Stock In Request Form</title>
            <style>
                @page { size: A4; margin: 0; }
                body {
                    font-family: Arial, sans-serif;
                    font-size: 12pt;
                    margin: 0;
                    line-height: 1.3;
                }
                .content {
                    margin: 30px;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 20px;
                }
                th, td {
                    border: 1px solid black;
                    padding: 8px;
                    text-align: left;
                    font-size: 12pt;
                }
                th { background-color: #f2f2f2; }
                .header { margin-bottom: 20px; }
                .header p { margin: 3px 0; }
                .company-name-container {
                    margin-top: 30px;
                }
                .company-name {
                    font-weight: bold;
                    text-decoration: underline;
                    font-size: 16pt;
                    margin-bottom: 5px;
                }
                .attn {
                    font-weight: bold;
                    text-decoration: underline;
                    font-size: 14pt;
                    margin-top: 15px;
                    margin-bottom: 5px;
                }
                .date-container {
                    margin: 40px 0;
                }
                .date {
                    font-weight: bold;
                    font-size: 14pt;
                }
                .bold { font-weight: bold; }
                .right-align {
                    text-align: right;
                    margin-top: 10px;
                }
                .header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .header-left { flex: 1; }
                .header-right { text-align: right; }
                h2 {
                    font-size: 14pt;
                    margin-top: 20px;
                    margin-bottom: 10px;
                }
                .footer { margin-top: 20px; }
                .footer-row {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 40px;
                }
                .footer-item {
                    flex: 1;
                    text-align: left;
                    margin-right: 30px;
                }
                .footer-line {
                    border-top: 1px solid black;
                    margin-top: 60px;
                    width: 100%;
                }
            </style>
        </head>
        <body>
            <div class="content">
                <div class="header">
                    <div class="header-row">
                        <div class="header-left">
                            <div class="company-name-container">
                                <p class="company-name">Li Chuan Food Product Pte Ltd</p>
                                <p>40 Woodlands Terrace 738456</p>
                                <p>Tel 65 6755 7688 Fax 65 6755 6698</p>
                            </div>
                        </div>
                        <div class="header-right">
                            <p class="bold">S/N: ${orderNumber}</p>
                        </div>
                    </div>
                    <div class="date-container">
                        <p class="date">Date: ${formattedDate}</p>
                    </div>
                    <p class="attn">Attn: Sing Long Foodstuff & Trading Co.Pte Ltd</p>
                    <p>12 Woodlands Link Singapore 738740</p>
                    <p>Tel 6284 5254 Fax 6289 7351</p>
                </div>
                <h2>Sing Long Stock In Request Form</h2>
                <table id="dataTable">
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>Product Description</th>
                            <th>Packing</th>
                            <th>Lot Number</th>
                            <th>Batch</th>
                            <th>Quantity</th>
                            <th>Pallet</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Regards,</p>
                    <div class="footer-row">
                        <div class="footer-item">
                            <p>Issue By:</p>
                            <div class="footer-line"></div>
                        </div>
                        <div class="footer-item">
                            <p>Received By:</p>
                            <div class="footer-line"></div>
                        </div>
                        <div class="footer-item">
                            <p>Verified By:</p>
                            <div class="footer-line"></div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
        return htmlContent;
    };

    const generatePrintHTML = (orderNumber, date, time, items) => {
        const tableRows = items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.productName}</td>
                <td>${item.packingSize}</td>
                <td>${item.lotNumber}</td>
                <td>${item.batchNo}</td>
                <td>${item.quantity}</td>
                <td>${item.pallet}</td>
            </tr>
        `).join('');

        const formattedDate = new Date(date).toLocaleDateString('en-GB');

        const htmlContent = `
        <html>
        <head>
            <title>Sing Long Stock Out Request Form</title>
            <style>
                @page { size: A4; margin: 0; }
                body {
                    font-family: Arial, sans-serif;
                    font-size: 12pt;
                    margin: 0;
                    line-height: 1.3;
                }
                .content {
                    margin: 30px;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 20px;
                }
                th, td {
                    border: 1px solid black;
                    padding: 8px;
                    text-align: left;
                    font-size: 12pt;
                }
                th { background-color: #f2f2f2; }
                .header { margin-bottom: 20px; }
                .header p { margin: 3px 0; }
                .company-name-container {
                    margin-top: 30px;
                }
                .company-name {
                    font-weight: bold;
                    text-decoration: underline;
                    font-size: 16pt;
                    margin-bottom: 5px;
                }
                .attn {
                    font-weight: bold;
                    text-decoration: underline;
                    font-size: 14pt;
                    margin-top: 15px;
                    margin-bottom: 5px;
                }
                .date-container {
                    margin: 40px 0;
                }
                .date {
                    font-weight: bold;
                    font-size: 14pt;
                }
                .bold { font-weight: bold; }
                .right-align {
                    text-align: right;
                    margin-top: 10px;
                }
                .header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .header-left { flex: 1; }
                .header-right { text-align: right; }
                h2 {
                    font-size: 14pt;
                    margin-top: 20px;
                    margin-bottom: 10px;
                }
                .footer { margin-top: 20px; }
                .footer-row {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 40px;
                }
                .footer-item {
                    flex: 1;
                    text-align: left;
                    margin-right: 30px;
                }
                .footer-line {
                    border-top: 1px solid black;
                    margin-top: 60px;
                    width: 100%;
                }
            </style>
        </head>
        <body>
            <div class="content">
                <div class="header">
                    <div class="header-row">
                        <div class="header-left">
                            <div class="company-name-container">
                                <p class="company-name">Li Chuan Food Product Pte Ltd</p>
                                <p>40 Woodlands Terrace 738456</p>
                                <p>Tel 65 6755 7688 Fax 65 6755 6698</p>
                            </div>
                        </div>
                        <div class="header-right">
                            <p class="bold">S/N: ${orderNumber}</p>
                        </div>
                    </div>
                    <div class="date-container">
                        <p class="date">Date: ${formattedDate}</p>
                    </div>
                    <p class="attn">Attn: Sing Long Foodstuff & Trading Co.Pte Ltd</p>
                    <p>12 Woodlands Link Singapore 738740</p>
                    <p>Tel 6284 5254 Fax 6289 7351</p>
                    <p class="right-align"><span class="bold">Time: ${time}</span></p>
                </div>
                <h2>Sing Long Stock Out Request Form</h2>
                <table id="dataTable">
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>Product Description</th>
                            <th>Packing</th>
                            <th>Lot Number</th>
                            <th>Batch</th>
                            <th>Quantity</th>
                            <th>Pallet</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Regards,</p>
                    <div class="footer-row">
                        <div class="footer-item">
                            <p>Issue By:</p>
                            <div class="footer-line"></div>
                        </div>
                        <div class="footer-item">
                            <p>Collected By:</p>
                            <div class="footer-line"></div>
                        </div>
                        <div class="footer-item">
                            <p>Verified By:</p>
                            <div class="footer-line"></div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
        return htmlContent;
    };

    const handleStockOutSubmit = async () => {
        const stockOutTableBody = document.querySelector('#singlong-stock-out-table tbody');
        const rows = stockOutTableBody.querySelectorAll('tr');

        if (rows.length === 0) {
            alert('No items to submit.');
            return;
        }

        const drawOutDate = document.getElementById('singlong-draw-out-date').value;
        const drawOutTime = document.getElementById('singlong-draw-out-time').value;

        if (!drawOutDate) {
            alert('Please select a date.');
            return;
        }

        try {
            const { data: lastOrder, error: orderError } = await supabaseClient
                .from('scheduled_transactions')
                .select('order_number')
                .like('order_number', 'LCSL-%')
                .order('order_number', { ascending: false })
                .limit(1)
                .single();

            let newOrderNumber;
            if (orderError && orderError.code !== 'PGRST116') { // Ignore 'not found' error
                throw orderError;
            }
            if (!lastOrder) {
                newOrderNumber = 'LCSL-0001';
            } else {
                const lastNumber = parseInt(lastOrder.order_number.split('-')[1]);
                newOrderNumber = `LCSL-${(lastNumber + 1).toString().padStart(4, '0')}`;
            }

            const stockOutItemsForPrint = [];
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                stockOutItemsForPrint.push({
                    productName: cells[0].textContent,
                    packingSize: cells[1].textContent,
                    batchNo: cells[2].textContent,
                    lotNumber: cells[3].textContent,
                    quantity: cells[4].textContent,
                    pallet: cells[5].textContent,
                });
            });

            const stockOutItemsForSupabase = [];
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const destination_warehouse_id = row.querySelector('.transfer-to-select').value;
                stockOutItemsForSupabase.push({
                    inventory_id: row.dataset.inventoryId,
                    item_code: row.dataset.itemCode,
                    batch_no: cells[2].textContent,
                    lot_number: cells[3].textContent,
                    withdraw_quantity: parseInt(cells[4].textContent) || 0,
                    withdraw_pallet: parseInt(cells[5].textContent) || 0,
                    destination_warehouse_id: destination_warehouse_id,
                });
            });

            const operator_id = getCookie('userName') || 'unknown';
            const { error: insertError } = await supabaseClient
                .from('scheduled_transactions')
                .insert({
                    order_number: newOrderNumber,
                    draw_out_date: drawOutDate,
                    draw_out_time: drawOutTime,
                    warehouse_id: 'singlong',
                    stock_out_items: stockOutItemsForSupabase,
                    operator_id: operator_id,
                });

            if (insertError) {
                throw insertError;
            }

            alert(`Stock out successfully scheduled with order number: ${newOrderNumber}`);

            const printHtml = generatePrintHTML(newOrderNumber, drawOutDate, drawOutTime, stockOutItemsForPrint);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(printHtml);
            printWindow.document.close();
            printWindow.print();

            clearStockOutData();

        } catch (error) {
            console.error('Error submitting stock out:', error);
            alert(`Error submitting stock out: ${error.message}`);
        }
    };

    const setDefaultDrawOutDate = () => {
        const dateInput = document.getElementById('singlong-draw-out-date');
        if (dateInput) {
            const today = new Date();
            if (today.getDay() === 6) { // Saturday
                today.setDate(today.getDate() + 2);
            } else {
                today.setDate(today.getDate() + 1);
            }
            dateInput.value = today.toISOString().split('T')[0];
        }
    };

    const stockOutSubmitButton = document.querySelector(`#${warehouseId}-submit-stock-out-btn`);
    if (stockOutSubmitButton) {
        stockOutSubmitButton.addEventListener('click', handleStockOutSubmit);
    }

    loadInventoryData();
    initTabs();
    setDefaultDrawOutDate();

    const requestFormBtn = document.getElementById('request-form-report-btn');
    if (requestFormBtn) {
        requestFormBtn.addEventListener('click', () => {
            const requestFormSection = document.getElementById('request-form-section');
            requestFormSection.style.display = requestFormSection.style.display === 'none' ? 'block' : 'none';
        });
    }

    const drawOutBtn = document.getElementById('draw-out-btn');
    if (drawOutBtn) {
        drawOutBtn.addEventListener('click', () => {
            const drawOutSection = document.getElementById('draw-out-section');
            drawOutSection.style.display = drawOutSection.style.display === 'none' ? 'block' : 'none';
            if (drawOutSection.style.display === 'block') {
                loadDrawOutOrders();
            }
        });
    }

    const loadDrawOutOrders = async () => {
        const orderNumberSelect = document.getElementById('draw-out-order-number');
        if (!orderNumberSelect) return;

        const { data, error } = await supabaseClient
            .from('scheduled_transactions')
            .select('order_number')
            .like('order_number', 'LCSL-%')
            .order('order_number', { ascending: false });

        if (error) {
            console.error('Error fetching draw out orders:', error);
            return;
        }

        orderNumberSelect.innerHTML = data.map(order => `<option value="${order.order_number}">${order.order_number}</option>`).join('');
    };

    const reprintBtn = document.getElementById('reprint-btn');
    if (reprintBtn) {
        reprintBtn.addEventListener('click', async () => {
            const orderNumber = document.getElementById('draw-out-order-number').value;
            if (!orderNumber) {
                alert('Please select an order number.');
                return;
            }

            const { data, error } = await supabaseClient
                .from('scheduled_transactions')
                .select('*')
                .eq('order_number', orderNumber)
                .single();

            if (error || !data) {
                console.error('Error fetching order details for reprint:', error);
                alert('Could not fetch order details for reprinting.');
                return;
            }

            const printHtml = generatePrintHTML(data.order_number, data.draw_out_date, data.draw_out_time, data.stock_out_items);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(printHtml);
            printWindow.document.close();
            printWindow.print();
        });
    }

    const addStockInRowBtn = document.getElementById('add-stock-in-row-btn');
    if (addStockInRowBtn) {
        addStockInRowBtn.addEventListener('click', () => {
            addStockInRow();
        });
    }

    const getNextLotNumber = async (baseLotNumber) => {
        if (!baseLotNumber) {
            const { data, error } = await supabaseClient
                .from('inventory')
                .select('details->>lotNumber')
                .eq('warehouse_id', 'singlong')
                .order('details->>lotNumber', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching max lot number:', error);
                return 'PCR 24 / 001';
            }

            baseLotNumber = data ? data.lotNumber : 'PCR 24 / 000';
        }

        const parts = baseLotNumber.split('/');
        const number = parseInt(parts[1]) + 1;
        return `${parts[0].trim()} / ${number}`;
    };

    const addStockInRow = async () => {
        const stockInTableBody = document.querySelector('#singlong-stock-in-table tbody');
        const newRow = document.createElement('tr');
        const today = new Date().toISOString().split('T')[0];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 29);
        const palletDueDate = dueDate.toLocaleDateString('en-GB');

        let lotNumber = '';
        let dateStored = today;
        let containerNumber = '';
        let palletDueDateValue = palletDueDate;

        const rows = stockInTableBody.querySelectorAll('tr');
        if (rows.length > 0) {
            const lastRow = rows[rows.length - 1];
            lotNumber = await getNextLotNumber(lastRow.cells[5].textContent);
            dateStored = lastRow.cells[6].querySelector('input').value;
            containerNumber = lastRow.cells[7].querySelector('input').value;
            palletDueDateValue = lastRow.cells[8].textContent;
        } else {
            lotNumber = await getNextLotNumber();
        }

        newRow.innerHTML = `
            <td></td>
            <td contenteditable="true" class="product-name-cell"></td>
            <td></td>
            <td contenteditable="true">LC</td>
            <td contenteditable="true"></td>
            <td contenteditable="true">${lotNumber}</td>
            <td><input type="date" value="${dateStored}"></td>
            <td><input type="text" value="${containerNumber}"></td>
            <td>${palletDueDateValue}</td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
        `;

        stockInTableBody.appendChild(newRow);

        newRow.querySelector('.product-name-cell').addEventListener('click', (e) => {
            showProductSearch(e.target);
        });

        const dateStoredInput = newRow.querySelector('input[type="date"]');
        if (dateStoredInput) {
            dateStoredInput.addEventListener('change', (e) => {
                const newDate = new Date(e.target.value);
                newDate.setDate(newDate.getDate() + 29);
                const palletDueDateCell = newRow.cells[8];
                palletDueDateCell.textContent = newDate.toLocaleDateString('en-GB');
            });
        }
    };

    let isUpdating = false;
    const updateInventoryRow = async (row) => {
        if (isUpdating) return;
        isUpdating = true;

        const inventoryId = row.dataset.inventoryId;
        if (!inventoryId) {
            console.error('No inventory ID found for this row.');
            isUpdating = false;
            return;
        }

        try {
            const { data: existingItem, error: fetchError } = await supabaseClient
                .from('inventory')
                .select('details')
                .eq('id', inventoryId)
                .single();

            if (fetchError) throw fetchError;

            const existingDetails = existingItem.details || {};

            const updatedData = {
                details: {
                    ...existingDetails,
                    lotNumber: row.cells[3].textContent,
                    pallet_due_date: row.cells[7].textContent,
                    dateStored: row.cells[5].querySelector('input').value,
                },
                batch_no: row.cells[4].textContent,
                container: row.cells[6].textContent,
            };

            const { error: updateError } = await supabaseClient
                .from('inventory')
                .update(updatedData)
                .eq('id', inventoryId);

            if (updateError) throw updateError;

            alert('Record updated successfully.');
            row.querySelectorAll('td').forEach(cell => {
                cell.contentEditable = false;
            });

        } catch (error) {
            console.error('Error updating inventory record:', error);
            alert('Error updating record.');
        } finally {
            isUpdating = false;
        }
    };

    const showProductSearch = async (cell) => {
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('item_code, product_name, packing_size')
            .eq('type', 'Surimi');

        if (error) {
            console.error('Error fetching products:', error);
            alert('Error fetching products.');
            return;
        }

        const searchContainer = document.createElement('div');
        searchContainer.className = 'product-search-container';
        searchContainer.style.position = 'absolute';
        searchContainer.style.background = 'white';
        searchContainer.style.border = '1px solid #ccc';
        searchContainer.style.zIndex = '1000';
        searchContainer.style.maxHeight = '200px';
        searchContainer.style.overflowY = 'auto';

        const cellRect = cell.getBoundingClientRect();
        searchContainer.style.left = `${cellRect.left}px`;
        searchContainer.style.top = `${cellRect.bottom}px`;

        const productList = document.createElement('ul');
        products.forEach(product => {
            const listItem = document.createElement('li');
            listItem.textContent = product.product_name;
            listItem.style.padding = '8px';
            listItem.style.cursor = 'pointer';
            listItem.addEventListener('mouseover', () => {
                listItem.style.backgroundColor = '#f0f0f0';
            });
            listItem.addEventListener('mouseout', () => {
                listItem.style.backgroundColor = 'white';
            });
            listItem.addEventListener('click', () => {
                const row = cell.closest('tr');
                row.cells[0].textContent = product.item_code;
                cell.textContent = product.product_name;
                row.cells[2].textContent = product.packing_size;
                document.body.removeChild(searchContainer);
            });
            productList.appendChild(listItem);
        });

        searchContainer.appendChild(productList);
        document.body.appendChild(searchContainer);

        // Close the dropdown if user clicks outside of it
        const clickOutsideHandler = (event) => {
            if (searchContainer.parentNode && !searchContainer.contains(event.target) && event.target !== cell) {
                document.body.removeChild(searchContainer);
                document.removeEventListener('click', clickOutsideHandler);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', clickOutsideHandler);
        }, 0);
    };

    const submitStockIn = async () => {
        const stockInTableBody = document.querySelector('#singlong-stock-in-table tbody');
        const rows = stockInTableBody.querySelectorAll('tr');

        if (rows.length === 0) {
            alert('No items to submit.');
            return;
        }

        const operator_id = getCookie('userName') || 'unknown';

        try {
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                const item_code = cells[0].textContent;
                const batch_no = cells[4].textContent;
                const lotNumber = cells[5].textContent;
                const dateStored = cells[6].querySelector('input').value;
                const container = cells[7].querySelector('input').value;
                const palletDueDate = cells[8].textContent;
                const quantity = parseInt(cells[9].textContent) || 0;
                const pallet = parseInt(cells[10].textContent) || 0;
                const remark = cells[11].textContent;

                if (!item_code || !lotNumber || !quantity || !pallet) {
                    alert('Please ensure Item Code, Lot Number, Quantity, and Pallet are filled for all rows.');
                    return;
                }

                const { data: inventoryData, error: inventoryError } = await supabaseClient
                    .from('inventory')
                    .insert({
                        item_code: item_code,
                        warehouse_id: warehouseId,
                        batch_no: batch_no,
                        quantity: quantity,
                        container: container,
                        details: {
                            pallet: pallet,
                            lotNumber: lotNumber,
                            dateStored: dateStored,
                            pallet_due_date: palletDueDate,
                            remark: remark,
                        }
                    })
                    .select()
                    .single();

                if (inventoryError) throw new Error(`Error inserting into inventory: ${inventoryError.message}`);

                const { error: transactionError } = await supabaseClient
                    .from('transactions')
                    .insert({
                        inventory_id: inventoryData.id,
                        transaction_type: 'Container Unload',
                        quantity: quantity,
                        item_code: item_code,
                        warehouse_id: warehouseId,
                        transaction_date: dateStored,
                        inventory_details: {
                            pallet: pallet,
                            lotNumber: lotNumber,
                            batch_no: batch_no,
                            container: container,
                        },
                        operator_id: operator_id,
                    });

                if (transactionError) throw new Error(`Error inserting into transactions: ${transactionError.message}`);
            }

            const { data: lastOrder, error: orderError } = await supabaseClient
                .from('scheduled_transactions')
                .select('order_number')
                .like('order_number', 'LCSLIN-%')
                .order('order_number', { ascending: false })
                .limit(1)
                .single();

            let newOrderNumber;
            if (orderError && orderError.code !== 'PGRST116') { // Ignore 'not found' error
                throw orderError;
            }
            if (!lastOrder) {
                newOrderNumber = 'LCSLIN-0001';
            } else {
                const lastNumber = parseInt(lastOrder.order_number.split('-')[1]);
                newOrderNumber = `LCSLIN-${(lastNumber + 1).toString().padStart(4, '0')}`;
            }

            const stockInItemsForPrint = [];
            let firstDateStored = '';
            rows.forEach((row, index) => {
                const cells = row.querySelectorAll('td');
                if (index === 0) {
                    firstDateStored = cells[6].querySelector('input').value;
                }
                stockInItemsForPrint.push({
                    productName: cells[1].textContent,
                    packingSize: cells[2].textContent,
                    batchNo: cells[4].textContent,
                    lotNumber: cells[5].textContent,
                    quantity: cells[9].textContent,
                    pallet: cells[10].textContent,
                });
            });

            const { error: insertError } = await supabaseClient
                .from('scheduled_transactions')
                .insert({
                    order_number: newOrderNumber,
                    draw_out_date: firstDateStored,
                    draw_out_time: '00:00:00',
                    warehouse_id: 'singlong',
                    stock_out_items: stockInItemsForPrint,
                    operator_id: operator_id,
                    status: 'done'
                });

            if (insertError) {
                throw insertError;
            }

            alert(`Stock in successfully recorded with order number: ${newOrderNumber}`);

            const printHtml = generateStockInPrintHTML(newOrderNumber, new Date(), stockInItemsForPrint);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(printHtml);
            printWindow.document.close();
            printWindow.print();

            stockInTableBody.innerHTML = ''; // Clear the table after successful submission
            loadInventoryData(); // Refresh inventory summary
        } catch (error) {
            console.error('Error submitting stock in:', error);
            alert(`Error submitting stock in: ${error.message}`);
        }
    };

    const stockInSubmitButton = document.getElementById('submit-stock-in-btn');
    if (stockInSubmitButton) {
        stockInSubmitButton.addEventListener('click', submitStockIn);
    }
};

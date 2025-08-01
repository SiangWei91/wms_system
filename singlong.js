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
                .eq('warehouse_id', warehouseId);

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

                const cells = row.cells;
                const itemCode = cells[0].textContent;
                const productName = cells[1].textContent;
                const packingSize = cells[2].textContent;
                const lotNumber = cells[3].textContent;
                const currentQuantity = cells[8].textContent;
                const currentPallet = cells[9].textContent;

                modal.setAttribute('data-current-warehouse', 'singlong');
                modalBody.innerHTML = `
                    <div class="form-group">
                        <label>Date:</label>
                        <input type="date" id="singlong-stock-out-date" value="${getDefaultStockOutDate()}">
                    </div>
                    <p><strong>Item Code:</strong> ${itemCode}</p>
                    <p><strong>Product Name:</strong> ${productName}</p>
                    <p><strong>Packaging Size:</strong> ${packingSize}</p>
                    <p><strong>Lot Number:</strong> ${lotNumber}</p>
                    <p><strong>Current Quantity:</strong> ${currentQuantity}</p>
                    <p><strong>Current Pallet:</strong> ${currentPallet}</p>
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

    const handleModalSubmit = (e) => {
        const modalBody = document.getElementById('jordon-modal-body');
        const stockOutTableBody = document.querySelector('#singlong-stock-out-table tbody');

        const productName = modalBody.querySelector('p:nth-child(3)').textContent.replace('Product Name: ', '');
        const packingSize = modalBody.querySelector('p:nth-child(4)').textContent.replace('Packaging Size: ', '');
        const lotNumber = modalBody.querySelector('p:nth-child(5)').textContent.replace('Lot Number: ', '');
        const quantity = document.getElementById('singlong-stock-out-quantity').value;
        const pallet = document.getElementById('singlong-stock-out-pallet').value;

        if (quantity > 0 || pallet > 0) {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${productName}</td>
                <td>${packingSize}</td>
                <td></td>
                <td></td>
                <td>${lotNumber}</td>
                <td>${quantity}</td>
                <td>${pallet}</td>
                <td><button class="remove-stock-out-btn" style="background: transparent; color: red; border: none; font-size: 1.2rem; cursor: pointer;">&times;</button></td>
            `;
            stockOutTableBody.appendChild(newRow);
            addRemoveStockOutListeners();
        }

        document.getElementById('modal-container').style.display = 'none';
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

    const stockOutSubmitButton = document.querySelector(`#${warehouseId}-submit-stock-out-btn`);
    if (stockOutSubmitButton) {
        stockOutSubmitButton.addEventListener('click', () => {
            console.log('Submit button clicked for singlong');
            alert('Submit functionality for Sing Long is not yet implemented.');
        });
    }

    loadInventoryData();
    initTabs();
};

const generateJordonPrintHTML = (order_number, draw_out_date, draw_out_time, items) => {
  const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') {
      unsafe = String(unsafe);
    }
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const tableRowsHtml = items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${escapeHtml(item.packing_size)}</td>
      <td>${escapeHtml(item.location)}</td>
      <td>${escapeHtml(item.lot_number)}</td>
      <td>${escapeHtml(item.withdraw_pallet)}</td>
      <td>${escapeHtml(item.withdraw_quantity)}</td>
      <td>${escapeHtml(item.batch_no)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Jordon Withdraw Form - ${escapeHtml(order_number)}</title>
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
                font-size: 10pt; /* Smaller font size for table */
            }
            th, td {
                border: 1px solid black;
                padding: 6px; /* Reduced padding for smaller text */
                text-align: left;
            }
            th {
                background-color: #f2f2f2;
                font-size: 10pt; /* Match header font size with table */
            }
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
                text-align: center;
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
            .withdraw-date-styled {
                font-weight: bold;
                font-size: 14pt;
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
                        <p class="bold">S/N: ${escapeHtml(order_number)}</p>
                    </div>
                </div>
                <div class="date-container">
                    <p class="date">Withdraw Date: ${new Date(draw_out_date).toLocaleDateString('en-GB')}</p>
                </div>
                <p class="attn">Attn: Jordon Food Industries Pte Ltd</p>
                <p>13 Woodlands Loop, Singapore 738284</p>
                <p>Tel: +65 6551 5083 Fax: +65 6257 8660</p>
                <p class="right-align"><span class="bold">Collection Time: ${escapeHtml(draw_out_time)}</span></p>
            </div>
            <h2>Jordon Withdraw Form</h2>
            <table>
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Product Name</th>
                        <th>Packing Size</th>
                        <th>Loc</th> <!-- Changed from "Location" to "Loc" -->
                        <th>Lot No</th>
                        <th>Plts</th>
                        <th>Qty</th> <!-- Changed from "Quantity" to "Qty" -->
                        <th>Batch No</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
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
};

(() => {
  window.createWarehousePage = (warehouseId, supabaseClient) => {
    let eventController = null;
    
    // 为每个仓库创建独立的 stock out 数据存储
    const STOCK_OUT_KEY = `stockOut_${warehouseId}`;

    // 保存 Stock Out 数据到内存
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
      
      // 存储到 window 对象中（会话级别持久化）
      if (!window.warehouseStockOutData) {
        window.warehouseStockOutData = {};
      }
      window.warehouseStockOutData[STOCK_OUT_KEY] = stockOutData;
    };

    // 从内存加载 Stock Out 数据
    const loadStockOutData = () => {
      const stockOutTableBody = document.querySelector(`#${warehouseId}-stock-out-table tbody`);
      if (!stockOutTableBody) return;
      
      if (window.warehouseStockOutData && window.warehouseStockOutData[STOCK_OUT_KEY]) {
        const stockOutData = window.warehouseStockOutData[STOCK_OUT_KEY];
        
        // 清空现有数据
        stockOutTableBody.innerHTML = '';
        
        // 重新添加保存的数据
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
        
        // 为删除按钮添加事件监听器
        addRemoveStockOutListeners();
      }
    };

    // 添加 Stock Out 行删除功能
    const addRemoveStockOutListeners = () => {
      const removeButtons = document.querySelectorAll(`#${warehouseId}-stock-out-table .remove-stock-out-btn`);
      removeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          if (confirm('确定要删除这条 Stock Out 记录吗？')) {
            e.target.closest('tr').remove();
            saveStockOutData(); // 删除后保存数据
          }
        });
      });
    };

    // 清空 Stock Out 数据的函数
    const clearStockOutData = () => {
      const stockOutTableBody = document.querySelector(`#${warehouseId}-stock-out-table tbody`);
      if (stockOutTableBody) {
        stockOutTableBody.innerHTML = '';
      }
      
      // 清除存储的数据
      if (window.warehouseStockOutData) {
        delete window.warehouseStockOutData[STOCK_OUT_KEY];
      }
    };

    let threePLWarehouses = [];

    const loadInventoryData = async () => {
      console.log('Loading inventory data...');
      try {
        // 清理之前的事件监听器
        if (eventController) {
          eventController.abort();
        }
        // 创建新的 AbortController
        eventController = new AbortController();
        const signal = eventController.signal;

        const { data: warehouses, error: warehousesError } = await supabaseClient
          .from('warehouses')
          .select('warehouse_id, name')
          .like('details', '%for_3pl_list%');

        if (warehousesError) {
          throw warehousesError;
        }
        threePLWarehouses = warehouses;

        let query = supabaseClient
          .from('inventory')
          .select('*')
          .eq('warehouse_id', warehouseId);

        if (warehouseId === 'jordon') {
          query = query.order('details->>dateStored', { ascending: true }).order('details->>lotNumber', { ascending: true });
        } else if (warehouseId === 'lineage') {
          query = query.order('details->>dateStored', { ascending: true }).order('item_code', { ascending: true });
        }

        const { data: inventoryData, error: inventoryError } = await query;

        if (inventoryError) {
          throw inventoryError;
        }

        const { data: productsData, error: productsError } = await supabaseClient
          .from('products')
          .select('item_code, product_name, packing_size');

        if (productsError) {
          throw productsError;
        }

        const productsMap = new Map(productsData.map(p => [p.item_code, p]));

        const inventorySummaryTable = document.querySelector(`#${warehouseId}-inventory-summary-table`);
        if (inventorySummaryTable && !document.getElementById(`${warehouseId}-search-container`)) {
            const searchContainer = document.createElement('div');
            searchContainer.id = `${warehouseId}-search-container`;
            searchContainer.style.marginBottom = '20px';
            searchContainer.innerHTML = `<input type="text" id="${warehouseId}-search-input" placeholder="Search..." style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">`;
            inventorySummaryTable.parentNode.insertBefore(searchContainer, inventorySummaryTable);
        }

        const inventorySummaryTableBody = document.querySelector(`#${warehouseId}-inventory-summary-table tbody`);
        const stockInTableBody = document.querySelector(`#${warehouseId}-stock-in-table tbody`);

        if (!inventorySummaryTableBody || !stockInTableBody) {
          console.error(`Table bodies not found for ${warehouseId}`);
          return;
        }

        inventorySummaryTableBody.innerHTML = '';
        stockInTableBody.innerHTML = '';

        let summaryTotalQuantity = 0;
        let summaryTotalPallet = 0;
        let stockInTotalQuantity = 0;
        let stockInTotalPallet = 0;

        inventoryData.filter(item => item.quantity > 0).forEach(item => {
          const product = productsMap.get(item.item_code) || {};
          const row = document.createElement('tr');

          if (item.details.status === 'Pending') {
            if (warehouseId === 'jordon') {
              row.innerHTML = `
                <td>${item.item_code}</td>
                <td>${product.product_name || ''}</td>
                <td>${product.packing_size || ''}</td>
                <td><input type="text" class="short-input" value="LC"></td>
                <td><input type="text" class="short-input" value="LC01"></td>
                <td>${item.batch_no}</td>
                <td><input type="text" class="lot-number-input" value="${item.details.lotNumber}"></td>
                <td>${item.details.dateStored}</td>
                <td>${item.container}</td>
                <td>${item.quantity}</td>
                <td>${item.details.pallet}</td>
                <td><input type="text" class="short-input" value=""></td>
                <td><button class="delete-btn" data-id="${item.id}">&times;</button></td>
              `;
            } else if (warehouseId === 'lineage') {
              row.innerHTML = `
                <td>${item.item_code}</td>
                <td>${product.product_name || ''}</td>
                <td>${product.packing_size || ''}</td>
                <td><input type="text" class="short-input" value="LLM"></td>
                <td><input type="text" class="location-input short-input" value=""></td>
                <td>${item.batch_no}</td>
                <td>${item.details.llm_item_code || ''}</td>
                <td>${item.details.dateStored}</td>
                <td>${item.container}</td>
                <td>${item.quantity}</td>
                <td>${item.details.pallet}</td>
                <td><input type="text" class="short-input" value=""></td>
                <td><button class="delete-btn" data-id="${item.id}">&times;</button></td>
              `;
            }
            stockInTableBody.appendChild(row);
            stockInTotalQuantity += item.quantity;
            stockInTotalPallet += Number(item.details.pallet);
          } else {
            if (warehouseId === 'jordon') {
              row.innerHTML = `
                <td>${item.item_code}</td>
                <td>${product.product_name || ''}</td>
                <td>${product.packing_size || ''}</td>
                <td>${item.details.palletType}</td>
                <td>${item.details.location}</td>
                <td>${item.batch_no}</td>
                <td>${item.details.lotNumber}</td>
                <td>${item.details.dateStored}</td>
                <td>${item.container}</td>
                <td>${item.quantity}</td>
                <td>${item.details.pallet}</td>
                <td>${item.details.mixPallet || ''}</td>
              `;
            } else if (warehouseId === 'lineage') {
              row.innerHTML = `
                <td>${item.item_code}</td>
                <td>${product.product_name || ''}</td>
                <td>${product.packing_size || ''}</td>
                <td>${item.details.palletType}</td>
                <td>${item.details.location}</td>
                <td>${item.batch_no}</td>
                <td>${item.details.llm_item_code || ''}</td>
                <td>${item.details.dateStored}</td>
                <td>${item.container}</td>
                <td>${item.quantity}</td>
                <td>${item.details.pallet}</td>
                <td>${item.details.mixPallet || ''}</td>
              `;
            }
            inventorySummaryTableBody.appendChild(row);
            summaryTotalQuantity += item.quantity;
            summaryTotalPallet += Number(item.details.pallet);
          }
        });

        const attachEventListeners = () => {
            console.log('Attaching event listeners...');
            inventorySummaryTableBody.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const row = e.target.closest('tr');
                if (!row) return;

                console.log('Context menu event triggered');
                row.querySelectorAll('td').forEach(cell => {
                    cell.contentEditable = true;
                });
                row.focus();
            }, { signal });

            inventorySummaryTableBody.addEventListener('keydown', async (e) => {
                const row = e.target.closest('tr');
                if (!row || e.key !== 'Enter') return;

                console.log('Enter key pressed');
                row.querySelectorAll('td').forEach(cell => {
                    cell.contentEditable = false;
                });

                row.style.backgroundColor = '#f0f0f0';

                try {
                    const rowIndex = Array.from(inventorySummaryTableBody.children).indexOf(row);
                    const filteredData = inventoryData.filter(item => item.quantity > 0 && item.details.status !== 'Pending');
                    const item = filteredData[rowIndex];

                    if (!item) {
                        throw new Error('Could not find the item to update.');
                    }

                    const updatedData = {
                        item_code: row.cells[0].textContent,
                        details: {
                            ...item.details,
                            palletType: row.cells[3].textContent,
                            location: row.cells[4].textContent,
                            lotNumber: warehouseId === 'jordon' ? row.cells[6].textContent : item.details.lotNumber,
                            llm_item_code: warehouseId === 'lineage' ? row.cells[6].textContent : item.details.llm_item_code,
                            dateStored: row.cells[7].textContent,
                            mixPallet: row.cells[11].textContent,
                            pallet: parseInt(row.cells[10].textContent),
                        },
                        quantity: parseInt(row.cells[9].textContent),
                        container: row.cells[8].textContent,
                        batch_no: row.cells[5].textContent,
                    };

                    console.log('Updating record with data:', updatedData);

                    const { error } = await supabaseClient
                        .from('inventory')
                        .update(updatedData)
                        .eq('id', item.id);

                    if (error) {
                        throw error;
                    }

                    console.log('Record updated successfully');
                    await loadInventoryData();
                } catch (error) {
                    console.error('Error updating record:', error);
                    alert(`Error updating record: ${error.message}`);
                    row.style.backgroundColor = '';
                }
            }, { signal });

            inventorySummaryTableBody.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (!row) return;

                const modal = document.querySelector('.jordon-withdrawal-modal');
                const modalBody = document.getElementById('jordon-modal-body');
                if (!modal || !modalBody) return;

                modal.setAttribute('data-current-warehouse', warehouseId);
                modalBody.innerHTML = '';

                const rowIndex = Array.from(inventorySummaryTableBody.children).indexOf(row);
                const filteredData = inventoryData.filter(item => item.quantity > 0 && item.details.status !== 'Pending');
                const item = filteredData[rowIndex];

                if (!item) return;

                const mixPallet = item.details.mixPallet;
                const dateStored = item.details.dateStored;

                let itemsToShow = [item];
                if (mixPallet) {
                    itemsToShow = inventoryData.filter(i => i.details.mixPallet === mixPallet && i.details.dateStored === dateStored);
                }

                if (itemsToShow.length > 1) {
                    modal.classList.add('wide');
                } else {
                    modal.classList.remove('wide');
                }

                itemsToShow.forEach((itemToShow, itemIndex) => {
                    const product = productsMap.get(itemToShow.item_code) || {};
                    const itemElement = document.createElement('div');
                    itemElement.dataset.itemCode = itemToShow.item_code;
                    itemElement.innerHTML = `
                        <p><strong>Product Name:</strong> ${product.product_name || ''}</p>
                        <p><strong>Packing Size:</strong> ${product.packing_size || ''}</p>
                        <p><strong>Batch No:</strong> ${itemToShow.batch_no}</p>
                        <p><strong>Location:</strong> ${itemToShow.details.location}</p>
                        <p><strong>${warehouseId === 'lineage' ? 'LLM Item Code:' : 'Lot Number:'}</strong> ${warehouseId === 'lineage' ? (itemToShow.details.llm_item_code || '') : (itemToShow.details.lotNumber || '')}</p>
                        <p><strong>Current Quantity:</strong> ${itemToShow.quantity}</p>
                        <p><strong>Current Pallet:</strong> ${itemToShow.details.pallet}</p>
                        <div class="form-group">
                            <label>Withdraw Quantity:</label>
                            <input type="number" class="withdraw-quantity" min="0" data-item-id="${itemToShow.id}">
                        </div>
                        <div class="form-group">
                            <label>Withdraw Pallet:</label>
                            <input type="number" class="withdraw-pallet" min="0" data-item-id="${itemToShow.id}">
                        </div>
                        <hr>
                    `;
                    modalBody.appendChild(itemElement);

                    if (itemIndex === 0) {
                        const firstInput = itemElement.querySelector('.withdraw-quantity');
                        if (firstInput) {
                            firstInput.focus();
                        }
                    }
                });

                modal.classList.add('active');
            }, { signal });
        }

        attachEventListeners();

        // 更新摘要表的页脚
        const summaryFooter = document.querySelector(`#${warehouseId}-inventory-summary-table tfoot`);
        if (summaryFooter) {
          summaryFooter.innerHTML = `
            <tr>
              <td colspan="9">Total:</td>
              <td>${summaryTotalQuantity}</td>
              <td>${summaryTotalPallet}</td>
            </tr>
          `;
        }

        // 应用存储的混合托盘颜色
        const summaryData = inventoryData.filter(item => item.quantity > 0 && item.details.status !== 'Pending');
        inventorySummaryTableBody.querySelectorAll('tr').forEach((row, index) => {
            const item = summaryData[index];
            if (item && item.details.mixPalletColor) {
                row.cells[9].style.backgroundColor = item.details.mixPalletColor;
                row.cells[10].style.backgroundColor = item.details.mixPalletColor;
            }
            row.cells[11].style.display = 'none';
        });

        // 更新库存入库表的页脚
        const stockInFooter = document.querySelector(`#${warehouseId}-stock-in-table tfoot`);
        if (stockInFooter) {
          stockInFooter.innerHTML = `
            <tr>
              <td colspan="10">Total:</td>
              <td>${stockInTotalQuantity}</td>
              <td>${stockInTotalPallet}</td>
              <td></td>
            </tr>
          `;
        }

        // 为删除按钮添加事件监听器
        stockInTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('.delete-btn');
            if (!button) return;

            const id = button.dataset.id;
            const { data: inventoryItem, error: fetchError } = await supabaseClient
                .from('inventory')
                .select('item_code, batch_no')
                .eq('id', id)
                .single();

            if (fetchError) {
                console.error('Error fetching item for deletion:', fetchError);
                return;
            }

            const { error: transactionError } = await supabaseClient
                .from('transactions')
                .delete()
                .match({ item_code: inventoryItem.item_code, batch_no: inventoryItem.batch_no, warehouse_id: warehouseId });

            if (transactionError) {
                console.error('Error deleting transaction:', transactionError);
            }

            const { error: inventoryError } = await supabaseClient
                .from('inventory')
                .delete()
                .eq('id', id);

            if (inventoryError) {
                console.error('Error deleting item:', inventoryError);
            } else {
                loadInventoryData();
            }
        }, { signal });

        // 处理 lineage 仓库的位置输入同步
        if (warehouseId === 'lineage') {
          const locationInputs = document.querySelectorAll('.location-input');
          if (locationInputs.length > 0) {
            locationInputs[0].addEventListener('input', (e) => {
              const firstLocation = e.target.value;
              for (let i = 1; i < locationInputs.length; i++) {
                locationInputs[i].value = firstLocation;
              }
            }, { signal });
          }
        } else if (warehouseId === 'jordon') {
          // 处理 jordon 仓库的批号输入同步
          const lotNumberInputs = document.querySelectorAll('.lot-number-input');
          if (lotNumberInputs.length > 0) {
            lotNumberInputs[0].addEventListener('input', (e) => {
              const firstLotNumber = e.target.value;
              const numericPart = firstLotNumber.replace(/[^0-9]/g, '');
              for (let i = 1; i < lotNumberInputs.length; i++) {
                lotNumberInputs[i].value = numericPart;
              }
            }, { signal });
          }
        }

        // 处理模态框事件 - 只为当前仓库绑定一次
        const modal = document.querySelector('.jordon-withdrawal-modal');
        if (modal) {
          const closeButton = document.getElementById('jordon-modal-close-button');
          const modalSubmitButton = document.getElementById('modal-submit-btn');

          // 关闭模态框
          const handleModalClose = () => {
            modal.classList.remove('active');
          };

          // 键盘事件处理 - 添加仓库验证
          const handleModalKeydown = (e) => {
            if (e.key === 'Enter') {
              // 只有当前仓库匹配时才处理事件
              const currentWarehouse = modal.getAttribute('data-current-warehouse');
              if (currentWarehouse === warehouseId) {
                modalSubmitButton.click();
              }
            }
          };

          // 模态框提交处理函数 - 添加仓库验证
          const handleModalSubmit = (e) => {
            // 只有当前仓库匹配时才处理事件
            const currentWarehouse = modal.getAttribute('data-current-warehouse');
            if (currentWarehouse !== warehouseId) {
              return;
            }

            // 防止重复提交
            if (e.target.disabled) {
              return;
            }

            // 临时禁用按钮防止重复点击
            e.target.disabled = true;
            setTimeout(() => {
              e.target.disabled = false;
            }, 1000);

            const stockOutTableBody = document.querySelector(`#${warehouseId}-stock-out-table tbody`);
            const withdrawalItems = document.querySelectorAll('#jordon-modal-body > div');
            let errorShown = false;

            if (stockOutTableBody) {
              withdrawalItems.forEach(itemElement => {
                if (errorShown) return;

                const productName = itemElement.querySelector('p:nth-child(1)').textContent.replace('Product Name: ', '');
                const packingSize = itemElement.querySelector('p:nth-child(2)').textContent.replace('Packing Size: ', '');
                const batchNo = itemElement.querySelector('p:nth-child(3)').textContent.replace('Batch No: ', '');
                const location = itemElement.querySelector('p:nth-child(4)').textContent.replace('Location: ', '');
                const lotNumberText = itemElement.querySelector('p:nth-child(5)').textContent;
                const lotNumber = lotNumberText.includes('LLM Item Code:')
                  ? lotNumberText.replace('LLM Item Code: ', '')
                  : lotNumberText.replace('Lot Number: ', '');

                const currentQuantity = Number(itemElement.querySelector('p:nth-child(6)').textContent.replace('Current Quantity: ', ''));
                const currentPallet = Number(itemElement.querySelector('p:nth-child(7)').textContent.replace('Current Pallet: ', ''));

                const withdrawQuantityInput = itemElement.querySelector('.withdraw-quantity');
                const withdrawPalletInput = itemElement.querySelector('.withdraw-pallet');
                const withdrawQuantity = Number(withdrawQuantityInput.value);
                const withdrawPallet = Number(withdrawPalletInput.value);

                if (withdrawQuantity > 0 || withdrawPallet > 0) {
                  if (withdrawQuantity > currentQuantity) {
                    alert(`Withdraw quantity for ${productName} cannot be greater than current quantity.`);
                    errorShown = true;
                    return;
                  }

                  if (withdrawPallet > currentPallet) {
                    alert(`Withdraw pallet for ${productName} cannot be greater than current pallet.`);
                    errorShown = true;
                    return;
                  }

                  const newRow = document.createElement('tr');
                  const warehouseOptions = threePLWarehouses.map(w => `<option value="${w.warehouse_id}">${w.name}</option>`).join('');
                  newRow.innerHTML = `
                    <td style="display:none;">${itemElement.dataset.itemCode}</td>
                    <td style="display:none;">${withdrawQuantityInput.dataset.itemId}</td>
                    <td>${productName}</td>
                    <td>${packingSize}</td>
                    <td>${batchNo}</td>
                    <td>${location}</td>
                    <td>${lotNumber}</td>
                    <td>${withdrawQuantity}</td>
                    <td>${withdrawPallet}</td>
                    <td><select class="transfer-to-select">${warehouseOptions}</select></td>
                    <td><button class="remove-stock-out-btn" style="background: #ff4444; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">&times;</button></td>
                  `;
                  stockOutTableBody.appendChild(newRow);
                }
              });
              
              // 添加新行后保存数据并绑定删除事件
              saveStockOutData();
              addRemoveStockOutListeners();
            }

            if (!errorShown) {
              modal.classList.remove('active');
            }
          };

          // Add a single listener for the modal
          modal.addEventListener('click', (e) => {
              if (e.target.id === 'jordon-modal-close-button' || e.target.closest('.close-button')) {
                  handleModalClose();
              } else if (e.target.id === 'modal-submit-btn') {
                  handleModalSubmit(e);
              }
          });
          modal.addEventListener('keydown', handleModalKeydown, { signal });
        }

        // 处理提交按钮事件
        const submitButton = document.querySelector(`#${warehouseId}-submit-btn`);
        if (submitButton) {
          submitButton.addEventListener('click', async () => {
            const stockInRows = stockInTableBody.querySelectorAll('tr');
            const updates = [];
            let validationError = false;
            const mixPalletColors = {};

            for (const row of stockInRows) {
              const id = row.querySelector('.delete-btn').dataset.id;
              const palletType = row.querySelector('input[type="text"]').value;
              const location = row.querySelector('.location-input, .lot-number-input').value;
              const mixPallet = row.cells[11].querySelector('.short-input').value;
              const pallet = Number(row.cells[10].textContent);
              const dateStored = row.cells[7].textContent;

              if ((warehouseId === 'jordon' && !location) || (warehouseId === 'lineage' && !location)) {
                validationError = true;
                alert('Please fill in all Lot Numbers or Locations.');
                break;
              }

              if (pallet === 0 && !mixPallet) {
                validationError = true;
                alert('Please fill in the Mix Pallet for rows with 0 pallet.');
                break;
              }

              const { data: existingItem, error: fetchError } = await supabaseClient
                .from('inventory')
                .select('details')
                .eq('id', id)
                .single();

              if (fetchError) {
                console.error('Error fetching existing item:', fetchError);
                alert('Error fetching existing item.');
                validationError = true;
                break;
              }

              const updatedDetails = {
                ...existingItem.details,
                palletType,
                status: 'Complete',
                mixPallet,
              };

              if (mixPallet) {
                const key = `${mixPallet}-${dateStored}`;
                if (!mixPalletColors[key]) {
                  mixPalletColors[key] = `hsl(${Math.random() * 360}, 100%, 90%)`;
                }
                updatedDetails.mixPalletColor = mixPalletColors[key];
              }

              if (warehouseId === 'jordon') {
                updatedDetails.lotNumber = row.querySelector('.lot-number-input').value;
                updatedDetails.location = row.querySelector('.short-input[value="LC01"]').value;
              } else {
                updatedDetails.location = location;
              }

              updates.push({
                id,
                details: updatedDetails,
              });
            }

            if (validationError) {
              return;
            }

            const { error: inventoryError } = await supabaseClient
              .from('inventory')
              .upsert(updates);

            if (inventoryError) {
              console.error('Error updating inventory records:', inventoryError);
              alert('Error submitting records to inventory.');
              return;
            }

            const transactionUpdates = updates.map(item => ({
              inventory_id: item.id,
              inventory_details: item.details
            }));

            for (const tu of transactionUpdates) {
                const { error: transactionError } = await supabaseClient
                    .from('transactions')
                    .update({ inventory_details: tu.inventory_details })
                    .eq('inventory_id', tu.inventory_id);

                if (transactionError) {
                    console.error('Error updating transaction record:', transactionError);
                    alert(`Error updating transaction for inventory ID ${tu.inventory_id}.`);
                }
            }

            alert('Records submitted successfully.');
            loadInventoryData();
          }, { signal });
        }

        // 在数据加载完成后，恢复 Stock Out 数据
        loadStockOutData();

        const searchInput = document.getElementById(`${warehouseId}-search-input`);
        if (searchInput) {
            searchInput.addEventListener('keyup', () => {
                const searchTerm = searchInput.value.toLowerCase();
                const tableRows = document.querySelectorAll(`#${warehouseId}-inventory-summary-table tbody tr`);
                tableRows.forEach(row => {
                    const itemCode = row.cells[0].textContent.toLowerCase();
                    const productName = row.cells[1].textContent.toLowerCase();
                    const lotNumber = row.cells[6].textContent.toLowerCase();
                    const container = row.cells[8].textContent.toLowerCase();

                    if (itemCode.includes(searchTerm) || productName.includes(searchTerm) || lotNumber.includes(searchTerm) || container.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }, { signal });
        }
        
        // 添加清空 Stock Out 按钮（可选）
        const addClearStockOutButton = () => {
          const stockOutTable = document.querySelector(`#${warehouseId}-stock-out-table`);
          if (stockOutTable && !document.querySelector(`#${warehouseId}-clear-stock-out-btn`)) {
            const clearButton = document.createElement('button');
            clearButton.id = `${warehouseId}-clear-stock-out-btn`;
            clearButton.textContent = 'Clear All Stock Out Records';
            clearButton.style.cssText = 'background: #ff6b6b; color: white; border: none; padding: 8px 16px; margin: 10px 0; border-radius: 4px; cursor: pointer;';
            
            clearButton.addEventListener('click', () => {
              if (confirm('确定要清空所有 Stock Out 记录吗？此操作不可撤销。')) {
                clearStockOutData();
              }
            });
            
            stockOutTable.parentNode.insertBefore(clearButton, stockOutTable);
          }
        };
        
        addClearStockOutButton();
        
      } catch (error) {
        console.error('Error loading inventory data:', error);
      }
    };

    const initTabs = () => {
      const tabLinks = document.querySelectorAll(`.${warehouseId}-container .tab-button`);
      const tabPanes = document.querySelectorAll(`.${warehouseId}-container .tab-pane`);

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

              if (tab === 'report' && warehouseId === 'jordon') {
                  loadReprintForm();
              }
          });
      }
    };

    const loadReprintForm = async () => {
      const orderNumberSelect = document.getElementById('jordon-reprint-order-number');
      if (!orderNumberSelect) return;

      const { data, error } = await supabaseClient
        .from('scheduled_transactions')
        .select('order_number, draw_out_date')
        .eq('warehouse_id', 'jordon')
        .order('draw_out_date', { ascending: false });

      if (error) {
        console.error('Error fetching Jordon orders:', error);
        return;
      }

      orderNumberSelect.innerHTML = data.map(order => `<option value="${order.order_number}">${order.order_number} (${new Date(order.draw_out_date).toLocaleDateString('en-GB')})</option>`).join('');
    };

    const setDefaultDrawOutDateTime = () => {
      const dateInput = document.getElementById(`${warehouseId}-draw-out-date`);
      const timeInput = document.getElementById(`${warehouseId}-draw-out-time`);

      if (dateInput && timeInput) {
        const today = new Date();
        let tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (warehouseId === 'jordon') {
          if (tomorrow.getDay() === 0) { // Sunday
            tomorrow.setDate(tomorrow.getDate() + 2);
          }
        } else if (warehouseId === 'lineage') {
          if (tomorrow.getDay() === 6) { // Saturday
            tomorrow.setDate(tomorrow.getDate() + 3);
          } else if (tomorrow.getDay() === 0) { // Sunday
            tomorrow.setDate(tomorrow.getDate() + 2);
          }
        }

        dateInput.value = tomorrow.toISOString().split('T')[0];
        timeInput.value = '10:00';
      }
    };

    const handleConfirmDateOut = async () => {
      const drawOutDate = document.getElementById(`${warehouseId}-draw-out-date`).value;
      const drawOutTime = document.getElementById(`${warehouseId}-draw-out-time`).value;
      const stockOutTableBody = document.querySelector(`#${warehouseId}-stock-out-table tbody`);
      const rows = stockOutTableBody.querySelectorAll('tr');

      if (rows.length === 0) {
        alert('No items to withdraw.');
        return;
      }

      // Generate order number
      const prefix = warehouseId === 'jordon' ? 'LCJD' : 'LCMD';
      const { data: lastOrder, error: orderError } = await supabaseClient
        .from('scheduled_transactions')
        .select('order_number')
        .like('order_number', `${prefix}%`)
        .order('order_number', { ascending: false })
        .limit(1)
        .single();

      let newOrderNumber;
      if (orderError || !lastOrder) {
        newOrderNumber = `${prefix}-0001`;
      } else {
        const lastNumber = parseInt(lastOrder.order_number.split('-')[1]);
        newOrderNumber = `${prefix}-${(lastNumber + 1).toString().padStart(4, '0')}`;
      }

      // Prepare stock out items
      const stockOutItems = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const transferTo = row.querySelector('.transfer-to-select').value;
        stockOutItems.push({
          item_code: cells[0].textContent,
          inventory_id: cells[1].textContent,
          product_name: cells[2].textContent,
          packing_size: cells[3].textContent,
          batch_no: cells[4].textContent,
          location: cells[5].textContent,
          lot_number: cells[6].textContent,
          withdraw_quantity: parseInt(cells[7].textContent),
          withdraw_pallet: parseInt(cells[8].textContent),
          source_warehouse_id: warehouseId,
          destination_warehouse_id: transferTo,
        });
      });

      // Insert into scheduled_transactions
      const operator_id = getCookie('userName') || 'unknown';
      const { error: scheduledError } = await supabaseClient
        .from('scheduled_transactions')
        .insert({
          order_number: newOrderNumber,
          draw_out_date: drawOutDate,
          draw_out_time: drawOutTime,
          warehouse_id: warehouseId,
          stock_out_items: stockOutItems,
          operator_id: operator_id,
        });

      if (scheduledError) {
        console.error('Error creating scheduled transaction:', scheduledError);
        alert('Error creating scheduled transaction.');
        return;
      }

      // Clear stock out table
      clearStockOutData();
      alert(`Stock out scheduled with order number: ${newOrderNumber}`);

      // Generate and print Jordon form
      if (warehouseId === 'jordon') {
        const printHtml = generateJordonPrintHTML(newOrderNumber, drawOutDate, drawOutTime, stockOutItems);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.print();
      }
    };

    loadInventoryData().then(() => {
      initTabs();
      setDefaultDrawOutDateTime();
      const confirmButton = document.getElementById(`${warehouseId}-confirm-date-out-btn`);
      if (confirmButton) {
        confirmButton.addEventListener('click', handleConfirmDateOut);
      }

      if (confirmButton) {
        confirmButton.addEventListener('click', handleConfirmDateOut);
      }

      const reprintButton = document.getElementById('jordon-reprint-btn');
      if (reprintButton) {
        reprintButton.addEventListener('click', handleReprint);
      }

      const showReprintFormButton = document.getElementById('jordon-show-reprint-form-btn');
      if (showReprintFormButton) {
        showReprintFormButton.addEventListener('click', () => {
          const reprintFormContainer = document.getElementById('jordon-reprint-form-container');
          if (reprintFormContainer) {
            reprintFormContainer.style.display = reprintFormContainer.style.display === 'none' ? 'block' : 'none';
          }
        });
      }

      const inventoryTransactionReportBtn = document.getElementById('jordon-inventory-transaction-report-btn');
      if (inventoryTransactionReportBtn) {
        inventoryTransactionReportBtn.addEventListener('click', handleInventoryTransactionReport);
      }
    });

    const handleInventoryTransactionReport = async () => {
      const { data: snapshotDates, error: snapshotDatesError } = await supabaseClient
        .from('month_end_snapshot')
        .select('snapshot_date')
        .eq('warehouse_id', 'jordon');

      if (snapshotDatesError) {
        console.error('Error fetching snapshot dates:', snapshotDatesError);
        alert('Error fetching snapshot dates.');
        return;
      }

      const uniqueDates = [...new Set(snapshotDates.map(d => d.snapshot_date))].sort((a, b) => new Date(b) - new Date(a));

      const modalHTML = `
        <div id="report-modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1001;">
          <div style="background-color: white; padding: 20px; border-radius: 5px; width: 80%; max-width: 1200px; max-height: 90vh; overflow-y: auto;">
            <h2>Jordon Inventory Transaction Report</h2>
            <div class="form-group">
              <label for="snapshot-date-select">Select Snapshot Date:</label>
              <select id="snapshot-date-select">
                ${uniqueDates.map(date => `<option value="${date}">${new Date(date).toLocaleDateString('en-GB')}</option>`).join('')}
              </select>
            </div>
            <button id="generate-report-btn" class="btn-primary">Generate Report</button>
            <button id="close-report-modal-btn" class="btn-secondary">Close</button>
            <div id="report-content-wrapper" style="margin-top: 20px;">
                <div id="report-controls" style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
                    <button id="export-pdf-btn" class="btn-secondary" style="margin-right: 10px;">Export to PDF</button>
                    <button id="export-excel-btn" class="btn-secondary">Export to Excel</button>
                </div>
                <div id="report-content"></div>
            </div>
          </div>
        </div>
      `;

      if (document.getElementById('report-modal')) {
        document.getElementById('report-modal').remove();
      }
      document.body.insertAdjacentHTML('beforeend', modalHTML);

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.16.9/xlsx.full.min.js';
      document.head.appendChild(script);

      const generateReportBtn = document.getElementById('generate-report-btn');
      const closeReportModalBtn = document.getElementById('close-report-modal-btn');
      const reportModal = document.getElementById('report-modal');

      generateReportBtn.addEventListener('click', async () => {
        const selectedDate = document.getElementById('snapshot-date-select').value;
        await generateAndDisplayReport(selectedDate);
      });

      closeReportModalBtn.addEventListener('click', () => {
        reportModal.remove();
      });

      reportModal.addEventListener('click', (e) => {
        if (e.target.id === 'report-modal') {
          reportModal.remove();
        }
      });

      document.getElementById('export-pdf-btn').addEventListener('click', () => {
          const reportContent = document.getElementById('report-content');
          const selectedDate = document.getElementById('snapshot-date-select').value;
          const reportTitle = `Jordon Inventory Transaction Report for ${new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' })}`;
          const printWindow = window.open('', '_blank');
          printWindow.document.write(`<html><head><title>${reportTitle}</title>`);
          printWindow.document.write('<link rel="stylesheet" href="style.css">');
          printWindow.document.write('<link rel="stylesheet" href="inventory.css">');
          printWindow.document.write('<link rel="stylesheet" href="report.css">');
          printWindow.document.write('</head><body>');
          printWindow.document.write(reportContent.innerHTML);
          printWindow.document.write('</body></html>');
          printWindow.document.close();
          printWindow.print();
      });

      document.getElementById('export-excel-btn').addEventListener('click', () => {
        const selectedDate = document.getElementById('snapshot-date-select').value;
        const reportTitle = `Jordon Inventory Transaction Report for ${new Date(selectedDate).toLocaleString('default', { month: 'long', year: 'numeric' })}`;
        const tables = document.querySelectorAll('#report-content .data-table');
        const wb = XLSX.utils.book_new();

        tables.forEach((table, index) => {
            const ws = XLSX.utils.table_to_sheet(table);
            XLSX.utils.book_append_sheet(wb, ws, `Product_${index + 1}`);
        });

        XLSX.writeFile(wb, `${reportTitle}.xlsx`);
      });
    };

const generateAndDisplayReport = async (snapshotDate) => {
  const reportContent = document.getElementById('report-content');
  reportContent.innerHTML = '<p>Generating report...</p>';

  const { data: openingStock, error: openingStockError } = await supabaseClient
    .from('month_end_snapshot')
    .select('item_code, batch_no, quantity, details')
    .eq('warehouse_id', 'jordon')
    .eq('snapshot_date', snapshotDate);

  if (openingStockError) {
    reportContent.innerHTML = '<p>Error fetching opening stock.</p>';
    console.error('Error fetching opening stock:', openingStockError);
    return;
  }

  const startDate = new Date(snapshotDate);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

  const { data: transactions, error: transactionsError } = await supabaseClient
    .from('transactions')
    .select('transaction_date, transaction_type, item_code, batch_no, quantity, warehouse_id, destination_warehouse_id, inventory_details')
    .eq('warehouse_id', 'jordon')
    .gte('transaction_date', startDate.toISOString().split('T')[0])
    .lte('transaction_date', endDate.toISOString().split('T')[0])
    .order('transaction_date', { ascending: true });

  if (transactionsError) {
    reportContent.innerHTML = '<p>Error fetching transactions.</p>';
    console.error('Error fetching transactions:', transactionsError);
    return;
  }

  const { data: productsData, error: productsError } = await supabaseClient
      .from('products')
      .select('item_code, product_name');

  if (productsError) {
    reportContent.innerHTML = '<p>Error fetching product data.</p>';
    console.error('Error fetching products:', productsError);
    return;
  }

  const productsMap = new Map(productsData.map(p => [p.item_code, p]));

  const reportData = {};

  // 处理 opening stock - 合并相同 item_code 的记录
  openingStock.forEach(item => {
    if (!reportData[item.item_code]) {
      reportData[item.item_code] = {
        productName: productsMap.get(item.item_code)?.product_name || 'N/A',
        opening: {
          quantity: 0,
          pallet: 0,
          batch_nos: [],
          lotNumbers: []
        },
        transactions: [],
        closing: {
          quantity: 0,
          pallet: 0
        }
      };
    }
    
    // 累加数量和 pallet
    reportData[item.item_code].opening.quantity += item.quantity;
    reportData[item.item_code].opening.pallet += Number(item.details?.pallet) || 0;
    
    // 收集所有 batch_no 和 lotNumber
    if (item.batch_no && !reportData[item.item_code].opening.batch_nos.includes(item.batch_no)) {
      reportData[item.item_code].opening.batch_nos.push(item.batch_no);
    }
    if (item.details?.lotNumber && !reportData[item.item_code].opening.lotNumbers.includes(item.details.lotNumber)) {
      reportData[item.item_code].opening.lotNumbers.push(item.details.lotNumber);
    }
    
    // 设置 closing 的初始值
    reportData[item.item_code].closing.quantity = reportData[item.item_code].opening.quantity;
    reportData[item.item_code].closing.pallet = reportData[item.item_code].opening.pallet;
  });

  // 处理 transactions
  transactions.forEach(tx => {
    // 如果 reportData 中没有这个 item_code，先创建（用于新商品）
    if (!reportData[tx.item_code]) {
      reportData[tx.item_code] = {
        productName: productsMap.get(tx.item_code)?.product_name || 'N/A',
        opening: {
          quantity: 0,
          pallet: 0,
          batch_nos: [],
          lotNumbers: []
        },
        transactions: [],
        closing: {
          quantity: 0,
          pallet: 0
        }
      };
    }
    
    let quantityChange = 0;
    let palletChange = Number(tx.inventory_details?.pallet) || 0;
    let description = tx.transaction_type;

    if (tx.transaction_type === 'internal_transfer') {
      if (tx.warehouse_id === 'jordon') {
        quantityChange = -tx.quantity;
        palletChange = -(Number(tx.inventory_details?.pallet) || 0);
        description = `Internal Transfer Out (${tx.destination_warehouse_id})`;
      } else if (tx.destination_warehouse_id === 'jordon') {
        quantityChange = tx.quantity;
        description = `Internal Transfer In (${tx.warehouse_id})`;
      }
    } else if (tx.transaction_type.includes('in')) {
      quantityChange = tx.quantity;
    } else if (tx.transaction_type.includes('out')) {
      quantityChange = -tx.quantity;
      palletChange = -(Number(tx.inventory_details?.pallet) || 0);
    }

    reportData[tx.item_code].transactions.push({
      date: tx.transaction_date,
      type: description,
      quantity: quantityChange,
      pallet: palletChange,
      batch_no: tx.batch_no,
      lotNumber: tx.inventory_details?.lotNumber || ''
    });
    reportData[tx.item_code].closing.quantity += quantityChange;
    reportData[tx.item_code].closing.pallet += palletChange;
  });

  let totalQtyBalance = 0;
  let totalPltBalance = 0;

  let reportHTML = `<h3 style="margin-bottom: 10px;">Report for ${new Date(snapshotDate).toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>`;

  for (const itemCode in reportData) {
    const item = reportData[itemCode];
    totalQtyBalance += item.closing.quantity;
    totalPltBalance += item.closing.pallet;
    let quantityBalance = item.opening.quantity;
    let palletBalance = Number(item.opening.pallet);

    // 格式化 batch_nos 和 lotNumbers 显示
    const batchNosDisplay = item.opening.batch_nos.length > 0 ? item.opening.batch_nos.join(', ') : '';
    const lotNumbersDisplay = item.opening.lotNumbers.length > 0 ? item.opening.lotNumbers.join(', ') : '';

    reportHTML += `
      <h4 style="margin-top: 20px;">Item: ${itemCode} - ${item.productName}</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Batch No</th>
            <th>Lot Number</th>
            <th>Qty</th>
            <th>Plt</th>
            <th>Qty Balance</th>
            <th>Plt Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${new Date(snapshotDate).toLocaleDateString('en-GB')}</td>
            <td>Opening Stock</td>
            <td>${batchNosDisplay}</td>
            <td>${lotNumbersDisplay}</td>
            <td></td>
            <td></td>
            <td>${item.opening.quantity}</td>
            <td>${item.opening.pallet}</td>
          </tr>
          ${item.transactions.map(t => {
            quantityBalance += t.quantity;
            palletBalance += t.pallet;
            const qtyColor = t.quantity > 0 ? 'green' : 'red';
            const pltColor = t.pallet > 0 ? 'green' : 'red';
            return `
              <tr>
                <td>${new Date(t.date).toLocaleDateString('en-GB')}</td>
                <td>${t.type}</td>
                <td>${t.batch_no}</td>
                <td>${t.lotNumber}</td>
                <td style="color:${qtyColor};">${t.quantity > 0 ? `+${t.quantity}`: t.quantity}</td>
                <td style="color:${pltColor};">${t.pallet > 0 ? `+${t.pallet}`: t.pallet}</td>
                <td>${quantityBalance}</td>
                <td>${palletBalance}</td>
              </tr>
            `
          }).join('')}
          <tr>
            <td colspan="6"><strong>Closing Stock</strong></td>
            <td><strong>${item.closing.quantity}</strong></td>
            <td><strong>${item.closing.pallet}</strong></td>
          </tr>
        </tbody>
      </table>
    `;
  }

  const summaryHTML = `
    <div style="margin-top: 20px; margin-bottom: 20px; font-weight: bold;">
        <span>Total Quantity Balance: ${totalQtyBalance}</span>
        <span style="margin-left: 20px;">Total Pallet Balance: ${totalPltBalance}</span>
    </div>
  `;

  reportContent.innerHTML = summaryHTML + reportHTML;
};

    const handleReprint = async () => {
      const orderNumber = document.getElementById('jordon-reprint-order-number').value;
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

      const printHtml = generateJordonPrintHTML(data.order_number, data.draw_out_date, data.draw_out_time, data.stock_out_items);
      const printWindow = window.open('', '_blank');
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.print();
    };

    const lineageShowRecordsButton = document.getElementById('lineage-show-records-btn');
    if (lineageShowRecordsButton) {
      lineageShowRecordsButton.addEventListener('click', async () => {
        const modal = document.getElementById('lineage-records-modal');
        const tableContainer = document.getElementById('lineage-records-table-container');
        if (!modal || !tableContainer) return;

        const { data, error } = await supabaseClient
          .from('scheduled_transactions')
          .select('*')
          .eq('warehouse_id', 'lineage')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching Lineage records:', error);
          alert('Error fetching Lineage records.');
          return;
        }

        tableContainer.innerHTML = createLineageRecordsTable(data);
        modal.style.display = 'flex';

        const closeButton = modal.querySelector('.close-button');
        closeButton.onclick = () => {
          modal.style.display = 'none';
        };

        window.onclick = (event) => {
          if (event.target == modal) {
            modal.style.display = 'none';
          }
        };
      });
    }

    const createLineageRecordsTable = (data) => {
      let table = '<table class="data-table"><thead><tr><th>Order Number</th><th>Draw Out Date</th><th>Draw Out Time</th><th>Status</th><th>Items</th></tr></thead><tbody>';
      data.forEach(record => {
        table += `
          <tr>
            <td>${record.order_number}</td>
            <td>${new Date(record.draw_out_date).toLocaleDateString('en-GB')}</td>
            <td>${record.draw_out_time}</td>
            <td>${record.status}</td>
            <td>${record.stock_out_items.map(item => `<div>${item.product_name} (${item.withdraw_quantity})</div>`).join('')}</td>
          </tr>
        `;
      });
      table += '</tbody></table>';
      return table;
    };

    // 返回一个对象，包含一些有用的方法
    return {
      clearStockOut: clearStockOutData,
      saveStockOut: saveStockOutData,
      loadStockOut: loadStockOutData,
      initTabs: initTabs
    };
  };
})();

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

    const loadInventoryData = async () => {
      try {
        // 清理之前的事件监听器
        if (eventController) {
          eventController.abort();
        }
        // 创建新的 AbortController
        eventController = new AbortController();
        const signal = eventController.signal;

        const { data: inventoryData, error: inventoryError } = await supabaseClient
          .from('inventory')
          .select('*')
          .eq('warehouse_id', warehouseId);

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

        inventoryData.forEach(item => {
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

        // 为库存摘要表的行添加点击事件（用于打开模态框）
        const summaryTableRows = inventorySummaryTableBody.querySelectorAll('tr');
        summaryTableRows.forEach((row, index) => {
          row.addEventListener('click', () => {
            const modal = document.querySelector('.jordon-withdrawal-modal');
            const modalBody = document.getElementById('jordon-modal-body');
            if (!modal || !modalBody) return;

            // 设置模态框的数据属性，标识当前操作的仓库
            modal.setAttribute('data-current-warehouse', warehouseId);
            modalBody.innerHTML = '';

            const item = inventoryData[index];
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

            modal.style.display = 'flex';
          }, { signal });
        });

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

        // 处理混合托盘的颜色分组
        const groups = {};
        inventorySummaryTableBody.querySelectorAll('tr').forEach((row, index) => {
          const mixPallet = inventoryData[index].details.mixPallet;
          const dateStored = row.cells[7].textContent;
          if (mixPallet) {
            const key = `${mixPallet}-${dateStored}`;
            if (!groups[key]) {
              groups[key] = [];
            }
            groups[key].push(row);
          }
          row.cells[11].style.display = 'none';
        });

        for (const key in groups) {
          if (groups[key].length > 1) {
            const color = `hsl(${Math.random() * 360}, 100%, 90%)`;
            groups[key].forEach(row => {
              row.cells[9].style.backgroundColor = color;
              row.cells[10].style.backgroundColor = color;
            });
          }
        }

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
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
          button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
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
        });

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
              for (let i = 1; i < lotNumberInputs.length; i++) {
                lotNumberInputs[i].value = firstLotNumber;
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
            modal.style.display = 'none';
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
                  newRow.innerHTML = `
                    <td>${productName}</td>
                    <td>${packingSize}</td>
                    <td>${batchNo}</td>
                    <td>${location}</td>
                    <td>${lotNumber}</td>
                    <td>${withdrawQuantity}</td>
                    <td>${withdrawPallet}</td>
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
              modal.style.display = 'none';
            }
          };

          // 添加事件监听器（使用 signal 来管理）
          closeButton.addEventListener('click', handleModalClose, { signal });
          modalSubmitButton.addEventListener('click', handleModalSubmit, { signal });
          modal.addEventListener('keydown', handleModalKeydown, { signal });
        }

        // 处理提交按钮事件
        const submitButton = document.querySelector(`#${warehouseId}-submit-btn`);
        if (submitButton) {
          submitButton.addEventListener('click', async () => {
            const stockInRows = stockInTableBody.querySelectorAll('tr');
            const updates = [];
            let validationError = false;

            for (const row of stockInRows) {
              const id = row.querySelector('.delete-btn').dataset.id;
              const palletType = row.querySelector('input[type="text"]').value;
              const location = row.querySelector('.location-input, .lot-number-input').value;
              const mixPallet = row.cells[11].querySelector('.short-input').value;
              const pallet = Number(row.cells[10].textContent);

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

            const { error } = await supabaseClient
              .from('inventory')
              .upsert(updates);

            if (error) {
              console.error('Error updating records:', error);
              alert('Error submitting records.');
            } else {
              alert('Records submitted successfully.');
              loadInventoryData();
            }
          }, { signal });
        }

        // 在数据加载完成后，恢复 Stock Out 数据
        loadStockOutData();
        
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

    loadInventoryData();

    // 返回一个对象，包含一些有用的方法
    return {
      clearStockOut: clearStockOutData,
      saveStockOut: saveStockOutData,
      loadStockOut: loadStockOutData
    };
  };
})();

(() => {
  window.createWarehousePage = (warehouseId, supabaseClient) => {
    const loadInventoryData = async () => {
      try {
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

      const summaryFooter = document.querySelector(`#${warehouseId}-inventory-summary-table tfoot`);
      if (summaryFooter) {
        summaryFooter.innerHTML = `
          <tr>
            <td colspan="9">Total:</td>
            <td>${summaryTotalQuantity}</td>
            <td>${summaryTotalPallet}</td>
            <td></td>
          </tr>
        `;
      }

      const groups = {};
      inventorySummaryTableBody.querySelectorAll('tr').forEach(row => {
        const mixPallet = row.cells[11] ? row.cells[11].textContent : null;
        const dateStored = row.cells[7].textContent;
        if (mixPallet) {
          const key = `${mixPallet}-${dateStored}`;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(row);
        }
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

      const stockInFooter = document.querySelector(`#${warehouseId}-stock-in-table tfoot`);
      if (stockInFooter) {
        stockInFooter.innerHTML = `
          <tr>
            <td colspan="9">Total:</td>
            <td>${stockInTotalQuantity}</td>
            <td>${stockInTotalPallet}</td>
            <td></td>
            <td></td>
          </tr>
        `;
      }

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
        });
      });

      if (warehouseId === 'lineage') {
        const locationInputs = document.querySelectorAll('.location-input');
        if (locationInputs.length > 0) {
          locationInputs[0].addEventListener('input', (e) => {
            const firstLocation = e.target.value;
            for (let i = 1; i < locationInputs.length; i++) {
              locationInputs[i].value = firstLocation;
            }
          });
        }
      } else if (warehouseId === 'jordon') {
        const lotNumberInputs = document.querySelectorAll('.lot-number-input');
        if (lotNumberInputs.length > 0) {
          lotNumberInputs[0].addEventListener('input', (e) => {
            const firstLotNumber = e.target.value;
            for (let i = 1; i < lotNumberInputs.length; i++) {
              lotNumberInputs[i].value = firstLotNumber;
            }
          });
        }
      }

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
            const mixPallet = row.querySelector('.short-input[value=""]').value;
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
        });
      }
      } catch (error) {
        console.error('Error loading inventory data:', error);
      }
    };

    loadInventoryData();
  };
})();

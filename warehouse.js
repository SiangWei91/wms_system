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
                <td><button class="delete-btn" data-id="${item.id}">&times;</button></td>
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
                <td><button class="delete-btn" data-id="${item.id}">&times;</button></td>
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
            <td colspan="8">Total:</td>
            <td>${summaryTotalQuantity}</td>
            <td>${summaryTotalPallet}</td>
            <td></td>
          </tr>
        `;
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
          const { error } = await supabaseClient
            .from('inventory')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Error deleting item:', error);
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

          stockInRows.forEach(row => {
            const id = row.querySelector('.delete-btn').dataset.id;
            const palletType = row.querySelector('input[type="text"]').value;
            const location = row.querySelector('.location-input, .lot-number-input').value;
            const mixPallet = row.querySelector('.short-input[value=""]').value;
            const pallet = Number(row.cells[10].textContent);

            if ((warehouseId === 'jordon' && !location) || (warehouseId === 'lineage' && !location)) {
              validationError = true;
              alert('Please fill in all Lot Numbers or Locations.');
            }

            if (pallet === 0 && !mixPallet) {
              validationError = true;
              alert('Please fill in the Mix Pallet for rows with 0 pallet.');
            }

            updates.push({
              id,
              details: {
                palletType,
                location,
                status: 'Complete',
                mixPallet,
              },
            });
          });

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

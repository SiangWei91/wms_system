const createWarehousePage = (warehouseId, supabaseClient) => {
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

      const tableBody = document.querySelector(`#${warehouseId}-inventory-summary-table tbody`);
      if (!tableBody) {
        console.error(`Table body not found for ${warehouseId}`);
        return;
      }
      tableBody.innerHTML = ''; // Clear existing data

      inventoryData.forEach(item => {
        const product = productsMap.get(item.item_code) || {};
        const row = document.createElement('tr');
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
          `;
        }
        tableBody.appendChild(row);
      });
    } catch (error) {
      console.error('Error loading inventory data:', error);
    }
  };

  loadInventoryData();
};

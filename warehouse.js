const createWarehousePage = (warehouseId, supabaseClient) => {
  const loadInventoryData = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('inventory')
        .select('*')
        .eq('warehouse_id', warehouseId);

      if (error) {
        throw error;
      }

      const tableBody = document.querySelector(`#${warehouseId}-inventory-summary-table tbody`);
      if (!tableBody) {
        console.error(`Table body not found for ${warehouseId}`);
        return;
      }
      tableBody.innerHTML = ''; // Clear existing data

      data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.item_code}</td>
          <td>${item.batch_no}</td>
          <td>${item.quantity}</td>
          <td>${item.container}</td>
          <td>${item.details.pallet}</td>
          <td>${item.details.status}</td>
          <td>${item.details.location}</td>
          <td>${item.details.lotNumber}</td>
          <td>${item.details.dateStored}</td>
          <td>${item.details.palletType}</td>
        `;
        tableBody.appendChild(row);
      });
    } catch (error) {
      console.error('Error loading inventory data:', error);
    }
  };

  loadInventoryData();
};

window.loadInventoryPage = async (supabaseClient) => {
  const fetchProductStockSummary = async () => {
    const { data, error } = await supabaseClient
      .from('product_stock_summary')
      .select('*')
      .order('item_code', { ascending: true });

    if (error) {
      console.error('Error fetching summary:', error);
      return [];
    }

    return data;
  };

  const renderTable = (data) => {
    const tableContainer = document.getElementById('inventory-table-container');
    if (!tableContainer) return;

    const table = document.createElement('table');
    table.className = 'table';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table headers
    const headers = ['Item Code', 'Product Name', 'Packing Size', 'Cold Room 5', 'Jordon', 'Singlong', 'Lineage', 'Cold Room 1', 'Cold Room 2', 'Blk 15', 'Total Stock'];
    const headerRow = document.createElement('tr');
    headers.forEach(headerText => {
      const th = document.createElement('th');
      th.textContent = headerText;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Create table rows
    data.forEach(row => {
      const tr = document.createElement('tr');
      const totalStock = (row.coldroom5 || 0) + (row.jordon || 0) + (row.singlong || 0) + (row.lineage || 0) + (row.coldroom1 || 0) + (row.coldroom2 || 0) + (row.blk15 || 0);
      const cells = [row.item_code, row.product_full_name, row.packing_size, row.coldroom5, row.jordon, row.singlong, row.lineage, row.coldroom1, row.coldroom2, row.blk15, totalStock];
      cells.forEach(cellText => {
        const td = document.createElement('td');
        td.textContent = cellText;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.innerHTML = ''; // Clear previous content
    tableContainer.appendChild(table);
  };

  const data = await fetchProductStockSummary();
  renderTable(data);
};

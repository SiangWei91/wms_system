window.loadInventoryPage = async (supabaseClient) => {
  const fetchProductStockSummary = async () => {
    const { data, error } = await supabaseClient
      .from('product_stock_summary')
      .select('*')
      .order('row_index', { ascending: true });

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
    const headers = ['Product Name', 'Total Stock In', 'Total Stock Out', 'Current Stock'];
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
      const cells = [row.product_name, row.total_stock_in, row.total_stock_out, row.current_stock];
      cells.forEach(cellText => {
        const td = document.createElement('td');
        td.textContent = cellText;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.appendChild(table);
  };

  const data = await fetchProductStockSummary();
  renderTable(data);
};

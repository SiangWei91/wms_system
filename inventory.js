window.loadInventoryPage = async (supabaseClient) => {
  const fetchProductStockSummary = async () => {
    const { data: summaryData, error: summaryError } = await supabaseClient
      .from('product_stock_summary')
      .select('*');

    if (summaryError) {
      console.error('Error fetching summary:', summaryError);
      return [];
    }

    const { data: productsData, error: productsError } = await supabaseClient
      .from('products')
      .select('item_code, row_index');

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return [];
    }

    const productsMap = new Map(productsData.map(p => [p.item_code, p.row_index]));
    const joinedData = summaryData.map(summaryItem => ({
      ...summaryItem,
      row_index: productsMap.get(summaryItem.item_code)
    }));

    joinedData.sort((a, b) => (a.row_index || Infinity) - (b.row_index || Infinity));

    return joinedData;
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

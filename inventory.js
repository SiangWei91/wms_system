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

  let columnsHidden = true;

  const renderTable = (data) => {
    const tableContainer = document.getElementById('inventory-table-container');
    if (!tableContainer) return;

    const table = document.createElement('table');
    table.className = 'table';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create table headers
    const headers = ['Item Code', 'Product Name', 'Packing Size', 'Total', 'CR 5', 'CR 6', 'JD', 'SL', 'Lineage', 'CR 1', 'CR 2', 'B15'];
    const headerRow = document.createElement('tr');
    headers.forEach((headerText, index) => {
      const th = document.createElement('th');
      th.textContent = headerText;
      if (columnsHidden && index >= 4 && index <= 11) {
        th.classList.add('hidden');
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Create table rows
    data.forEach(row => {
      const tr = document.createElement('tr');
      const total = (row.coldroom5 || 0) + (row.coldroom6 || 0) + (row.jordon || 0) + (row.singlong || 0) + (row.lineage || 0) + (row.coldroom1 || 0) + (row.coldroom2 || 0) + (row.blk15 || 0);
      const cells = [
        row.item_code,
        row.product_full_name,
        row.packing_size,
        total,
        row.coldroom5 === 0 ? '' : row.coldroom5,
        row.coldroom6 === 0 ? '' : row.coldroom6,
        row.jordon === 0 ? '' : row.jordon,
        row.singlong === 0 ? '' : row.singlong,
        row.lineage === 0 ? '' : row.lineage,
        row.coldroom1,
        row.coldroom2,
        row.blk15
      ];
      cells.forEach((cellText, index) => {
        const td = document.createElement('td');
        td.textContent = cellText;
        if (columnsHidden && index >= 4 && index <= 11) {
          td.classList.add('hidden');
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.innerHTML = ''; // Clear previous content
    tableContainer.appendChild(table);

    tbody.addEventListener('click', async (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;

        const itemCode = tr.cells[0].textContent;
        const { data: transactions, error } = await supabaseClient
            .from('transactions')
            .select(`
                *,
                warehouses ( name )
            `)
            .eq('item_code', itemCode);

        if (error) {
            console.error('Error fetching transactions:', error);
            return;
        }

        renderModalTable(transactions);
        document.getElementById('transaction-modal').style.display = 'block';
    });
  };

  const renderModalTable = (data) => {
    const modalTableContainer = document.getElementById('modal-table-container');
    if (!modalTableContainer) return;
    modalTableContainer.innerHTML = '';

    const groupedByWarehouse = data.reduce((acc, row) => {
      const warehouseName = row.warehouses ? row.warehouses.name : row.warehouse_id;
      if (!acc[warehouseName]) {
        acc[warehouseName] = [];
      }
      acc[warehouseName].push(row);
      return acc;
    }, {});

    for (const warehouseName in groupedByWarehouse) {
      const warehouseData = groupedByWarehouse[warehouseName];
      const warehouseHeader = document.createElement('h3');
      warehouseHeader.textContent = warehouseName;
      modalTableContainer.appendChild(warehouseHeader);

      const table = document.createElement('table');
      table.className = 'table';
      const thead = document.createElement('thead');
      const tbody = document.createElement('tbody');
      const tfoot = document.createElement('tfoot');

      const headers = ['Date', 'Type', 'Batch No', 'Quantity'];
      const headerRow = document.createElement('tr');
      headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);

      let totalQuantity = 0;
      warehouseData.forEach(row => {
        const tr = document.createElement('tr');
        const date = new Date(row.transaction_date);
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
        const cells = [
          formattedDate,
          row.transaction_type,
          row.batch_no,
          row.quantity
        ];
        cells.forEach(cellText => {
          const td = document.createElement('td');
          td.textContent = cellText;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
        totalQuantity += row.quantity;
      });

      const footerRow = document.createElement('tr');
      const totalLabelCell = document.createElement('td');
      totalLabelCell.colSpan = 3;
      totalLabelCell.textContent = 'Total Quantity';
      totalLabelCell.style.textAlign = 'right';
      const totalValueCell = document.createElement('td');
      totalValueCell.textContent = totalQuantity;
      footerRow.appendChild(totalLabelCell);
      footerRow.appendChild(totalValueCell);
      tfoot.appendChild(footerRow);

      table.appendChild(thead);
      table.appendChild(tbody);
      table.appendChild(tfoot);
      modalTableContainer.appendChild(table);
    }
  };

  const data = await fetchProductStockSummary();
  renderTable(data);

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('keyup', () => {
      const searchTerm = searchInput.value.toLowerCase();
      const tableRows = document.querySelectorAll('.table tbody tr');
      tableRows.forEach(row => {
        const itemCode = row.cells[0].textContent.toLowerCase();
        const productName = row.cells[1].textContent.toLowerCase();
        // The following indices are based on the headers array in renderTable
        // and may need to be adjusted if the table structure changes.
        const lotNumber = row.cells[6].textContent.toLowerCase(); // JD
        const container = row.cells[8].textContent.toLowerCase(); // Lineage

        if (itemCode.includes(searchTerm) || productName.includes(searchTerm) || lotNumber.includes(searchTerm) || container.includes(searchTerm)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }

  const toggleButton = document.getElementById('toggle-columns-btn');
  if (toggleButton) {
    toggleButton.innerHTML = columnsHidden ? '&#x2795;' : '&#x2796;'; // Plus and Minus
    toggleButton.addEventListener('click', () => {
      columnsHidden = !columnsHidden;
      toggleButton.innerHTML = columnsHidden ? '&#x2795;' : '&#x2796;';
      renderTable(data);
    });
  }

  const modal = document.getElementById('transaction-modal');
  const closeButton = document.querySelector('.close-button');
  if (modal && closeButton) {
    closeButton.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
};

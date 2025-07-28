let shipmentHeaders = [];

// Pagination state variables
let currentShipmentPage = 1;
const SHIPMENTS_PER_PAGE = 10;
let totalShipmentPages = 1;
let totalShipmentItems = 0;

window.loadShipmentPage = async function(content, supabase) {
  const tabContainer = document.querySelector('.tab-nav');
  tabContainer.addEventListener('click', async (event) => {
    const tab = event.target.closest('.tab-button');
    if (tab) {
      await openTab(event, tab.dataset.tab, supabase);
    }
  });

  // Load the shipment list by default
  const shipmentListTab = document.querySelector('[data-tab="shipment-list"]');
  if (shipmentListTab) {
    await openTab({ currentTarget: shipmentListTab }, 'shipment-list', supabase);
  }
}

async function openTab(evt, tabName, supabase) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tab-content");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tab-button");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].classList.remove("active");
  }
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.classList.add("active");

  if (tabName === 'shipment-list') {
    currentShipmentPage = 1;
    await fetchAndRenderShipments(supabase, currentShipmentPage);
  }
}

async function fetchAndRenderShipments(supabase, page) {
  const shipmentListContainer = document.getElementById('shipment-list');
  shipmentListContainer.innerHTML = `
    <h2>Shipment List</h2>
    <div id="shipment-list-loading">
      <div class="spinner"></div>
    </div>
    <div id="shipment-list-table"></div>
    <div id="shipment-pagination"></div>
  `;

  const loadingIndicator = document.getElementById('shipment-list-loading');
  const tableContainer = document.getElementById('shipment-list-table');

  loadingIndicator.style.display = 'block';
  tableContainer.innerHTML = '';

  const data = await getShipmentList(supabase, page, SHIPMENTS_PER_PAGE);

  loadingIndicator.style.display = 'none';

  if (data && data.values) {
    const headers = data.values.shift();
    data.values.reverse(); // Reverse the data rows here
    data.values.unshift(headers); // Add headers back

    totalShipmentItems = data.total;
    totalShipmentPages = Math.ceil(totalShipmentItems / SHIPMENTS_PER_PAGE);

    const table = renderShipmentTable(data, true, supabase);
    tableContainer.classList.add('table-container');
    tableContainer.appendChild(table);
    renderShipmentPagination(supabase);
  }
}


async function getShipmentList(supabase, page, limit) {
  const { data, error } = await supabase.functions.invoke(`shipment-list?page=${page}&limit=${limit}`, {
    method: 'GET',
  });

  if (error) {
    console.error('Error fetching shipment list:', error);
    return;
  }

  return data;
}

function renderShipmentTable(data, showActions = true, supabase) {
  shipmentHeaders = data.values[0];
  const table = document.createElement('table');
  table.classList.add('data-table');

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = data.values[0];
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });

  if (showActions) {
    const th = document.createElement('th');
    th.textContent = 'Actions';
    headerRow.appendChild(th);
  }

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const tableData = showActions ? data.values.slice(1) : data.values.slice(1);
  for (let i = 0; i < tableData.length; i++) {
    const rowData = tableData[i];
    const row = document.createElement('tr');
    headers.forEach((header, index) => {
      const td = document.createElement('td');
      td.textContent = rowData[index] || '';
      row.appendChild(td);
    });

    if (showActions) {
      const actionsTd = document.createElement('td');
      actionsTd.innerHTML = `
        <button class="btn-icon view-btn" data-shipment-no="${rowData[0]}"><i class="fas fa-eye"></i></button>
        <button class="btn-icon edit-btn"><i class="fas fa-edit"></i></button>
        <button class="btn-icon save-btn" style="display: none;"><i class="fas fa-save"></i></button>
      `;
      row.appendChild(actionsTd);
    }

    tbody.appendChild(row);
  }

  tbody.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    if (button.classList.contains('view-btn')) {
      handleViewShipment(button.dataset.shipmentNo, supabase);
    } else if (button.classList.contains('edit-btn')) {
      handleEditRow(button);
    } else if (button.classList.contains('save-btn')) {
      handleSaveRow(button, supabase);
    }
  });

  table.appendChild(tbody);

  return table;
}

function renderShipmentPagination(supabase) {
  const paginationDiv = document.getElementById('shipment-pagination');
  if (!paginationDiv) return;
  paginationDiv.innerHTML = '';
  paginationDiv.classList.add('pagination');


  if (totalShipmentItems === 0) return;
  if (totalShipmentPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn-pagination';
  prevBtn.disabled = currentShipmentPage <= 1;
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
  prevBtn.addEventListener('click', () => {
    if (currentShipmentPage > 1) {
      currentShipmentPage--;
      fetchAndRenderShipments(supabase, currentShipmentPage);
    }
  });
  paginationDiv.appendChild(prevBtn);

  const pageInfo = document.createElement('span');
  pageInfo.className = 'page-info';
  pageInfo.textContent = `Page ${currentShipmentPage} of ${totalShipmentPages} (${totalShipmentItems} items)`;
  paginationDiv.appendChild(pageInfo);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-pagination';
  nextBtn.disabled = currentShipmentPage >= totalShipmentPages;
  nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
  nextBtn.addEventListener('click', () => {
    if (currentShipmentPage < totalShipmentPages) {
      currentShipmentPage++;
      fetchAndRenderShipments(supabase, currentShipmentPage);
    }
  });
  paginationDiv.appendChild(nextBtn);
}

async function getShipmentDetails(shipmentNo, supabase) {
  const { data, error } = await supabase.functions.invoke(`shipment-details?shipment=${shipmentNo}`, {
    method: 'GET',
  });

  if (error) {
    console.error('Error fetching shipment details:', error);
    return;
  }

  return data;
}

function handleEditRow(button) {
  const row = button.closest('tr');
  const cells = row.querySelectorAll('td');

  for (let i = 3; i < cells.length - 1; i++) {
    const cell = cells[i];
    cell.contentEditable = true;
    cell.classList.add('editable');
  }

  const saveButton = row.querySelector('.save-btn');
  button.style.display = 'none';
  saveButton.style.display = 'inline-block';
}

async function handleSaveRow(button, supabase) {
  const row = button.closest('tr');
  const cells = row.querySelectorAll('td');
  const shipmentNo = cells[0].textContent;

  const updates = {};
  for (let i = 3; i < cells.length - 1; i++) {
    updates[shipmentHeaders[i]] = cells[i].textContent;
  }

  try {
    console.log('Updating shipment:', shipmentNo, 'with updates:', updates);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('https://script.google.com/macros/s/AKfycbwrHXJsLtVcom-fQtKazcLBgXPSaOKMOUy8KC9aMA7Qldq1CIECgmZi25V2M05jOotm/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ shipmentNo, updates }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response from server:', errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error updating shipment list:', error);
    // You might want to show an error message to the user here
    return;
  }

  for (let i = 3; i < cells.length - 1; i++) {
    cells[i].contentEditable = false;
    cells[i].classList.remove('editable');
  }

  button.textContent = 'Edit';
  button.classList.remove('save-btn');
  button.classList.add('edit-btn');
  button.removeEventListener('click', (e) => handleSaveRow(e.target, supabase));
  button.addEventListener('click', (e) => handleEditRow(e.target));

  // Refresh the table
  const shipmentListTab = document.querySelector('[data-tab="shipment-list"]');
  openTab({ currentTarget: shipmentListTab }, 'shipment-list', supabase);
}

function handleViewShipment(shipmentNo, supabase) {
  openShipmentDetailsTab(shipmentNo, supabase);
}

async function openShipmentDetailsTab(shipmentNo, supabase) {
  const tabContainer = document.querySelector('.tab-nav');
  const contentArea = document.querySelector('.shipment-content-area');

  // Create new tab
  const newTab = document.createElement('button');
  newTab.classList.add('tab-button');
  newTab.dataset.tab = `shipment-details-${shipmentNo}`;

  const tabTitle = document.createElement('span');
  tabTitle.textContent = shipmentNo;
  newTab.appendChild(tabTitle);

  const closeButton = document.createElement('button');
  closeButton.classList.add('close-tab');
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(newTab.dataset.tab);
  });
  newTab.appendChild(closeButton);

  tabContainer.appendChild(newTab);

  // Create new tab content
  const newContent = document.createElement('div');
  newContent.id = `shipment-details-${shipmentNo}`;
  newContent.classList.add('tab-content');
  newContent.innerHTML = `<h2>${shipmentNo}</h2><div class="spinner"></div>`;
  contentArea.appendChild(newContent);

  // Switch to new tab
  openTab({ currentTarget: newTab }, newTab.dataset.tab, supabase);

  const data = await getShipmentDetails(shipmentNo, supabase);

  if (data) {
    const table = renderShipmentTable(data, false, supabase);
    newContent.innerHTML = `<h2>${shipmentNo}</h2>`;
    newContent.appendChild(table);
  } else {
    newContent.innerHTML = `<h2>${shipmentNo}</h2><p>Could not load shipment details.</p>`;
  }
}

function closeTab(tabName, supabase) {
  const tab = document.querySelector(`[data-tab="${tabName}"]`);
  const content = document.getElementById(tabName);

  if (tab) {
    tab.remove();
  }
  if (content) {
    content.remove();
  }

  // Switch to the shipment list tab
  const shipmentListTab = document.querySelector('[data-tab="shipment-list"]');
  openTab({ currentTarget: shipmentListTab }, 'shipment-list', supabase);
}

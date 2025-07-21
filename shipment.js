import { supabase } from './supabase-client.js';

let shipmentHeaders = [];

export async function loadShipmentPage() {
  const tabContainer = document.querySelector('.tab-nav');
  tabContainer.addEventListener('click', async (event) => {
    const tab = event.target.closest('.tab-button');
    if (tab) {
      await openTab(event, tab.dataset.tab);
    }
  });

  // Load the shipment list by default
  const shipmentListTab = document.querySelector('[data-tab="shipment-list"]');
  if (shipmentListTab) {
    await openTab({ currentTarget: shipmentListTab }, 'shipment-list');
  }
}

async function openTab(evt, tabName) {
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
    const shipmentListContainer = document.getElementById('shipment-list');
    shipmentListContainer.innerHTML = `
      <h2>Shipment List</h2>
      <div id="shipment-list-loading">
        <div class="spinner"></div>
      </div>
      <div id="shipment-list-table"></div>
    `;

    const loadingIndicator = document.getElementById('shipment-list-loading');
    const tableContainer = document.getElementById('shipment-list-table');

    setTimeout(async () => {
      const data = await getShipmentList();

      loadingIndicator.style.display = 'none';

      if (data) {
        const table = renderShipmentTable(data);
        tableContainer.appendChild(table);
      }
    }, 0);
  }
}

async function getShipmentList() {
  const { data, error } = await supabase.functions.invoke('shipment-list', {
    method: 'GET',
  });

  if (error) {
    console.error('Error fetching shipment list:', error);
    return;
  }

  return data;
}

function renderShipmentTable(data, showActions = true) {
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
  const tableData = showActions ? data.values.slice(1).reverse() : data.values.slice(1);
  for (let i = 0; i < tableData.length; i++) {
    const rowData = tableData[i];
    const row = document.createElement('tr');
    headers.forEach((header, index) => {
      const td = document.createElement('td');
      td.textContent = rowData[index] || '';
      row.appendChild(td);
    });

    if (showActions) {
      const viewButton = document.createElement('button');
      viewButton.innerHTML = '<i class="fas fa-eye"></i>';
      viewButton.classList.add('btn-icon', 'view-btn');
      viewButton.addEventListener('click', () => handleViewShipment(rowData[0]));

      const editButton = document.createElement('button');
      editButton.innerHTML = '<i class="fas fa-edit"></i>';
      editButton.classList.add('btn-icon', 'edit-btn');
      editButton.addEventListener('click', (e) => handleEditRow(e.target));

      const saveButton = document.createElement('button');
      saveButton.innerHTML = '<i class="fas fa-save"></i>';
      saveButton.classList.add('btn-icon', 'save-btn');
      saveButton.style.display = 'none';
      saveButton.addEventListener('click', (e) => handleSaveRow(e.target));

      const actionsTd = document.createElement('td');
      actionsTd.appendChild(viewButton);
      actionsTd.appendChild(editButton);
      actionsTd.appendChild(saveButton);
      row.appendChild(actionsTd);
    }

    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  return table;
}

async function getShipmentDetails(shipmentNo) {
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

async function handleSaveRow(button) {
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
  button.removeEventListener('click', (e) => handleSaveRow(e.target));
  button.addEventListener('click', (e) => handleEditRow(e.target));

  // Refresh the table
  const shipmentListTab = document.querySelector('[data-tab="shipment-list"]');
  openTab({ currentTarget: shipmentListTab }, 'shipment-list');
}

function handleViewShipment(shipmentNo) {
  openShipmentDetailsTab(shipmentNo);
}

async function openShipmentDetailsTab(shipmentNo) {
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
  openTab({ currentTarget: newTab }, newTab.dataset.tab);

  const data = await getShipmentDetails(shipmentNo);

  if (data) {
    const table = renderShipmentTable(data, false);
    newContent.innerHTML = `<h2>${shipmentNo}</h2>`;
    newContent.appendChild(table);
  } else {
    newContent.innerHTML = `<h2>${shipmentNo}</h2><p>Could not load shipment details.</p>`;
  }
}

function closeTab(tabName) {
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
  openTab({ currentTarget: shipmentListTab }, 'shipment-list');
}

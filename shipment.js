let shipmentHeaders = [];
let supabase;

// Pagination state variables
let currentShipmentPage = 1;
const SHIPMENTS_PER_PAGE = 10;
let totalShipmentPages = 1;
let totalShipmentItems = 0;

window.loadShipmentPage = async function (content, sb) {
  supabase = sb;
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
};

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
    currentShipmentPage = 1;
    await fetchAndRenderShipments(currentShipmentPage);
  } else if (tabName === 'shipment-upload') {
    initializeShipmentUpload();
  } else if (tabName === 'shipment-allocation') {
    loadShipmentAllocationPage(supabase);
  }
}

async function fetchAndRenderShipments(page) {
  const shipmentListContainer = document.getElementById('shipment-list');
  shipmentListContainer.innerHTML = `
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

  const data = await getShipmentList(page, SHIPMENTS_PER_PAGE);

  loadingIndicator.style.display = 'none';

  if (data && data.values) {
    const headers = data.values.shift();
    data.values.unshift(headers); // 添加表头回去（不再 reverse）

    totalShipmentItems = data.total;
    totalShipmentPages = Math.ceil(totalShipmentItems / SHIPMENTS_PER_PAGE);

    const table = renderShipmentTable(data, true);
    tableContainer.classList.add('table-container');
    tableContainer.appendChild(table);
    renderShipmentPagination();
  }
}

async function getShipmentList(page, limit) {
  const { data, error } = await supabase.functions.invoke(`shipment-list?page=${page}&limit=${limit}`, {
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
      handleViewShipment(button.dataset.shipmentNo);
    } else if (button.classList.contains('edit-btn')) {
      handleEditRow(button);
    } else if (button.classList.contains('save-btn')) {
      handleSaveRow(button);
    }
  });

  table.appendChild(tbody);

  return table;
}

function renderShipmentPagination() {
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
      fetchAndRenderShipments(currentShipmentPage);
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
      fetchAndRenderShipments(currentShipmentPage);
    }
  });
  paginationDiv.appendChild(nextBtn);
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

  const shipmentListTab = document.querySelector('[data-tab="shipment-list"]');
  openTab({ currentTarget: shipmentListTab }, 'shipment-list');
}

function handleViewShipment(shipmentNo) {
  openShipmentDetailsTab(shipmentNo);
}

async function openShipmentDetailsTab(shipmentNo) {
  const tabContainer = document.querySelector('.tab-nav');
  const contentArea = document.querySelector('.shipment-content-area');

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

  const newContent = document.createElement('div');
  newContent.id = `shipment-details-${shipmentNo}`;
  newContent.classList.add('tab-content');
  newContent.innerHTML = `<h2>${shipmentNo}</h2><div class="spinner"></div>`;
  contentArea.appendChild(newContent);

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

  if (tab) tab.remove();
  if (content) content.remove();

  const shipmentListTab = document.querySelector('[data-tab="shipment-list"]');
  openTab({ currentTarget: shipmentListTab }, 'shipment-list');
}

function initializeShipmentUpload() {
  const uploadButton = document.getElementById('uploadButton');
  if (uploadButton) {
    uploadButton.addEventListener('click', () => handleUpload());
  }

  const fileInput = document.getElementById('excelFile');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const fileName = e.target.files[0] ? e.target.files[0].name : 'Choose a file...';
      const label = document.querySelector('.file-label span');
      if (label) {
        label.textContent = fileName;
      }
    });
  }
}

async function handleUpload() {
  const fileInput = document.getElementById('excelFile');
  const file = fileInput.files[0];

  if (!file) {
    showUploadStatus('Please select a file.', 'error');
    return;
  }

  const loadingIndicator = document.getElementById('loading-indicator');
  loadingIndicator.style.display = 'block';
  showUploadStatus('');

  try {
    const dataToSend = await processExcelFile(file);

    // 添加调试信息
    console.log('Data to send:', dataToSend);
    console.log('ETA value being sent:', dataToSend.eta);
    console.log('ETA type:', typeof dataToSend.eta);

    const response = await fetch('https://script.google.com/macros/s/AKfycbw0milIRKWsyZuBouL-pCEPSPf_6xAjovCI9XgOZWXEXMjsyE2gYZZAVpbN_OHilSjs/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(dataToSend),
    });

    const result = await response.json();

    if (result.success) {
      showUploadStatus('Data saved successfully!', 'success');
      // Optionally, switch to the shipment list view
      const shipmentListTab = document.querySelector('[data-tab="shipment-list"]');
      openTab({ currentTarget: shipmentListTab }, 'shipment-list');
    } else {
      showUploadStatus(`Error: ${result.message || 'An unknown error occurred.'}`, 'error');
    }
  } catch (error) {
    showUploadStatus(`An error occurred: ${error.message}`, 'error');
  } finally {
    loadingIndicator.style.display = 'none';
  }
}

window.loadShipmentAllocationPage = function(supabase) {
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFile(e, supabase);
            const fileName = e.target.files[0] ? e.target.files[0].name : 'Choose a file...';
            const label = document.querySelector('#shipment-allocation .file-label span');
            if (label) {
                label.textContent = fileName;
            }
        }, false);
    }

    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.addEventListener('input', (e) => {
            if (e.target.classList.contains('editable-cell-input')) {
                handleCellEdit(e);
            }
        });
        resultsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-row-btn')) {
                handleRowRemoveClick(e);
            }
        });
    }

    const updateBtn = document.getElementById('updateInventoryBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', () => updateInventory(supabase));
    }
}

function processExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const dataArray = XLSX.utils.sheet_to_json(sheet, {header: 1});

            // 获取原始ETA值
            const rawEta = getValueFromArray(dataArray, 3, 5); // F4

            // 确保ETA被转换为DD/MM/YYYY格式
            let formattedEta = rawEta;
            if (typeof rawEta === 'number' && !isNaN(rawEta)) {
                // 如果是数字（Excel序列号），转换为日期格式
                formattedEta = excelDateToJSDate(rawEta);
            } else if (typeof rawEta === 'string' && rawEta.trim() !== '') {
                // 如果已经是字符串，检查是否需要格式化
                formattedEta = rawEta.toString();
            }

            console.log('Raw ETA:', rawEta, 'Formatted ETA:', formattedEta);

            const extractedData = {
                shipmentNo: getValueFromArray(dataArray, 1, 0),  // A2
                poNo: getValueFromArray(dataArray, 4, 0),        // A5
                containerNumber: getValueFromArray(dataArray, 1, 5),  // F2
                eta: formattedEta, // 使用格式化后的日期
                listData: getListDataUntilTotal(dataArray.slice(5))  // From A6
            };

            resolve(extractedData);

        } catch (error) {
            console.error('Error processing file:', error);
            reject(new Error('Error processing Excel file: ' + error.message));
        }
    };
     reader.onerror = (error) => {
      reject(new Error('File could not be read: ' + error));
    };
    reader.readAsArrayBuffer(file);
  });
}

function excelDateToJSDate(serial) {
  console.log('Converting Excel date:', serial, 'Type:', typeof serial);

  // 如果不是数字或者是NaN，返回原值
  if (typeof serial !== 'number' || isNaN(serial)) {
    console.log('Not a valid Excel serial number, returning original value');
    return serial;
  }

  // 检查是否是合理的Excel日期序列号范围 (1900-2100年大约)
  if (serial < 1 || serial > 73415) {
    console.log('Serial number out of reasonable date range');
    return serial;
  }

  try {
    // Excel的日期系统：1900年1月1日是序列号1
    // 但Excel错误地认为1900年是闰年，所以需要调整
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    const day = String(date_info.getDate()).padStart(2, '0');
    const month = String(date_info.getMonth() + 1).padStart(2, '0');
    const year = date_info.getFullYear();

    const formattedDate = `${day}/${month}/${year}`;
    console.log('Converted Excel serial', serial, 'to date:', formattedDate);

    return formattedDate;
  } catch (error) {
    console.error('Error converting Excel date:', error);
    return serial; // 转换失败时返回原值
  }
}

function getValueFromArray(dataArray, row, col) {
    if (dataArray[row] && dataArray[row][col] !== undefined) {
        return dataArray[row][col];
    }
    return "";
}

function getListDataUntilTotal(data) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        // Only extract first 6 columns (A-F)
        let row = data[i] ? data[i].slice(0, 6) : [];
        row = ensureRowLength(row, 6);
        row = formatColumnE(row);

        if (isTotalInColumnC(row)) {
            console.log(`Stopped at row ${i + 6} ('total' detected in column C)`);
            break;
        }
        result.push(row);
    }
    console.log(`Retrieved ${result.length} rows of data`);
    return result;
}

function ensureRowLength(row, minLength) {
    while (row.length < minLength) {
        row.push("");
    }
    return row;
}

function formatColumnE(row) {
    // Format column E (index 4) as text with leading zeros
    if (row.length > 4 && row[4] !== "") {
        const value = String(row[4]).replace(/^'/, '').padStart(8, '0');
        row[4] = "'" + value;
    }
    return row;
}

function isTotalInColumnC(row) {
    const cellValue = row[2];
    if (cellValue === undefined || cellValue === null || cellValue === "") {
        return false;
    }
    return String(cellValue).toLowerCase().includes('total');
}

function showUploadStatus(message, type = 'info') {
  const statusDiv = document.getElementById('upload-status');
  statusDiv.textContent = message;
  statusDiv.className = `upload-status ${type}`;
}

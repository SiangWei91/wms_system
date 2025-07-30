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
    th.textContent = translate('Actions');
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
  prevBtn.innerHTML = `<i class="fas fa-chevron-left"></i> ${translate('Previous')}`;
  prevBtn.addEventListener('click', () => {
    if (currentShipmentPage > 1) {
      currentShipmentPage--;
      fetchAndRenderShipments(currentShipmentPage);
    }
  });
  paginationDiv.appendChild(prevBtn);

  const pageInfo = document.createElement('span');
  pageInfo.className = 'page-info';
  pageInfo.textContent = translateWithParams("Page {currentPage} of {totalPages} ({totalItems} items)", { currentPage: currentShipmentPage, totalPages: totalShipmentPages, totalItems: totalShipmentItems });
  paginationDiv.appendChild(pageInfo);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-pagination';
  nextBtn.disabled = currentShipmentPage >= totalShipmentPages;
  nextBtn.innerHTML = `${translate('Next')} <i class="fas fa-chevron-right"></i>`;
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
    newContent.innerHTML = `<h2>${shipmentNo}</h2><p>${translate('Could not load shipment details.')}</p>`;
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
    showUploadStatus(translate('Please select a file.'), 'error');
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
      showUploadStatus(translate('Data saved successfully!'), 'success');
      // Optionally, switch to the shipment list view
      const shipmentListTab = document.querySelector('[data-tab="shipment-list"]');
      openTab({ currentTarget: shipmentListTab }, 'shipment-list');
    } else {
      showUploadStatus(`${translate('Error: ')}${result.message || translate('An unknown error occurred.')}`, 'error');
    }
  } catch (error) {
    showUploadStatus(`${translate('An error occurred: ')}${error.message}`, 'error');
  } finally {
    loadingIndicator.style.display = 'none';
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
            reject(new Error(translate('Error processing Excel file: ') + error.message));
        }
    };
     reader.onerror = (error) => {
      reject(new Error(translate('File could not be read: ') + error));
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


// --- Start of shipment-allocation.js content ---

const shipmentModuleState = {
    allExtractedData: {},
    viewDefinitions: [
        { name: 'Jordon',    displayName: 'Jordon',    filterColumnLetter: 'C' },
        { name: 'Lineage',   displayName: 'Lineage',   filterColumnLetter: 'D' },
        { name: 'Blk 15',    displayName: 'Blk15',     filterColumnLetter: 'E', columns: ['A', 'B', 'C'] },
        { name: 'Coldroom 6',displayName: 'Coldroom 6',filterColumnLetter: 'F', columns: ['A', 'B', 'C'] },
        { name: 'Coldroom 5',displayName: 'Coldroom 5',filterColumnLetter: 'G', columns: ['A', 'B', 'C'] }
    ],
    isInitialized: false,
    currentResultsContainer: null,
    currentShipmentTabNav: null,
    updateInventoryBtn: null
  };

function loadShipmentAllocationPage(supabase) {
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

    const updateBtn = document.getElementById('updateInventoryBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', () => updateInventory(supabase));
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
}


function handleFile(e, supabase) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        processWorkbook(workbook, supabase);
    };
    reader.readAsArrayBuffer(file);
}

function processWorkbook(workbook, supabase) {
    const sheet1 = workbook.Sheets['sheet 1'];
    if (!sheet1) {
        console.error("Sheet 'sheet 1' not found in the workbook.");
        return;
    }
    const sheet1Data = XLSX.utils.sheet_to_json(sheet1, {header: 1, defval: ''});

    const containerNumberCell = sheet1['J2'];
    shipmentModuleState.containerNumber = containerNumberCell ? containerNumberCell.v : 'N/A';

    const jordonSheet = workbook.Sheets['Jordon'];
    if (jordonSheet) {
        const storedDateCell = jordonSheet['D10'];
        let storedDate = storedDateCell ? storedDateCell.w || storedDateCell.v : 'N/A';
        if (storedDate !== 'N/A') {
            storedDate = reformatDateToDDMMYYYY(storedDate);
        }
        shipmentModuleState.storedDate = storedDate;
    } else {
        shipmentModuleState.storedDate = 'N/A';
    }

    const sheet1LookupMap = new Map();
    for (let i = 0; i < sheet1Data.length - 1; i++) {
        const row = sheet1Data[i];
        const nextRow = sheet1Data[i+1];
        const itemCode = String(row[1] || '').trim();
        if (itemCode) {
            sheet1LookupMap.set(itemCode, {
                packingSize: String(nextRow[2] || '').trim(),
                batchNo: String(nextRow[3] || '').trim()
            });
        }
    }

    const convertSheet = workbook.Sheets['Convert'];
    const convertSheetData = XLSX.utils.sheet_to_json(convertSheet, {header: 1, defval: ''});

    shipmentModuleState.viewDefinitions.forEach(view => {
        if (view.name === 'Jordon') {
            const sheet = workbook.Sheets[view.displayName];
            if (sheet) {
                shipmentModuleState.allExtractedData[view.name] = extractJordonData(sheet, sheet1LookupMap);
            }
        } else if (view.name === 'Lineage') {
            const sheet = workbook.Sheets[view.displayName];
            if (sheet) {
                shipmentModuleState.allExtractedData[view.name] = extractLineageData(sheet, sheet1LookupMap);
            }
        } else {
            shipmentModuleState.allExtractedData[view.name] = extractDataForView(convertSheetData, view, sheet1LookupMap);
        }
    });

    displayExtractedData(shipmentModuleState.allExtractedData[shipmentModuleState.viewDefinitions[0].name]);
    setupTabs();
    updateButtonState();
}

function getColumnIndex(letter) {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
        index = index * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return index - 1;
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function reformatDateToDDMMYYYY(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return dateStr;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        let [month, day, year] = parts;
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        if (year.length === 2) {
            year = '20' + year;
        } else if (year.length === 4) {
            // keep as is
        } else {
             return dateStr;
        }
        return `${day}/${month}/${year}`;
    }
    return dateStr;
}

function extractJordonData(jordonSheet, sheet1LookupMap) {
    const extractedItems = [];
    if (!jordonSheet) return extractedItems;
    const jordonSheetData = XLSX.utils.sheet_to_json(jordonSheet, { header: 1, defval: '' });
    for (let rowIndex = 14; rowIndex < jordonSheetData.length; rowIndex++) {
        const row = jordonSheetData[rowIndex];
        if (!row) continue;
        const productDescription = row[2] ? String(row[2]).trim() : "";
        if (productDescription === "") break;
        const itemCode = row[8] ? String(row[8]).trim() : "";
        const packingSize = row[3] ? String(row[3]).trim() : "";
        let batchNo = "";
        const batchNoCellAddress = 'G' + (rowIndex + 1);
        const batchNoCell = jordonSheet[batchNoCellAddress];
        if (batchNoCell && batchNoCell.w) {
            batchNo = String(batchNoCell.w).trim();
            batchNo = reformatDateToDDMMYYYY(batchNo);
        } else if (batchNoCell && batchNoCell.v !== undefined) {
            let potentialDateStr = String(batchNoCell.v).trim();
            if (potentialDateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
                 batchNo = reformatDateToDDMMYYYY(potentialDateStr);
            } else {
                 batchNo = potentialDateStr;
            }
        }
        const quantity = row[5] ? String(row[5]).trim() : "";
        let rawPalletValueFromCell;
        if (row[4] === 0) {
            rawPalletValueFromCell = "0";
        } else if (row[4]) {
            rawPalletValueFromCell = String(row[4]).trim();
        } else {
            rawPalletValueFromCell = "";
        }
        let pallet = rawPalletValueFromCell;
        const indexOfX = rawPalletValueFromCell.indexOf('x');
        if (indexOfX > -1) {
            pallet = rawPalletValueFromCell.substring(indexOfX + 1).trim();
        }
        const item = { itemCode, productDescription, packingSize, batchNo, quantity, pallet, excelRowNumber: rowIndex + 1 };
        extractedItems.push(item);
    }
    return extractedItems;
}

function extractLineageData(lineageSheet, sheet1LookupMap) {
    const extractedItems = [];
    if (!lineageSheet) return extractedItems;
    const lineageSheetData = XLSX.utils.sheet_to_json(lineageSheet, { header: 1, defval: '' });
    for (let rowIndex = 14; rowIndex < lineageSheetData.length; rowIndex++) {
        const row = lineageSheetData[rowIndex];
        if (!row) continue;

        const productDescription = row[2] ? String(row[2]).trim() : "";
        if (productDescription === "") break;

        const llmItemCode = row[3] ? String(row[3]).trim() : "";

        const packingSize = row[4] ? String(row[4]).trim() : "";

        let rawPalletValueFromCell;
        if (row[5] === 0) {
            rawPalletValueFromCell = "0";
        } else if (row[5]) {
            rawPalletValueFromCell = String(row[5]).trim();
        } else {
            rawPalletValueFromCell = "";
        }
        let pallet = rawPalletValueFromCell;
        const indexOfX = rawPalletValueFromCell.indexOf('x');
        if (indexOfX > -1) {
            pallet = rawPalletValueFromCell.substring(indexOfX + 1).trim();
        }

        const quantity = row[7] ? String(row[7]).trim() : "";

        let batchNo = "";
        const batchNoCellAddress = XLSX.utils.encode_cell({c: 8, r: rowIndex});
        const batchNoCell = lineageSheet[batchNoCellAddress];
        if (batchNoCell && batchNoCell.w) {
            batchNo = String(batchNoCell.w).trim();
            batchNo = reformatDateToDDMMYYYY(batchNo);
        } else if (batchNoCell && batchNoCell.v !== undefined) {
            let potentialDateStr = String(batchNoCell.v).trim();
            if (potentialDateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
                 batchNo = reformatDateToDDMMYYYY(potentialDateStr);
            } else {
                 batchNo = potentialDateStr;
            }
        }

        const itemCode = row[9] ? String(row[9]).trim() : "";

        const item = {
            itemCode,
            productDescription,
            llmItemCode,
            packingSize,
            batchNo,
            quantity,
            pallet,
            excelRowNumber: rowIndex + 1
        };
        extractedItems.push(item);
    }
    return extractedItems;
}

function extractDataForView(sheetData, viewConfig, sheet1LookupMap) {
    const viewResults = [];
    if (!sheetData || sheetData.length === 0) return viewResults;
    const itemCodeColIndexInConvert = getColumnIndex('A');
    const descriptionColIndexInConvert = getColumnIndex('B');
    const quantityColIndexInConvert = getColumnIndex(viewConfig.filterColumnLetter);
    for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row) continue;
        const itemCodeValue = row[itemCodeColIndexInConvert];
        const preppedItemCodeForCheck = (itemCodeValue === null || itemCodeValue === undefined) ? "" : String(itemCodeValue).trim();
        if (preppedItemCodeForCheck === '0') break;
        const itemCodeString = String(itemCodeValue || '').trim();
        const quantityValue = row[quantityColIndexInConvert];
        if (quantityValue) {
            const productDescriptionValue = row[descriptionColIndexInConvert];
            const enrichmentData = sheet1LookupMap.get(itemCodeString);
            const packingSizeValue = enrichmentData ? enrichmentData.packingSize : '';
            const batchNoValue = enrichmentData ? enrichmentData.batchNo : '';
            viewResults.push({
                itemCode: itemCodeValue !== undefined ? itemCodeValue : '',
                productDescription: productDescriptionValue !== undefined ? productDescriptionValue : '',
                quantity: quantityValue !== undefined ? quantityValue : '',
                packingSize: packingSizeValue,
                batchNo: batchNoValue
            });
        }
    }
    return viewResults;
}

function setupTabs() {
    const tabNav = document.getElementById('shipmentTabNav');
    tabNav.innerHTML = '';
    tabNav.style.display = 'flex';

    shipmentModuleState.viewDefinitions.forEach((view, index) => {
        if (shipmentModuleState.allExtractedData[view.name] && shipmentModuleState.allExtractedData[view.name].length > 0) {
            const tab = document.createElement('button');
            tab.textContent = view.displayName;
            tab.dataset.viewName = view.name;
            tab.className = 'tab-link';
            if (index === 0) {
                tab.classList.add('active-tab');
            }
            tab.onclick = () => {
                document.querySelectorAll('#shipmentTabNav .tab-link').forEach(t => t.classList.remove('active-tab'));
                tab.classList.add('active-tab');
                displayExtractedData(shipmentModuleState.allExtractedData[view.name]);
            };
            tabNav.appendChild(tab);
        }
    });
}

function displayExtractedData(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    shipmentModuleState.currentResultsContainer = resultsContainer;
    if (!resultsContainer) return;

    let html = '';
    if (!data || data.length === 0) {
        html += `<p>${translate('No data to display for this view.')}</p>`;
    } else {
        const activeViewName = getActiveViewName();
        let headers = ['Item Code', 'Product Description', 'Packing Size', 'Batch No', 'Quantity'];
        let currentDataKeys = ['itemCode', 'productDescription', 'packingSize', 'batchNo', 'quantity'];

        if (activeViewName === 'Lineage') {
            headers.splice(headers.indexOf('Product Description') + 1, 0, 'LLM Item Code');
            currentDataKeys.splice(currentDataKeys.indexOf('productDescription') + 1, 0, 'llmItemCode');
        }

        if (activeViewName === 'Jordon' || activeViewName === 'Lineage') {
            headers.splice(headers.indexOf('Quantity') + 1, 0, 'Pallet');
            currentDataKeys.splice(currentDataKeys.indexOf('quantity') + 1, 0, 'pallet');
        }
        headers.push('Remove');
        html += '<table border="1"><thead><tr>';
        headers.forEach(h => {
            html += `<th>${escapeHtml(translate(h))}</th>`;
        });
        html += '</tr></thead><tbody>';
        data.forEach((item, rowIndex) => {
            html += `<tr data-row-index="${rowIndex}">`;
            currentDataKeys.forEach(key => {
                const value = item[key] !== undefined ? item[key] : '';
                html += `<td><input type="text" class="editable-cell-input" data-row-index="${rowIndex}" data-column-key="${escapeHtml(key)}" value="${escapeHtml(value)}"></td>`;
            });
            html += `<td><button class="remove-row-btn" data-row-index="${rowIndex}">X</button></td>`;
            html += '</tr>';
        });
        html += '</tbody>';

        let totalQuantity = 0;
        let totalPallets = 0;

        data.forEach(item => {
            totalQuantity += parseFloat(item.quantity || 0);
            if ((activeViewName === 'Jordon' || activeViewName === 'Lineage') && item.pallet !== undefined) {
                totalPallets += parseFloat(item.pallet || 0);
            }
        });

        html += '<tfoot><tr>';

        const quantityColIdx = currentDataKeys.indexOf('quantity');
        const palletColIdx = (activeViewName === 'Jordon' || activeViewName === 'Lineage') ? currentDataKeys.indexOf('pallet') : -1;
        const numFooterCells = currentDataKeys.length + 1;
        const footerCells = new Array(numFooterCells).fill('<td></td>');

        if (activeViewName === 'Jordon' || activeViewName === 'Lineage') {
            const batchNoColIdx = currentDataKeys.indexOf('batchNo');
            if (batchNoColIdx > 0) {
                footerCells[batchNoColIdx] = `<td><strong>${translate('Total :')}</strong></td>`;
            }
            const palletColIdx = currentDataKeys.indexOf('pallet');
            footerCells[palletColIdx] = `<td><strong>${totalPallets.toLocaleString()}</strong></td>`;
            const quantityColIdx = currentDataKeys.indexOf('quantity');
            footerCells[quantityColIdx] = `<td><strong>${totalQuantity.toLocaleString()}</strong></td>`;
        } else {
            if (quantityColIdx !== -1) {
                const batchNoColIdx = currentDataKeys.indexOf('batchNo');
                if (batchNoColIdx !== -1 && batchNoColIdx < quantityColIdx) {
                    footerCells[batchNoColIdx] = `<td><strong>${translate('Total Quantity')}</strong></td>`;
                } else if (quantityColIdx > 0) {
                     footerCells[quantityColIdx - 1] = `<td><strong>${translate('Total Quantity')}</strong></td>`;
                }
                footerCells[quantityColIdx] = `<td><strong>${totalQuantity.toLocaleString()}</strong></td>`;
            }
        }

        html += footerCells.join('');
        html += '</tr></tfoot></table>';
    }
    resultsContainer.innerHTML = html;
}

function getActiveViewName() {
    const tabNavEl = document.getElementById('shipmentTabNav');
    if (!tabNavEl) return shipmentModuleState.viewDefinitions.length > 0 ? shipmentModuleState.viewDefinitions[0].name : null;
    const activeTab = tabNavEl.querySelector('.active-tab');
    return (activeTab && activeTab.dataset.viewName) ? activeTab.dataset.viewName : (shipmentModuleState.viewDefinitions.length > 0 ? shipmentModuleState.viewDefinitions[0].name : null);
}

function updateButtonState() {
    const updateBtn = document.getElementById('updateInventoryBtn');
    if (updateBtn) {
        const hasData = Object.values(shipmentModuleState.allExtractedData).some(data => data.length > 0);
        updateBtn.style.display = hasData ? 'block' : 'none';
    }
}

function handleRowRemoveClick(event) {
    if (event.target.classList.contains('remove-row-btn')) {
        const rowIndex = parseInt(event.target.dataset.rowIndex, 10);
        const activeViewName = getActiveViewName();
        if (activeViewName && shipmentModuleState.allExtractedData[activeViewName]) {
            shipmentModuleState.allExtractedData[activeViewName].splice(rowIndex, 1);
            displayExtractedData(shipmentModuleState.allExtractedData[activeViewName]);
            updateButtonState();
        }
    }
}

function handleCellEdit(event) {
    if (event.target.classList.contains('editable-cell-input')) {
        const rowIndex = parseInt(event.target.dataset.rowIndex, 10);
        const columnKey = event.target.dataset.columnKey;
        const newValue = event.target.value;
        const activeViewName = getActiveViewName();
        if (activeViewName && shipmentModuleState.allExtractedData[activeViewName] && shipmentModuleState.allExtractedData[activeViewName][rowIndex]) {
            shipmentModuleState.allExtractedData[activeViewName][rowIndex][columnKey] = newValue;
        }
    }
}

async function lookupOrCreateProduct(itemCode, productName, packingSize, supabase) {
    let { data: products, error } = await supabase
        .from('products')
        .select('item_code')
        .eq('item_code', itemCode);

    if (error) {
        console.error('Error looking up product:', error);
        return { productId: null };
    }

    if (products && products.length > 0) {
        return { productId: products[0].item_code };
    } else {
        const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert([{ item_code: itemCode, product_name: productName, packing_size: packingSize }])
            .select('item_code')
            .single();

        if (insertError) {
            console.error('Error creating product:', insertError);
            return { productId: null };
        }
        return { productId: newProduct.item_code };
    }
}

async function getWarehouseInfo(viewDisplayName) {
    let warehouseId = '';
    switch (viewDisplayName) {
        case 'Jordon': warehouseId = 'jordon'; break;
        case 'Lineage': warehouseId = 'lineage'; break;
        case 'Blk15': warehouseId = 'blk15'; break;
        case 'Coldroom 6': warehouseId = 'coldroom6'; break;
        case 'Coldroom 5': warehouseId = 'coldroom5'; break;
        default:
            warehouseId = viewDisplayName.toLowerCase().replace(/\s+/g, '');
    }
    return { warehouseId };
}

async function updateInventory(supabase) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal" style="z-index: 1050;">
            <div class="modal-body">
                <div class="spinner"></div>
                <p>${translate('Updating inventory...')}</p>
            </div>
        </div>
    `;
    modalContainer.style.display = 'flex';

    try {
        const allItems = [];
        for (const viewName in shipmentModuleState.allExtractedData) {
            const viewData = shipmentModuleState.allExtractedData[viewName];
            const { warehouseId } = await getWarehouseInfo(viewName);
            for (let i = 0; i < viewData.length; i++) {
                const item = viewData[i];
                if (!item.itemCode) {
                    showModal(translate('Error'), translateWithParams('Row {i + 1} in the {viewName} table is missing an item code.', { i: i, viewName: viewName }));
                    return;
                }
                allItems.push({ ...item, warehouse_id: warehouseId });
            }
        }

        for (const item of allItems) {
            const { productId } = await lookupOrCreateProduct(item.itemCode, item.productDescription, item.packingSize, supabase);
            if (!productId) {
                showModal(translate('Error'), translateWithParams('Could not find or create product with item code {item.itemCode}.', { itemCode: item.itemCode }));
                return;
            }

            const inventoryData = {
                item_code: productId,
                warehouse_id: item.warehouse_id,
                batch_no: item.batchNo,
                quantity: parseFloat(item.quantity),
                container: shipmentModuleState.containerNumber,
                details: {},
                excel_row_number: item.excelRowNumber,
                created_at: new Date().toISOString()
            };

            if (item.warehouse_id === 'jordon' || item.warehouse_id === 'lineage') {
                inventoryData.details = {
                    pallet: item.pallet,
                    status: "Pending",
                    location: "",
                    lotNumber: "",
                    dateStored: shipmentModuleState.storedDate,
                    palletType: "",
                    llm_item_code: item.llmItemCode || ""
                };
            }

            // Insert inventory record and get the returned data (including ID)
            const { data: insertedInventory, error: insertError } = await supabase
                .from('inventory')
                .insert([inventoryData])
                .select('id'); // 重要：添加 .select() 来获取插入的记录

            if (insertError) throw insertError;

            // 获取新插入的 inventory ID
            const inventoryId = insertedInventory[0].id;

            const { data: { session } } = await supabase.auth.getSession();
            const userName = session.user.user_metadata.name || session.user.email;

            const transactionData = {
                transaction_type: 'inbound',
                item_code: item.itemCode,
                warehouse_id: item.warehouse_id,
                batch_no: item.batchNo,
                quantity: parseFloat(item.quantity),
                transaction_date: new Date().toISOString().split('T')[0],
                operator_id: userName,
                inventory_id: inventoryId, // 添加 inventory_id
                inventory_details: inventoryData.details // 添加 inventory_details
            };

            const { error: transactionError } = await supabase
                .from('transactions')
                .insert([transactionData]);

            if (transactionError) throw transactionError;
        }

        shipmentModuleState.allExtractedData = {};
        displayExtractedData([]);
        showModal(translate('Success'), translate('Inventory updated successfully!'));
    } catch (error) {
        console.error('Error updating inventory:', error);
        showModal(translate('Error'), `${translate('An unexpected error occurred: ')}${error.message}`);
    } finally {
        hideModal();
    }
}
function showModal(title, message) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal" style="z-index: 1050; position: relative;">
            <div class="modal-header">
                <h2>${escapeHtml(title)}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>${escapeHtml(message)}</p>
            </div>
        </div>
    `;
    modalContainer.style.display = 'flex';
    modalContainer.querySelector('.modal-close').addEventListener('click', () => {
        hideModal();
    });
}

function hideModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.style.display = 'none';
}

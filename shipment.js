let shipmentHeaders = [];

// Pagination state variables
let currentShipmentPage = 1;
const SHIPMENTS_PER_PAGE = 10;
let totalShipmentPages = 1;
let totalShipmentItems = 0;

window.loadShipmentPage = async function (content, supabase) {
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
};

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
  } else if (tabName === 'shipment-upload') {
    initializeShipmentUpload(supabase);
  }
}

function initializeShipmentUpload(supabase) {
  const uploadButton = document.getElementById('uploadButton');
  if (uploadButton) {
    uploadButton.addEventListener('click', () => handleUpload(supabase));
  }
}

async function handleUpload(supabase) {
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

    const response = await fetch('https://script.google.com/macros/s/AKfycbwrHXJsLtVcom-fQtKazcLBgXPSaOKMOUy8KC9aMA7Qldq1CIECgmZi25V2M05jOotm/exec', {
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
      openTab({ currentTarget: shipmentListTab }, 'shipment-list', supabase);
    } else {
      showUploadStatus(`Error: ${result.message || 'An unknown error occurred.'}`, 'error');
    }
  } catch (error) {
    showUploadStatus(`An error occurred: ${error.message}`, 'error');
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
            const dataArray = XLSX.utils.sheet_to_json(sheet, {header: 1, raw: false});

            const extractedData = {
                shipmentNo: getValueFromArray(dataArray, 1, 0),  // A2
                poNo: getValueFromArray(dataArray, 4, 0),        // A5
                containerNumber: getValueFromArray(dataArray, 1, 5),  // F2
                eta: getValueFromArray(dataArray, 3, 5),         // F4
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

function getValueFromArray(dataArray, row, col) {
    if (dataArray[row] && dataArray[row][col] !== undefined) {
        return dataArray[row][col].toString();
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

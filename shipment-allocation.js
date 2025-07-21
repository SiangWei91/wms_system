import * as XLSX from 'xlsx';
import { supabase } from './supabase-client.js';

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

export function loadShipmentAllocationPage() {
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFile, false);
    }

    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.addEventListener('change', handleCellEdit);
        resultsContainer.addEventListener('click', handleRowRemoveClick);
    }

    const updateBtn = document.getElementById('updateInventoryBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', updateInventory);
    }
}

function handleFile(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        processWorkbook(workbook);
    };
    reader.readAsArrayBuffer(file);
}

function processWorkbook(workbook) {
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
        html += '<p>No data to display for this view.</p>';
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
            html += `<th>${escapeHtml(h)}</th>`;
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
                footerCells[batchNoColIdx] = `<td><strong>Total :</strong></td>`;
            }
            const palletColIdx = currentDataKeys.indexOf('pallet');
            footerCells[palletColIdx] = `<td><strong>${totalPallets.toLocaleString()}</strong></td>`;
            const quantityColIdx = currentDataKeys.indexOf('quantity');
            footerCells[quantityColIdx] = `<td><strong>${totalQuantity.toLocaleString()}</strong></td>`;
        } else {
            if (quantityColIdx !== -1) {
                const batchNoColIdx = currentDataKeys.indexOf('batchNo');
                if (batchNoColIdx !== -1 && batchNoColIdx < quantityColIdx) {
                    footerCells[batchNoColIdx] = `<td><strong>Total Quantity:</strong></td>`;
                } else if (quantityColIdx > 0) {
                     footerCells[quantityColIdx - 1] = `<td><strong>Total Quantity:</strong></td>`;
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

async function lookupOrCreateProduct(itemCode, productName, packingSize) {
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

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

async function updateInventory() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal">
            <div class="modal-body">
                <div class="spinner"></div>
                <p>Updating inventory...</p>
            </div>
        </div>
    `;
    modalContainer.style.display = 'flex';

    const allItems = [];
    for (const viewName in shipmentModuleState.allExtractedData) {
        const viewData = shipmentModuleState.allExtractedData[viewName];
        const { warehouseId } = await getWarehouseInfo(viewName);
        for (let i = 0; i < viewData.length; i++) {
            const item = viewData[i];
            if (!item.itemCode) {
                showModal('Error', `Row ${i + 1} in the ${viewName} table is missing an item code.`);
                return;
            }
            allItems.push({ ...item, warehouse_id: warehouseId });
        }
    }

    for (const item of allItems) {
        try {
            const { productId } = await lookupOrCreateProduct(item.itemCode, item.productDescription, item.packingSize);

            if (!productId) {
                showModal('Error', `Could not find or create product with item code ${item.itemCode}.`);
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

            // Insert new record
            const { error: insertError } = await supabase
                .from('inventory')
                .insert([inventoryData]);
            if (insertError) throw insertError;

            const userName = getCookie('userName');
            const transactionData = {
                transaction_type: 'inbound',
                item_code: item.itemCode,
                warehouse_id: item.warehouse_id,
                batch_no: item.batchNo,
                quantity: parseFloat(item.quantity),
                transaction_date: new Date().toISOString().split('T')[0],
                operator_id: userName
            };

            const { error: transactionError } = await supabase
                .from('transactions')
                .insert([transactionData]);

            if (transactionError) throw transactionError;

        } catch (error) {
            console.error('Error updating inventory for item:', item.itemCode, error);
            showModal('Error', `Error updating inventory for item ${item.itemCode}: ${error.message}`);
            return;
        }
    }

    shipmentModuleState.allExtractedData = {};
    displayExtractedData([]);
    showModal('Success', 'Inventory updated successfully!');
}

function showModal(title, message) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal">
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
        modalContainer.style.display = 'none';
    });
}

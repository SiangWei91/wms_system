const loadServiceRecordPage = async (content, supabase) => {
  let tableData = [];
  let sortColumn = null;
  updateText();
  let sortDirection = 'asc';

  const equipmentOptions = {
    'Forklift': ['B15 FD20T(F180-00472)', 'CR5 7FBR10 - 51326(48V)', 'CR6 6FBR J9-10232(24V)', 'Orange : 8FBN 25(48V)', 'White : BRA10-50S-400(24V)'],
    'Truck': ['YN4970'],
    'Coldroom': ['Coldroom 1', 'Coldroom 2', 'Coldroom 3', 'Coldroom 5', 'Coldroom 6', 'Coldroom 3A', 'Coldroom 3B', 'Blk 15'],
  };

  const fetchServiceRecord = async (supabase) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session.access_token;
      const { data, error } = await supabase.functions.invoke('service-record', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (error) {
        throw error;
      }

      // 🔥 适配新的缓存API响应格式
      let responseData;
      if (data.values) {
        // 直接包含values的格式（原始或缓存的都可能有这个字段）
        responseData = data;
        
        // 如果有缓存信息，显示在控制台
        if (data.cached) {
          console.log('Service Record Cache info:', {
            cached: data.cached,
            cacheTime: data.cacheTime,
            cacheAge: data.cacheAge
          });
        }
      } else {
        throw new Error("Invalid response format");
      }

      if (responseData.values && responseData.values.length > 0) {
        const headers = responseData.values[0];
        tableData = responseData.values.slice(1).map(row => {
          let rowObject = {};
          headers.forEach((header, index) => {
            rowObject[header] = row[index];
          });
          return rowObject;
        });
        renderTable();
      } else {
        const table = content.querySelector('#service-record-table tbody');
        table.innerHTML = `<tr><td colspan="100%">${translate("No data found.")}</td></tr>`;
      }
    } catch (error) {
      console.error('Error fetching service record:', error);
      const table = content.querySelector('#service-record-table tbody');
      table.innerHTML = `<tr><td colspan="100%">${translate("Error loading data: ")}${error.message}</td></tr>`;
    }
  };

  // 🔥 新增：清除缓存的函数
  const clearServiceRecordCache = async (supabase) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session.access_token;
      
      const { data, error } = await supabase.functions.invoke('service-record', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: { action: 'clear-cache' }, // 这会转换为 ?action=clear-cache
      });

      if (error) {
        console.warn('Failed to clear cache:', error);
      } else {
        console.log('Cache cleared successfully');
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error.message);
    }
  };

  const renderTable = () => {
    const table = content.querySelector('#service-record-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    // Clear existing table data
    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (tableData.length > 0) {
      // Create table headers
      const headerRow = document.createElement('tr');
      const headers = Object.keys(tableData[0]);
      headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        th.style.cursor = 'pointer';
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);

      thead.addEventListener('click', (e) => {
        const th = e.target.closest('th');
        if (!th) return;

        const headerText = th.textContent;
        if (sortColumn === headerText) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = headerText;
          sortDirection = 'asc';
        }
        sortData();
        renderTable();
      });

      // Create table rows
      tableData.forEach(rowData => {
        const row = document.createElement('tr');
        headers.forEach(header => {
          const td = document.createElement('td');
          td.textContent = rowData[header];
          row.appendChild(td);
        });
        tbody.appendChild(row);
      });
    }
  };

  const sortData = () => {
    if (sortColumn) {
      tableData.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        if (valA < valB) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
  };

  const setupTabs = () => {
    const tabContainer = content.querySelector('.tab-nav');
    const tabPanes = content.querySelectorAll('.tab-pane');
    const container = content.querySelector('.service-record-container');

    if (tabContainer) {
        tabContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.tab-button');
            if (!button) return;

            const tabId = button.dataset.tab;

            if (tabId === 'add-record-tab') {
                container.classList.add('add-record-active');
            } else {
                container.classList.remove('add-record-active');
            }

            content.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabPanes.forEach(pane => {
                if (pane.id === tabId) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    }
  };

  const setupForm = (supabase) => {
    const form = content.querySelector('#add-record-form');
    const submitButton = form.querySelector('button[type="submit"]');
    const loader = document.createElement('div');
    loader.classList.add('loader');
    submitButton.parentNode.insertBefore(loader, submitButton.nextSibling);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submitButton.disabled = true;
      loader.style.display = 'inline-block';

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      if (data.date) {
        const [year, month, day] = data.date.split('-');
        data.date = `${day}/${month}/${year}`;
      }

      try {
        const formBody = new URLSearchParams(data).toString();
        const response = await fetch('https://script.google.com/macros/s/AKfycbzg03fCWlHwF7pHEEhMPVGjOEmvb-GNA_KlkkHS2n2Shk-tRxNNDpBgKIlpSOXNlvZP/exec', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody,
        });

        loader.style.display = 'none';
        submitButton.disabled = false;

        // 🔥 关键修改：提交成功后立即清除缓存
        console.log('Record submitted successfully, clearing cache...');
        await clearServiceRecordCache(supabase);

        const modal = document.getElementById('modal-servicerecord-container');
        modal.style.display = 'flex';

        const closeButton = document.getElementById('modal-close-button');
        closeButton.onclick = function() {
          modal.style.display = "none";
        }

        window.onclick = function(event) {
          if (event.target == modal) {
            modal.style.display = "none";
          }
        }

        form.reset();
        const dateInput = content.querySelector('#date');
        dateInput.valueAsDate = new Date();
        
        // 🔥 重新获取数据（现在会是最新的，因为缓存已清除）
        fetchServiceRecord(supabase);
      } catch (error) {
        console.error('Error submitting form:', error);
        loader.style.display = 'none';
        submitButton.disabled = false;
        alert(translate('Error adding record. Please try again.'));
      }
    });

    const dateInput = content.querySelector('#date');
    dateInput.valueAsDate = new Date();

    const typeSelect = content.querySelector('#type');
    const equipmentContainer = content.querySelector('#equipment-container');

    typeSelect.addEventListener('change', (event) => {
      const selectedType = event.target.value;
      equipmentContainer.innerHTML = '';

      if (selectedType === 'Another') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'equipment';
        input.name = 'equipment';
        input.required = true;
        equipmentContainer.appendChild(input);
      } else if (equipmentOptions[selectedType]) {
        const select = document.createElement('select');
        select.id = 'equipment';
        select.name = 'equipment';
        select.required = true;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '--Please choose an option--';
        select.appendChild(defaultOption);

        equipmentOptions[selectedType].forEach(optionText => {
          const option = document.createElement('option');
          option.value = optionText;
          option.textContent = optionText;
          select.appendChild(option);
        });
        equipmentContainer.appendChild(select);
      } else {
        const select = document.createElement('select');
        select.id = 'equipment';
        select.name = 'equipment';
        select.required = true;
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '--Please choose a type first--';
        select.appendChild(defaultOption);
        equipmentContainer.appendChild(select);
      }
    });
  };

  fetchServiceRecord(supabase);
  setupTabs();
  setupForm(supabase);
};

window.loadServiceRecordPage = loadServiceRecordPage;

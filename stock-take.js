let allData = {};

const coldrooms = {
  "CR1": "Coldroom 1",
  "CR2": "Coldroom 2",
  "CR3A": "Coldroom 3A",
  "B15": "Blk 15"
};

window.loadStockTakeData = async function(content, supabase) {
  const datePicker = document.getElementById('date-picker');
  datePicker.value = new Date().toISOString().split("T")[0];
  datePicker.addEventListener('change', displayData);

  const tabNav = document.getElementById('stock-take-tab-nav');

  Object.entries(coldrooms).forEach(([value, name], index) => {
    const tab = document.createElement("button");
    tab.className = "tab-button";
    tab.textContent = name;
    tab.dataset.coldroom = value;
    if (index === 0) {
      tab.classList.add("active");
    }
    tabNav.appendChild(tab);
  });

  tabNav.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab-button');
    if (!tab) return;

    document.querySelectorAll(".tab-button").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    displayData();
  });

  const morningTable = document.getElementById('morning-wrapper');
  const afternoonTable = document.getElementById('afternoon-wrapper');
  morningTable.style.display = 'none';
  afternoonTable.style.display = 'none';

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session.access_token;

    const response = await fetch('https://xnwjvhbkzrazluihnzhw.supabase.co/functions/v1/get-sheet-data', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText} - ${errorText}`);
    }
    allData = await response.json();

    if (allData.error) {
      throw new Error(allData.error);
    }

    displayData();
  } catch (error) {
    console.error('Failed to load stock take data:', error);
    const morningTbody = document.getElementById('morning-table-body');
    morningTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
    const morningTable = document.getElementById('morning-wrapper');
    morningTable.style.display = 'block';
  }
}

function displayData() {
  const activeTab = document.querySelector("#stock-take-tab-nav .tab-button.active");
  if (!activeTab) {
    return;
  }
  const coldroom = activeTab.dataset.coldroom;
  const datePicker = document.getElementById('date-picker');
  const selectedDate = datePicker.value;

  if (!selectedDate) {
    alert('Please select a date.');
    return;
  }

  const selectedDateObject = new Date(selectedDate);
  const formattedDate = `${(selectedDateObject.getDate()).toString().padStart(2, '0')}/${(selectedDateObject.getMonth() + 1).toString().padStart(2, '0')}/${selectedDateObject.getFullYear()}`;

  const tableData = allData[coldroom];
  if (!tableData) {
    const morningTbody = document.getElementById('morning-table-body');
    const afternoonTbody = document.getElementById('afternoon-table-body');
    morningTbody.innerHTML = `<tr><td colspan="4" class="text-center">No data found for the selected coldroom.</td></tr>`;
    afternoonTbody.innerHTML = '';
    const morningTable = document.getElementById('morning-wrapper');
    const afternoonTable = document.getElementById('afternoon-wrapper');
    morningTable.style.display = 'block';
    afternoonTable.style.display = 'none';
    return;
  }

  const filteredData = tableData.slice(1).filter(row => {
    if (!row[0]) {
      return false;
    }
    return row[0] === formattedDate;
  }).sort((a, b) => {
    if (a[2] < b[2]) {
      return -1;
    }
    if (a[2] > b[2]) {
      return 1;
    }
    return 0;
  });

  const morningTable = document.getElementById('morning-wrapper');
  const afternoonTable = document.getElementById('afternoon-wrapper');

  morningTable.style.display = 'block';
  afternoonTable.style.display = 'block';

  if (coldroom === 'B15') {
    const previousDateObject = new Date(selectedDateObject);
    previousDateObject.setDate(previousDateObject.getDate() - 1);
    const formattedPreviousDate = `${(previousDateObject.getDate()).toString().padStart(2, '0')}/${(previousDateObject.getMonth() + 1).toString().padStart(2, '0')}/${previousDateObject.getFullYear()}`;

    const previousDayData = tableData.slice(1).filter(row => {
      if (!row[0]) {
        return false;
      }
      return row[0] === formattedPreviousDate;
    }).sort((a, b) => {
      if (a[2] < b[2]) {
        return -1;
      }
      if (a[2] > b[2]) {
        return 1;
      }
      return 0;
    });

    const selectedDayData = filteredData;

    const morningTbody = document.getElementById('morning-table-body');
    morningTbody.innerHTML = '';
    const afternoonTbody = document.getElementById('afternoon-table-body');
    afternoonTbody.innerHTML = '';

    document.querySelector('#morning-wrapper h2').textContent = formattedPreviousDate;
    document.querySelector('#afternoon-wrapper h2').textContent = formattedDate;
    document.querySelector('#afternoon-wrapper .comparison-header').style.display = '';

    if (previousDayData.length === 0) {
        morningTbody.innerHTML = `<tr><td colspan="4" class="text-center">No data found for ${formattedPreviousDate}</td></tr>`;
    } else {
        previousDayData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row[3] || ''}</td>
                <td>${row[4] || ''}</td>
                <td>${row[5] || ''}</td>
                <td>${row[7] || ''}</td>
            `;
            morningTbody.appendChild(tr);
        });
    }

    if (selectedDayData.length === 0) {
        afternoonTbody.innerHTML = `<tr><td colspan="5" class="text-center">No data found for ${formattedDate}</td></tr>`;
    } else {
        const previousDayItems = {};
        previousDayData.forEach(row => {
            previousDayItems[row[2]] = { ctn: parseInt(row[5], 10) || 0 };
        });

        selectedDayData.forEach(row => {
            const itemCode = row[2];
            const previousDayItem = previousDayItems[itemCode];
            let ctnDiff = 0;
            if (previousDayItem) {
                const selectedDayCtn = parseInt(row[5], 10) || 0;
                ctnDiff = selectedDayCtn - previousDayItem.ctn;
            }

            const ctnColor = ctnDiff > 0 ? 'green' : (ctnDiff < 0 ? 'red' : 'black');
            const ctnSign = ctnDiff > 0 ? '+' : '';
            const ctnDisplay = ctnDiff === 0 ? '' : `${ctnSign}${ctnDiff}`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row[3] || ''}</td>
                <td>${row[4] || ''}</td>
                <td>${row[5] || ''}</td>
                <td>${row[7] || ''}</td>
                <td style="color: ${ctnColor}; background-color: #e0f7ff;">${ctnDisplay}</td>
            `;
            afternoonTbody.appendChild(tr);
        });
    }

    return;
  }

  document.querySelector('#morning-wrapper h2').textContent = 'Morning';
  document.querySelector('#afternoon-wrapper h2').textContent = 'Afternoon';
  document.querySelector('#afternoon-wrapper .comparison-header').style.display = '';

  const morningData = filteredData.filter(row => {
    if (!row[1]) {
      return false;
    }
    const time = row[1].split(':');
    const hour = parseInt(time[0], 10);
    return hour < 12;
  });

  const afternoonData = filteredData.filter(row => {
    if (!row[1]) {
        return false;
    }
    const time = row[1].split(':');
    const hour = parseInt(time[0], 10);
    return hour >= 12;
  });

  const morningTbody = document.getElementById('morning-table-body');
  morningTbody.innerHTML = '';
  const afternoonTbody = document.getElementById('afternoon-table-body');
  afternoonTbody.innerHTML = '';

  if (morningData.length === 0) {
    morningTbody.innerHTML = `<tr><td colspan="4" class="text-center">No data found for the morning.</td></tr>`;
  } else {
    morningData.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row[3] || ''}</td>
        <td>${row[4] || ''}</td>
        <td>${row[5] || ''}</td>
        <td>${row[7] || ''}</td>
      `;
      morningTbody.appendChild(tr);
    });
  }

  if (afternoonData.length === 0) {
    afternoonTbody.innerHTML = `<tr><td colspan="5" class="text-center">No data found for the afternoon.</td></tr>`;
  } else {
    const morningItems = {};
    morningData.forEach(row => {
      morningItems[row[2]] = { ctn: parseInt(row[5], 10) || 0 };
    });

    afternoonData.forEach(row => {
      const itemCode = row[2];
      const morningItem = morningItems[itemCode];
      let ctnDiff = 0;
      if (morningItem) {
        const afternoonCtn = parseInt(row[5], 10) || 0;
        ctnDiff = afternoonCtn - morningItem.ctn;
      }

      const ctnColor = ctnDiff > 0 ? 'green' : (ctnDiff < 0 ? 'red' : 'black');
      const ctnSign = ctnDiff > 0 ? '+' : '';
      const ctnDisplay = ctnDiff === 0 ? '' : `${ctnSign}${ctnDiff}`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row[3] || ''}</td>
        <td>${row[4] || ''}</td>
        <td>${row[5] || ''}</td>
        <td>${row[7] || ''}</td>
        <td style="color: ${ctnColor}; background-color: #e0f7ff;">${ctnDisplay}</td>
      `;
      afternoonTbody.appendChild(tr);
    });
  }
}

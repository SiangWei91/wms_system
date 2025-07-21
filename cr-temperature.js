(() => {
  let data = [];
  let charts = [];
  let dateFilter, tabNav, tabContent;
  let isInitialized = false;

  const coldroomGroups = {
    "Coldroom 5": ["Coldroom 5 - 1", "Coldroom 5 - 2"],
    "Coldroom 6": ["Coldroom 6", "Coldroom 6 Chiller"],
    "Blk 15": ["Blk 15", "Blk 15 Chiller"],
  };

  const coldroomNameMap = {
    "Coldroom 5c Chiller": "Coldroom 5c",
    "Coldroom 3B Chiller": "Coldroom 3B",
    "Coldroom 3A Chiller": "Coldroom 3A",
    "Coldroom 3 Chiller": "Coldroom 3",
  };

  const sortOrder = {
    "Coldroom 5 - 1": "desc",
    "Coldroom 5 - 2": "desc",
    "Coldroom 6": "desc",
    "Coldroom 6 Chiller": "asc",
    "Blk 15": "desc",
    "Blk 15 Chiller": "asc",
    "Coldroom 5c": "asc",
    "Coldroom 3 Chiller": "asc",
    "Coldroom 1": "desc",
    "Coldroom 2": "desc",
    "Coldroom 3A": "asc",
    "Coldroom 3B": "asc",
  };

  async function fetchData(supabase) {
    try {
      const { data: fetchedData, error } = await supabase.functions.invoke(
        "get-coldroom-data"
      );

      if (error) {
        throw error;
      }

      data = fetchedData.data.map((item) => ({
        ...item,
        Coldroom: coldroomNameMap[item.Coldroom] || item.Coldroom,
      }));

      dateFilter.value = new Date().toISOString().split("T")[0];
      createTabs();
      renderContent();
    } catch (error) {
      console.error("Error fetching data:", error);
      if (tabContent) {
        tabContent.innerHTML = `<p>Error loading data.</p>`;
      }
    }
  }

  function createTabs() {
    tabNav.innerHTML = "";
    const allColdrooms = [...new Set(data.map((item) => item.Coldroom))];
    const groupedColdrooms = Object.values(coldroomGroups).flat();
    const singleColdrooms = allColdrooms.filter(
      (c) => !groupedColdrooms.includes(c)
    );
    const tabNames = [...Object.keys(coldroomGroups), ...singleColdrooms];

    tabNames.forEach((tabName, index) => {
      const tab = document.createElement("button");
      tab.className = "tab-button";
      tab.textContent = tabName;
      tab.dataset.tabName = tabName;
      if (index === 0) {
        tab.classList.add("active");
      }
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab-button").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        renderContent();
      });
      tabNav.appendChild(tab);
    });
  }

  function renderContent() {
    charts.forEach((c) => c.destroy());
    charts = [];

    const activeTab = document.querySelector(".tab-button.active");
    if (!activeTab) return;

    const selectedTabName = activeTab.dataset.tabName;
    const coldroomsToDisplay = coldroomGroups[selectedTabName] || [selectedTabName];

    tabContent.innerHTML = "";

    coldroomsToDisplay.forEach((coldroom) => {
      const groupContainer = document.createElement("div");
      groupContainer.className = "cr-temperature-group";

      const filteredData = data.filter((item) => {
        const parts = item.Date.split('/');
        const itemDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        const itemDateString = itemDate.toISOString().split("T")[0];
        return item.Coldroom === coldroom && itemDateString === dateFilter.value;
      });

      const tableContainer = createTable(filteredData, coldroom);
      const chartContainer = createChart(filteredData, coldroom);

      groupContainer.appendChild(tableContainer);
      groupContainer.appendChild(chartContainer);
      tabContent.appendChild(groupContainer);
    });
  }

  function createTable(tableData, coldroomName) {
    const container = document.createElement("div");
    container.className = "cr-temperature-table-container modern-table-container";
    const title = document.createElement("h3");
    title.textContent = coldroomName;
    container.appendChild(title);

    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Time</th>
          <th>Temperature</th>
          <th>Check By</th>
          <th>Remark</th>
        </tr>
      </thead>
      <tbody>
        ${tableData
          .map(
            (item) => `
          <tr>
            <td>${item.Time}</td>
            <td>${item.Temperature}</td>
            <td>${item["Check By"]}</td>
            <td>${item.Remark}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    `;
    container.appendChild(table);
    return container;
  }

  function createChart(chartData, coldroomName) {
    const container = document.createElement("div");
    container.className = "cr-temperature-chart-container modern-table-container";
    const title = document.createElement("h3");
    title.textContent = `${coldroomName} - Chart`;
    container.appendChild(title);

    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    const order = sortOrder[coldroomName] || "asc";
    const sortedData = [...chartData].sort((a, b) => {
      const tempA = parseFloat(a.Temperature);
      const tempB = parseFloat(b.Temperature);
      return order === "asc" ? tempA - tempB : tempB - tempA;
    });

    const labels = sortedData.map((item) => item.Time);
    const temperatures = sortedData.map((item) => item.Temperature);

    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Temperature",
            data: temperatures,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
          },
        },
      },
    });
    charts.push(chart);
    return container;
  }

  const handleDateChange = () => {
    renderContent();
  };

  window.loadCrTemperaturePage = (supabase) => {
    dateFilter = document.getElementById("date-filter");
    tabNav = document.getElementById("cr-temperature-tab-nav");
    tabContent = document.getElementById("cr-temperature-tab-content");

    if (dateFilter && !isInitialized) {
      dateFilter.addEventListener("change", handleDateChange);
      fetchData(supabase);
      isInitialized = true;
    } else if (isInitialized) {
        renderContent()
    }
  };
})();

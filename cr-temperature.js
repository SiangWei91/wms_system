const loadCrTemperaturePage = (() => {
  let data = [];
  let charts = [];
  let dateFilter, tabNav, tabContent;

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

  async function fetchData(supabase) {
    try {
      const { data: fetchedData, error } = await supabase.functions.invoke("get-coldroom-data");

      if (error) {
        throw error;
      }

      let rawData;
      if (fetchedData.data) {
        rawData = fetchedData.data;
        console.log('CR Temperature Cache info:', {
          cached: fetchedData.cached,
          cacheTime: fetchedData.cacheTime,
          cacheAge: fetchedData.cacheAge,
          nextRefresh: fetchedData.nextRefresh
        });
      } else {
        rawData = fetchedData;
      }

      data = rawData.map((item) => ({
        ...item,
        Coldroom: coldroomNameMap[item.Coldroom] || item.Coldroom,
      }));

      dateFilter.value = new Date().toISOString().split("T")[0];
      createTabs();
      renderContent();
    } catch (error) {
      console.error("Error fetching data:", error);
      if (tabContent) {
        tabContent.innerHTML = `<p>${translate("Error loading data.")}</p>`;
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
      tabNav.appendChild(tab);
    });

    tabNav.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab-button');
      if (!tab) return;

      document.querySelectorAll(".tab-button").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      renderContent();
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
          <th>${translate("Time")}</th>
          <th>${translate("Temperature")}</th>
          <th>${translate("Check By")}</th>
          <th>${translate("Remark")}</th>
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
    title.textContent = `${coldroomName}${translate(" - Chart")}`;
    container.appendChild(title);

    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    // ✅ 按时间排序（最早 → 最新）
    const sortedData = [...chartData].sort((a, b) => {
      const parseTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
      };
      return parseTime(a.Time) - parseTime(b.Time);
    });

    const labels = sortedData.map((item) => item.Time);
    const temperatures = sortedData.map((item) => item.Temperature);

    const isFreezer = ["Coldroom 5 - 1", "Coldroom 5 - 2", "Coldroom 6", "Blk 15", "Coldroom 1", "Coldroom 2"].includes(coldroomName);

    const chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: translate("Temperature"),
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
            reverse: isFreezer,
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

  return (supabase) => {
    dateFilter = document.getElementById("date-filter");
    tabNav = document.getElementById("cr-temperature-tab-nav");
    tabContent = document.getElementById("cr-temperature-tab-content");

    dateFilter.addEventListener("change", handleDateChange);
    fetchData(supabase);
  };
})();

window.loadCrTemperaturePage = loadCrTemperaturePage;

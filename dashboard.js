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

async function getLatestTemperatures(supabase) {
  try {
    const { data: fetchedData, error } = await supabase.functions.invoke(
      "get-coldroom-data"
    );

    if (error) {
      throw error;
    }

    // 🔥 关键修复：适配新的API响应格式
    let rawData;
    if (fetchedData.data) {
      // 新格式：{ data: [...], cached: true, cacheTime: ... }
      rawData = fetchedData.data;
      console.log('Dashboard Cache info:', {
        cached: fetchedData.cached,
        cacheTime: fetchedData.cacheTime,
        cacheAge: fetchedData.cacheAge,
        nextRefresh: fetchedData.nextRefresh
      });
    } else {
      // 旧格式兼容：直接就是数组
      rawData = fetchedData;
    }

    const data = rawData.map((item) => ({
      ...item,
      Coldroom: coldroomNameMap[item.Coldroom] || item.Coldroom,
      DateTime: new Date(
        `${item.Date.split("/").reverse().join("-")}T${item.Time}`
      ),
    }));

    const allColdrooms = [...new Set(data.map((item) => item.Coldroom))];
    const groupedColdrooms = Object.values(coldroomGroups).flat();
    const singleColdrooms = allColdrooms.filter(
      (c) => !groupedColdrooms.includes(c)
    );
    const tabNames = [...Object.keys(coldroomGroups), ...singleColdrooms];

    const latestTemps = tabNames.map((tabName) => {
      const coldroomsToProcess = coldroomGroups[tabName] || [tabName];
      const latestEntries = coldroomsToProcess.map((coldroom) => {
        const coldroomData = data.filter((d) => d.Coldroom === coldroom);
        return coldroomData.reduce(
          (latest, current) =>
            current.DateTime > latest.DateTime ? current : latest,
          coldroomData[0]
        );
      });
      return { tabName, latestEntries };
    });

    return latestTemps;
  } catch (error) {
    console.error("Error fetching latest temperatures:", error);
    return [];
  }
}

function createTemperatureCard(tempData) {
  const container = document.getElementById("temperature-summary-container");
  const card = document.createElement("div");
  card.className = "stat-card";

  const lastUpdate = tempData.latestEntries[0]
    ? new Intl.DateTimeFormat("en-GB", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(tempData.latestEntries[0].DateTime)
    : translate("N/A");

  let content = `
    <i class="fas fa-thermometer-half"></i>
    <div>
      <h3 class="coldroom-name">${tempData.tabName}</h3>
      <p class="last-update">${translate("Last Update: ")}${lastUpdate}</p>
  `;

  tempData.latestEntries.forEach((entry) => {
    if (entry) {
      const temp = parseFloat(entry.Temperature);
      let color = "";
      const room = entry.Coldroom.toLowerCase();

      if (room.includes("chiller") || room.includes("5c") || room.includes("3a") || room.includes("3b") || room.includes("3")) {
        if (temp >= 6) {
          color = "red";
        } else {
          color = "green";
        }
      } else {
        if (temp >= -15) {
          color = "red";
        } else {
          color = "green";
        }
      }
      content += `<p class="coldroom-name" style="color: ${color};">${entry.Coldroom}: ${entry.Temperature}°C</p>`;
    }
  });

  content += `</div>`;
  card.innerHTML = content;
  container.appendChild(card);
}

// --- Warehouse Capacity Functions ---

const warehouseCapacities = {
  jordon: { name: "Jordon", max: 150 },
  lineage: { name: "Lineage", max: 50 },
  singlong: { name: "Sing Long", max: 75 },
};

async function getPalletCount(supabase, warehouseId) {
  const { data, error } = await supabase
    .from("inventory")
    .select("details->pallet")
    .eq("warehouse_id", warehouseId);

  if (error) {
    console.error(`Error fetching pallet count for ${warehouseId}:`, error);
    return 0;
  }

  // The result from Supabase is an array of objects, e.g., [{ pallet: 1 }, { pallet: 0 }]
  // We need to sum the 'pallet' property of each object.
  return data.reduce((total, item) => total + (item.pallet || 0), 0);
}

function renderWarehouseCard(container, name, current, max, id) {
  const card = document.createElement("div");
  card.className = "stat-card";

  // Determine color based on usage percentage
  const usagePercentage = max > 0 ? (current / max) * 100 : 0;
  let usageColor = '#007bff'; // Blue for normal
  if (usagePercentage > 90) {
    usageColor = '#dc3545'; // Red for high
  } else if (usagePercentage > 70) {
    usageColor = '#fd7e14'; // Orange for warning
  }

  card.innerHTML = `
    <h3 data-translate="${name}">${name}</h3>
    <canvas id="${id}-chart" width="120" height="120"></canvas>
    <p>${current} / ${max} Pallets</p>
  `;

  container.appendChild(card);

  const ctx = document.getElementById(`${id}-chart`).getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [translate("Used"), translate("Available")],
      datasets: [
        {
          data: [current, Math.max(0, max - current)], // Ensure available is not negative
          backgroundColor: [usageColor, "#e9ecef"],
          borderColor: "rgba(255, 255, 255, 0)", // Transparent border
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
        },
      },
    },
  });
}

async function loadWarehouseCapacity(supabase) {
  const container = document.getElementById("warehouse-capacity-container");
  if (!container) return;

  container.innerHTML = ""; // Clear previous content before loading

  for (const id in warehouseCapacities) {
    const warehouse = warehouseCapacities[id];
    const currentPallets = await getPalletCount(supabase, id);
    renderWarehouseCard(container, warehouse.name, currentPallets, warehouse.max, id);
  }
}


// --- Main Dashboard Loading Function ---

window.loadDashboard = async function(supabase) {
  updateText(); // For translations

  // Load warehouse capacity first
  await loadWarehouseCapacity(supabase);

  // Then load temperature data
  const tempContainer = document.getElementById("temperature-summary-container");
  if (tempContainer) {
    tempContainer.innerHTML = ""; // Clear temperature cards before loading
    const latestTemps = await getLatestTemperatures(supabase);
    latestTemps.forEach(createTemperatureCard);
  }
}

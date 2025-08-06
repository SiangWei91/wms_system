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

// 温度阈值配置
const TEMPERATURE_THRESHOLDS = {
  chiller: { max: 6, type: ['chiller', '5c', '3a', '3b', '3'] },
  freezer: { max: -15 }
};

// 添加加载状态管理
const LoadingManager = {
  show(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="dashboard-loading-container" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #666;
        ">
          <div class="dashboard-spinner" style="
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #94a3b8;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 15px;
          "></div>
          <p>${message}</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }
  },
  
  hide(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      const loading = container.querySelector('.dashboard-loading-container');
      if (loading) {
        loading.remove();
      }
    }
  },
  
  showError(containerId, message = 'Failed to load data') {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="dashboard-error-container" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #dc3545;
          text-align: center;
        ">
          <i class="fas fa-exclamation-triangle" style="font-size: 2em; margin-bottom: 15px;"></i>
          <p>${message}</p>
          <button onclick="window.loadDashboard(window.supabase)" style="
            margin-top: 15px;
            padding: 8px 16px;
            background: #94a3b8;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">Retry</button>
        </div>
      `;
    }
  }
};

// 优化温度获取函数
async function getLatestTemperatures(supabase) {
  try {
    // 添加超时控制
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    );
    
    const fetchPromise = supabase.functions.invoke("get-coldroom-data");
    
    const { data: fetchedData, error } = await Promise.race([
      fetchPromise,
      timeoutPromise
    ]);

    if (error) {
      throw error;
    }

    // 适配新的API响应格式
    let rawData;
    if (fetchedData.data) {
      rawData = fetchedData.data;
      console.log('Dashboard Cache info:', {
        cached: fetchedData.cached,
        cacheTime: fetchedData.cacheTime,
        cacheAge: fetchedData.cacheAge,
        nextRefresh: fetchedData.nextRefresh
      });
    } else {
      rawData = fetchedData;
    }

    if (!rawData || rawData.length === 0) {
      throw new Error('No temperature data available');
    }

    // 优化数据处理 - 使用 Map 提高查找性能
    const processedData = rawData.map((item) => ({
      ...item,
      Coldroom: coldroomNameMap[item.Coldroom] || item.Coldroom,
      DateTime: new Date(
        `${item.Date.split("/").reverse().join("-")}T${item.Time}`
      ),
    }));

    // 使用 Map 优化分组操作
    const coldroomDataMap = new Map();
    processedData.forEach(item => {
      if (!coldroomDataMap.has(item.Coldroom)) {
        coldroomDataMap.set(item.Coldroom, []);
      }
      coldroomDataMap.get(item.Coldroom).push(item);
    });

    const allColdrooms = Array.from(coldroomDataMap.keys());
    const groupedColdrooms = Object.values(coldroomGroups).flat();
    const singleColdrooms = allColdrooms.filter(
      (c) => !groupedColdrooms.includes(c)
    );
    const tabNames = [...Object.keys(coldroomGroups), ...singleColdrooms];

    // 优化最新温度获取
    const latestTemps = tabNames.map((tabName) => {
      const coldroomsToProcess = coldroomGroups[tabName] || [tabName];
      const latestEntries = coldroomsToProcess.map((coldroom) => {
        const coldroomData = coldroomDataMap.get(coldroom) || [];
        if (coldroomData.length === 0) return null;
        
        return coldroomData.reduce(
          (latest, current) =>
            current.DateTime > latest.DateTime ? current : latest
        );
      }).filter(entry => entry !== null);
      
      return { tabName, latestEntries };
    }).filter(temp => temp.latestEntries.length > 0);

    return latestTemps;
  } catch (error) {
    console.error("Error fetching latest temperatures:", error);
    throw error; // 重新抛出错误，让调用方处理
  }
}

// 获取即将到达的货物
async function getIncomingShipments(supabase) {
  try {
    console.log("Fetching incoming shipments...");
    const { data, error } = await supabase.functions.invoke("shipment-list?page=1&limit=300", {
      method: 'GET',
    });

    if (error) {
      console.error("Error invoking shipment-list function:", error);
      throw error;
    }

    console.log("Received data from shipment-list function:", data);

    if (!data || !data.values || data.values.length === 0) {
      console.warn("No shipment data or values array is empty.");
      return [];
    }

    const headers = data.values[0];
    const shipmentData = data.values.slice(1);
    
    // 找到 Unload Date 列的索引 (case-insensitive)
    let unloadDateIndex = headers.findIndex(header => 
      header.toLowerCase().trim() === 'unload date'
    );
    
    // 如果没找到 'unload date'，尝试找 'eta' 或其他可能的日期列
    if (unloadDateIndex === -1) {
      unloadDateIndex = headers.findIndex(header => 
        header.toLowerCase().includes('eta') || 
        header.toLowerCase().includes('arrival') ||
        header.toLowerCase().includes('delivery')
      );
    }
    
    if (unloadDateIndex === -1) {
      console.warn('No date column found in shipment data. Available headers:', headers);
      return [];
    }
    
    console.log(`Using column "${headers[unloadDateIndex]}" for dates (index: ${unloadDateIndex})`);

    const now = new Date();
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(now.getDate() + 10);

    console.log(`Filtering for dates between ${now.toLocaleDateString()} and ${tenDaysFromNow.toLocaleDateString()}`);

    const incomingShipments = shipmentData.filter(row => {
      const unloadDateStr = row[unloadDateIndex];
      if (!unloadDateStr) {
        console.log("Skipping row with empty unload date:", row);
        return false;
      }

      // 解析日期 (假设格式是 DD/MM/YYYY)
      const dateParts = unloadDateStr.split('/');
      if (dateParts.length !== 3) {
        console.log(`Skipping row with invalid date format: ${unloadDateStr}`, row);
        return false;
      }
      
      const unloadDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
      console.log(`Processing row: ${row[0]}, Unload Date: ${unloadDate.toLocaleDateString()}, Is valid: ${unloadDate >= now && unloadDate <= tenDaysFromNow}`);
      
      // 检查是否在未来10天内
      return unloadDate >= now && unloadDate <= tenDaysFromNow;
    }).map(row => {
      const shipmentNo = row[0] || 'N/A';
      const poNo = row[1] || 'N/A';
      const containerNo = row[2] || 'N/A';
      const unloadDateStr = row[unloadDateIndex];
      
      // 计算距离今天的天数
      const dateParts = unloadDateStr.split('/');
      const unloadDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
      const daysUntilUnload = Math.ceil((unloadDate - now) / (1000 * 60 * 60 * 24));
      
      return {
        shipmentNo,
        poNo,
        containerNo,
        unloadDate: unloadDateStr,
        daysUntilUnload,
        priority: daysUntilUnload <= 2 ? 'urgent' : daysUntilUnload <= 5 ? 'warning' : 'normal'
      };
    }).sort((a, b) => a.daysUntilUnload - b.daysUntilUnload);

    return incomingShipments;
  } catch (error) {
    console.error("Error fetching incoming shipments:", error);
    throw error;
  }
}

// 优化温度判断逻辑
function getTemperatureStatus(temp, coldroom) {
  const room = coldroom.toLowerCase();
  const temperature = parseFloat(temp);
  
  // 检查是否是冷藏设备
  const isChiller = TEMPERATURE_THRESHOLDS.chiller.type.some(type => 
    room.includes(type)
  );
  
  if (isChiller) {
    return {
      color: temperature >= TEMPERATURE_THRESHOLDS.chiller.max ? 'red' : 'green',
      status: temperature >= TEMPERATURE_THRESHOLDS.chiller.max ? 'warning' : 'normal'
    };
  } else {
    return {
      color: temperature >= TEMPERATURE_THRESHOLDS.freezer.max ? 'red' : 'green',
      status: temperature >= TEMPERATURE_THRESHOLDS.freezer.max ? 'warning' : 'normal'
    };
  }
}

// 优化温度卡片创建
function createTemperatureCard(tempData) {
  const container = document.getElementById("dashboard-temperature-grid");
  if (!container) {
    // 如果新的容器不存在，尝试使用旧的容器ID
    const oldContainer = document.getElementById("temperature-summary-container");
    if (oldContainer) {
      createTemperatureCardOld(tempData, oldContainer);
      return;
    }
    return;
  }
  
  const card = document.createElement("div");
  card.className = "dashboard-temp-card";

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
      <h4 class="dashboard-temp-name">${tempData.tabName}</h4>
      <p class="dashboard-temp-update">${translate("Last Update: ")}${lastUpdate}</p>
  `;

  // 优化温度条目渲染
  tempData.latestEntries.forEach((entry) => {
    if (entry && entry.Temperature !== undefined) {
      const tempStatus = getTemperatureStatus(entry.Temperature, entry.Coldroom);
      
      content += `
        <p class="dashboard-temp-reading" style="color: ${tempStatus.color};">
          ${entry.Coldroom}: ${entry.Temperature}°C
          ${tempStatus.status === 'warning' ? '<i class="fas fa-exclamation-triangle" style="margin-left: 5px;"></i>' : ''}
        </p>
      `;
    }
  });

  content += `</div>`;
  card.innerHTML = content;
  container.appendChild(card);
}

// 创建即将到达货物卡片
function createIncomingShipmentCard(shipment) {
  const container = document.getElementById("dashboard-incoming-list");
  if (!container) return;

  const card = document.createElement("div");
  card.className = `dashboard-incoming-item ${shipment.priority}`;

  card.innerHTML = `
    <div class="dashboard-incoming-header">
      <span class="dashboard-incoming-title">${shipment.shipmentNo}</span>
      <span class="dashboard-incoming-date ${shipment.priority}">
        ${shipment.daysUntilUnload === 0 ? 'Today' : 
          shipment.daysUntilUnload === 1 ? 'Tomorrow' : 
          `${shipment.daysUntilUnload} days`}
      </span>
    </div>
    <div class="dashboard-incoming-details">
      <div><strong>PO:</strong> ${shipment.poNo}</div>
      <div><strong>Container:</strong> ${shipment.containerNo}</div>
      <div><strong>Unload Date:</strong> ${shipment.unloadDate}</div>
    </div>
  `;

  container.appendChild(card);
}

// 存储 Chart 实例以便清理
const chartInstances = new Map();

// 为了向后兼容，添加旧版温度卡片创建函数
function createTemperatureCardOld(tempData, container) {
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

  // 优化温度条目渲染
  tempData.latestEntries.forEach((entry) => {
    if (entry && entry.Temperature !== undefined) {
      const tempStatus = getTemperatureStatus(entry.Temperature, entry.Coldroom);
      
      content += `
        <p class="coldroom-name" style="color: ${tempStatus.color};">
          ${entry.Coldroom}: ${entry.Temperature}°C
          ${tempStatus.status === 'warning' ? '<i class="fas fa-exclamation-triangle" style="margin-left: 5px;"></i>' : ''}
        </p>
      `;
    }
  });

  content += `</div>`;
  card.innerHTML = content;
  container.appendChild(card);
}

// 优化仓库卡片渲染
function renderWarehouseCard(container, name, current, max, id) {
  const card = document.createElement("div");
  
  // 检查是否使用新的容器
  if (container.id === "dashboard-warehouse-grid") {
    card.className = "dashboard-warehouse-card";
  } else {
    card.className = "stat-card";
  }

  const usagePercentage = max > 0 ? (current / max) * 100 : 0;
  let usageColor = '#94a3b8';
  if (usagePercentage > 90) {
    usageColor = '#ef4444';
  } else if (usagePercentage > 70) {
    usageColor = '#f59e0b';
  }

  // 使用适当的标签
  const headerTag = container.id === "dashboard-warehouse-grid" ? "h4" : "h3";
  
  card.innerHTML = `
    <${headerTag} data-translate="${name}">${name}</${headerTag}>
    <canvas id="${id}-chart" width="120" height="120"></canvas>
    <p>${current} / ${max} Pallets (${Math.round(usagePercentage)}%)</p>
  `;

  container.appendChild(card);

  // 清理旧的 Chart 实例
  if (chartInstances.has(id)) {
    chartInstances.get(id).destroy();
  }

  const ctx = document.getElementById(`${id}-chart`).getContext("2d");
  const chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [translate("Used"), translate("Available")],
      datasets: [
        {
          data: [current, Math.max(0, max - current)],
          backgroundColor: [usageColor, "#e2e8f0"],
          borderColor: "rgba(255, 255, 255, 0)",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
    },
  });

  // 存储 Chart 实例
  chartInstances.set(id, chartInstance);
}

// 缓存仓库数据
const warehouseCache = new Map();
const CACHE_DURATION = 30000; // 30秒缓存

async function getPalletCount(supabase, warehouseId) {
  // 检查缓存
  const cached = warehouseCache.get(warehouseId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from("inventory")
      .select("details->pallet")
      .eq("warehouse_id", warehouseId);

    if (error) {
      console.error(`Error fetching pallet count for ${warehouseId}:`, error);
      return cached ? cached.data : 0; // 返回缓存数据或0
    }

    const count = data.reduce((total, item) => total + (item.pallet || 0), 0);
    
    // 更新缓存
    warehouseCache.set(warehouseId, {
      data: count,
      timestamp: Date.now()
    });

    return count;
  } catch (error) {
    console.error(`Network error for warehouse ${warehouseId}:`, error);
    return cached ? cached.data : 0;
  }
}

const warehouseCapacities = {
  jordon: { name: "Jordon", max: 150 },
  lineage: { name: "Lineage", max: 50 },
  singlong: { name: "Sing Long", max: 75 },
};

async function loadWarehouseCapacity(supabase) {
  const container = document.getElementById("dashboard-warehouse-grid");
  if (!container) return;

  LoadingManager.show("dashboard-warehouse-grid", "Loading warehouse data...");

  try {
    // 并行获取所有仓库数据
    const warehousePromises = Object.entries(warehouseCapacities).map(
      async ([id, warehouse]) => {
        const currentPallets = await getPalletCount(supabase, id);
        return { id, warehouse, currentPallets };
      }
    );

    const results = await Promise.all(warehousePromises);
    
    container.innerHTML = ""; // 清除加载状态

    results.forEach(({ id, warehouse, currentPallets }) => {
      renderWarehouseCard(container, warehouse.name, currentPallets, warehouse.max, id);
    });

  } catch (error) {
    console.error("Error loading warehouse capacity:", error);
    LoadingManager.showError("dashboard-warehouse-grid", "Failed to load warehouse data");
  }
}

async function loadIncomingShipments(supabase) {
  const container = document.getElementById("dashboard-incoming-list");
  if (!container) return;

  LoadingManager.show("dashboard-incoming-container", "Loading shipments...");

  try {
    const incomingShipments = await getIncomingShipments(supabase);
    
    const listContainer = document.getElementById("dashboard-incoming-list");
    if (listContainer) {
      listContainer.innerHTML = "";
      
      if (incomingShipments.length === 0) {
        listContainer.innerHTML = `
          <div class="dashboard-no-data">
            <i class="fas fa-ship" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 12px;"></i>
            <p>No incoming shipments in the next 10 days</p>
          </div>
        `;
      } else {
        incomingShipments.forEach(createIncomingShipmentCard);
      }
    }

    LoadingManager.hide("dashboard-incoming-container");
  } catch (error) {
    console.error("Error loading incoming shipments:", error);
    const errorMessage = error.message.includes("Failed to fetch")
      ? "Could not connect to the server. Please check your network connection."
      : "An unexpected error occurred while loading shipments.";
    LoadingManager.showError("dashboard-incoming-container", errorMessage);
  }
}

// 刷新即将到达货物
window.refreshIncomingShipments = async function() {
  if (window.supabase) {
    await loadIncomingShipments(window.supabase);
  }
}

// 并行加载主函数
window.loadDashboard = async function(supabase) {
  console.time('Dashboard Load Time'); // 性能监控
  
  updateText(); // For translations

  // 显示加载状态
  LoadingManager.show("dashboard-temperature-grid", "Loading temperature data...");

  try {
    // 并行加载所有数据
    const [warehouseResult, temperatureResult, shipmentsResult] = await Promise.allSettled([
      loadWarehouseCapacity(supabase),
      getLatestTemperatures(supabase),
      loadIncomingShipments(supabase)
    ]);

    // 处理温度数据
    const tempContainer = document.getElementById("dashboard-temperature-grid");
    if (tempContainer) {
      if (temperatureResult.status === 'fulfilled') {
        tempContainer.innerHTML = ""; // 清除加载状态
        temperatureResult.value.forEach(createTemperatureCard);
      } else {
        console.error("Temperature loading failed:", temperatureResult.reason);
        LoadingManager.showError("dashboard-temperature-grid", "Failed to load temperature data");
      }
    }

    // 检查其他加载结果
    if (warehouseResult.status === 'rejected') {
      console.error("Warehouse loading failed:", warehouseResult.reason);
    }

    if (shipmentsResult.status === 'rejected') {
      console.error("Shipments loading failed:", shipmentsResult.reason);
    }

  } catch (error) {
    console.error("Dashboard loading error:", error);
    LoadingManager.showError("dashboard-temperature-grid", "Failed to load dashboard");
  }

  console.timeEnd('Dashboard Load Time'); // 性能监控
}

// 添加清理函数
window.cleanupDashboard = function() {
  // 清理所有 Chart 实例
  chartInstances.forEach(chart => chart.destroy());
  chartInstances.clear();
  
  // 清理缓存
  warehouseCache.clear();
}
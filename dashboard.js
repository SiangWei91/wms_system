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

async function getLatestTemperatures() {
  try {
    const { data: fetchedData, error } = await supabase.functions.invoke(
      "get-coldroom-data"
    );

    if (error) {
      throw error;
    }

    const data = fetchedData.data.map((item) => ({
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
    : "N/A";

  let content = `
    <i class="fas fa-thermometer-half"></i>
    <div>
      <h3 class="coldroom-name">${tempData.tabName}</h3>
      <p class="last-update">Last Update: ${lastUpdate}</p>
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

async function loadDashboard() {
  const latestTemps = await getLatestTemperatures();
  const container = document.getElementById("temperature-summary-container");
  container.innerHTML = "";
  latestTemps.forEach(createTemperatureCard);
}

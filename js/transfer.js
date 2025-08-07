const EDGE_FUNCTION_URL = 'https://xnwjvhbkzrazluihnzhw.supabase.co/functions/v1/transfer_memo';

const createTable = (data) => {
    if (!data || data.length === 0) {
        return '<p>No data available.</p>';
    }
    const headers = data[0];
    const rows = data.slice(1);

    let table = '<table class="transfer-table">';
    table += '<thead><tr>';
    headers.forEach(header => {
        table += `<th>${header}</th>`;
    });
    table += '</tr></thead>';
    table += '<tbody>';
    rows.forEach(row => {
        table += '<tr>';
        row.forEach(cell => {
            table += `<td>${cell}</td>`;
        });
        table += '</tr>';
    });
    table += '</tbody></table>';
    return table;
};

const fetchAndRenderTable = async (tabName, sheetName, container, supabaseClient) => {
    // Check if data has already been loaded
    if (container.dataset.loaded) {
        return;
    }

    container.innerHTML = '<p>Loading...</p>';

    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            throw sessionError;
        }

        if (!session) {
            throw new Error("User not authenticated.");
        }

        const accessToken = session.access_token;

        const response = await fetch(EDGE_FUNCTION_URL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const sheetData = result.data[sheetName];
        container.innerHTML = createTable(sheetData);
        container.dataset.loaded = true; // Mark as loaded
    } catch (error) {
        console.error(`Error fetching data for ${tabName}:`, error);
        container.innerHTML = `<p>Error loading data for ${tabName}. Please check the console for details.</p>`;
    }
};

window.loadTransferPage = (supabaseClient) => {
    const tabButtons = document.querySelectorAll('.transfer-tab-button');
    const tabPanes = document.querySelectorAll('.transfer-tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const tab = button.getAttribute('data-tab');
            tabPanes.forEach(pane => {
                if (pane.id === tab) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });

            if (tab === 'inventory-note') {
                const container = document.querySelector('#inventory-note-table');
                fetchAndRenderTable('Inventory Note', 'InventoryTranscationRecord', container, supabaseClient);
            } else if (tab === 'cr5-to-production') {
                const container = document.querySelector('#cr5-to-production-table');
                fetchAndRenderTable('CR5 to Production/Packing Room', 'CR5 transfer to PR', container, supabaseClient);
            }
        });
    });

    // Automatically load the default active tab's data if it's one of the dynamic ones
    const activeTab = document.querySelector('.transfer-tab-button.active');
    if (activeTab) {
        const tabName = activeTab.getAttribute('data-tab');
        if (tabName === 'inventory-note') {
            const container = document.querySelector('#inventory-note-table');
            fetchAndRenderTable('Inventory Note', 'InventoryTranscationRecord', container, supabaseClient);
        } else if (tabName === 'cr5-to-production') {
            const container = document.querySelector('#cr5-to-production-table');
            fetchAndRenderTable('CR5 to Production/Packing Room', 'CR5 transfer to PR', container, supabaseClient);
        }
    }
};

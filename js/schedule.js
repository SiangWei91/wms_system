let employees = [];
let calendar;

// Initialize calendar
function initializeCalendar() {
    console.log('Initializing calendar...');
    
    var calendarEl = document.getElementById('calendar');
    
    if (!calendarEl) {
        console.error('Calendar element not found');
        return;
    }
    
    console.log('Creating FullCalendar instance...');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'en', // English locale
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: 'dayGridMonth'
        },
        buttonText: {
            month: 'Month'
        },
        editable: true,
        droppable: true,
        eventReceive: function(info) {
            console.log('Event added to calendar:', info.event.title);
        },
        eventClick: function(info) {
            if (confirm('Are you sure you want to delete this shift?')) {
                info.event.remove();
            }
        }
    });

    console.log('Rendering calendar...');
    calendar.render();
    console.log('Calendar rendered successfully');
}

let draggableInstance; // 存储拖拽实例

// Initialize drag and drop functionality
function initializeDragAndDrop() {
    console.log('Initializing drag and drop...');
    
    var containerEl = document.getElementById('teams-list');
    
    if (!containerEl) {
        console.error('Teams list container not found');
        return;
    }
    
    // 如果已经有拖拽实例，先销毁它
    if (draggableInstance) {
        draggableInstance.destroy();
    }
    
    // 创建新的拖拽实例
    draggableInstance = new FullCalendar.Draggable(containerEl, {
        itemSelector: '.fc-event',
        eventData: function(eventEl) {
            const teamName = eventEl.querySelector('.team-name-display')?.innerText || '';
            const teamMembers = eventEl.querySelector('.team-members-display')?.innerText || '';
            return {
                title: teamName + (teamMembers ? ' - ' + teamMembers : '')
            };
        }
    });
    
    console.log('Drag and drop initialized');
}

// Add employee
function addEmployee() {
    const nameInput = document.getElementById('employee-name');
    const name = nameInput.value.trim();
    
    if (name && !employees.includes(name)) {
        employees.push(name);
        updateEmployeeList();
        nameInput.value = '';
    }
}

// Update employee list display
function updateEmployeeList() {
    const listEl = document.getElementById('employee-list');
    listEl.innerHTML = employees.map(emp => 
        `<span class="employee-tag">${emp}<span class="remove-btn" onclick="removeEmployee('${emp}')">×</span></span>`
    ).join('');
}

// Remove employee
function removeEmployee(name) {
    employees = employees.filter(emp => emp !== name);
    updateEmployeeList();
}

// Create team/shift
function createTeam() {
    const teamNameInput = document.getElementById('team-name');
    const teamName = teamNameInput.value.trim();
    
    if (!teamName) {
        alert('Please enter shift name');
        return;
    }
    
    if (employees.length === 0) {
        alert('Please add employees first');
        return;
    }

    // Create draggable shift element
    const teamEl = document.createElement('div');
    teamEl.className = 'fc-event fc-h-event fc-daygrid-event fc-daygrid-block-event custom-team';
    teamEl.innerHTML = `
        <div class="fc-event-main">
            <div class="team-name-display">${teamName}</div>
            <div class="team-members-display">${employees.join(', ')}</div>
        </div>
    `;

    document.getElementById('teams-list').appendChild(teamEl);
    
    // 重新初始化拖拽功能（现在会正确处理重复绑定）
    initializeDragAndDrop();
    
    // Clear input
    teamNameInput.value = '';
    
    console.log(`Shift "${teamName}" created successfully with employees: ${employees.join(', ')}`);
}

// Setup event listeners
function setupEventListeners() {
    const employeeNameInput = document.getElementById('employee-name');
    const teamNameInput = document.getElementById('team-name');
    
    if (employeeNameInput) {
        employeeNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addEmployee();
            }
        });
    }
    
    if (teamNameInput) {
        teamNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                createTeam();
            }
        });
    }
}

// Export function for main.js to call
window.loadSchedulePage = function(supabaseClient) {
    console.log('Loading schedule page...');
    
    // Check if FullCalendar is available
    if (typeof FullCalendar === 'undefined') {
        console.error('FullCalendar is not available. Please ensure it is loaded in app.html');
        const calendarContainer = document.getElementById('calendar-container');
        if (calendarContainer) {
            calendarContainer.innerHTML = `
                <div style="color: red; text-align: center; padding: 20px; border: 1px solid #dc3545; border-radius: 8px; background-color: #f8d7da;">
                    <h3>❌ FullCalendar Not Loaded</h3>
                    <p>Please ensure FullCalendar library is loaded in app.html</p>
                    <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        🔄 Refresh Page
                    </button>
                </div>
            `;
        }
        return;
    }
    
    try {
        console.log('FullCalendar is available, initializing components...');
        
        // Initialize components
        initializeCalendar();
        initializeDragAndDrop();
        setupEventListeners();
        
        console.log('Schedule page loaded successfully!');
        
    } catch (error) {
        console.error('Error loading schedule page:', error);
        const calendarContainer = document.getElementById('calendar-container');
        if (calendarContainer) {
            calendarContainer.innerHTML = `
                <div style="color: red; text-align: center; padding: 20px; border: 1px solid #dc3545; border-radius: 8px; background-color: #f8d7da;">
                    <h3>❌ Initialization Failed</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        🔄 Refresh Page
                    </button>
                </div>
            `;
        }
    }
};
let employees = [];
let calendar;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    initializeDragAndDrop();
});

// 初始化日历
function initializeCalendar() {
    var calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'zh-cn',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: {
            today: '今天',
            month: '月',
            week: '周',
            day: '日'
        },
        editable: true,
        droppable: true,
        eventReceive: function(info) {
            console.log('事件已添加到日历:', info.event.title);
        },
        drop: function(info) {
            // 如果选中了"拖拽后移除"选项
            if (document.getElementById('drop-remove').checked) {
                info.draggedEl.parentNode.removeChild(info.draggedEl);
            }
        },
        eventClick: function(info) {
            if (confirm('确定要删除这个班次吗？')) {
                info.event.remove();
            }
        }
    });

    calendar.render();
}

// 初始化拖拽功能
function initializeDragAndDrop() {
    var containerEl = document.getElementById('teams-list');
    
    new FullCalendar.Draggable(containerEl, {
        itemSelector: '.fc-event',
        eventData: function(eventEl) {
            return {
                title: eventEl.querySelector('.team-name-display').innerText + ' - ' + 
                       eventEl.querySelector('.team-members-display').innerText
            };
        }
    });
}

// 添加员工
function addEmployee() {
    const nameInput = document.getElementById('employee-name');
    const name = nameInput.value.trim();
    
    if (name && !employees.includes(name)) {
        employees.push(name);
        updateEmployeeList();
        nameInput.value = '';
    }
}

// 更新员工列表显示
function updateEmployeeList() {
    const listEl = document.getElementById('employee-list');
    listEl.innerHTML = employees.map(emp => 
        `<span class="employee-tag">${emp}<span class="remove-btn" onclick="removeEmployee('${emp}')">×</span></span>`
    ).join('');
}

// 移除员工
function removeEmployee(name) {
    employees = employees.filter(emp => emp !== name);
    updateEmployeeList();
}

// 创建班次
function createTeam() {
    const teamNameInput = document.getElementById('team-name');
    const teamName = teamNameInput.value.trim();
    
    if (!teamName) {
        alert('请输入班次名称');
        return;
    }
    
    if (employees.length === 0) {
        alert('请先添加员工');
        return;
    }

    // 创建可拖拽的班次元素
    const teamEl = document.createElement('div');
    teamEl.className = 'fc-event fc-h-event fc-daygrid-event fc-daygrid-block-event custom-team';
    teamEl.innerHTML = `
        <div class="fc-event-main">
            <div class="team-name-display">${teamName}</div>
            <div class="team-members-display">${employees.join(', ')}</div>
        </div>
    `;

    document.getElementById('teams-list').appendChild(teamEl);
    
    // 重新初始化拖拽功能
    initializeDragAndDrop();
    
    // 清空输入
    teamNameInput.value = '';
    
    console.log(`班次 "${teamName}" 创建成功，包含员工: ${employees.join(', ')}`);
}

// 回车键支持
document.getElementById('employee-name').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addEmployee();
    }
});

document.getElementById('team-name').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        createTeam();
    }
});
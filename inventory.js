window.loadInventoryPage = async (supabaseClient) => {
  // ========================================
  // 数据获取函数
  // ========================================
  
  const fetchProductStockSummary = async () => {
    // 获取库存汇总数据
    const { data: summaryData, error: summaryError } = await supabaseClient
      .from('product_stock_summary')
      .select('*');

    if (summaryError) {
      console.error('Error fetching summary:', summaryError);
      return [];
    }

    // 获取产品基础信息
    const { data: productsData, error: productsError } = await supabaseClient
      .from('products')
      .select('item_code, row_index, type');

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return [];
    }

    // 合并数据
    const productsMap = new Map(productsData.map(p => [p.item_code, { row_index: p.row_index, type: p.type }]));
    const joinedData = summaryData.map(summaryItem => {
      const productInfo = productsMap.get(summaryItem.item_code);
      return {
        ...summaryItem,
        row_index: productInfo ? productInfo.row_index : undefined,
        type: productInfo ? productInfo.type : undefined
      };
    });

    // 按行索引排序
    joinedData.sort((a, b) => (a.row_index || Infinity) - (b.row_index || Infinity));

    return joinedData;
  };

  // ========================================
  // 全局变量和配置
  // ========================================
  
  let columnsHidden = true;
  let originalData = []; // 存储原始数据用于筛选

  // 产品类型颜色映射
  const typeColorMap = {
    'Export': '#E0F7FA',
    'FISH CAKE': '#E3F2FD',
    'General Product': '#F5F5F5',
    'Local Product': '#F0F9E8',
    'New Year': '#FFE5E5',
    'NGOH HIANG': '#FDE2E4',
    'Production Use': '#FFF3E0',
    'QC': '#F3E8FD',
    'Special Order': '#FEF9C3',
    'Surimi': '#E0F2FE',
    'TRADING': '#E8EAF6',
    'Tray Product': '#E0F2F1',
  };

  // ========================================
  // 工具函数
  // ========================================
  
  // 计算合计数据的辅助函数
  const calculateSums = (data) => {
    return data.reduce((sums, row) => {
      sums.coldroom5 += row.coldroom5 || 0;
      sums.coldroom6 += row.coldroom6 || 0;
      sums.jordon += row.jordon || 0;
      sums.singlong += row.singlong || 0;
      sums.lineage += row.lineage || 0;
      sums.coldroom1 += row.coldroom1 || 0;
      sums.coldroom2 += row.coldroom2 || 0;
      sums.blk15 += row.blk15 || 0;
      return sums;
    }, {
      coldroom5: 0, coldroom6: 0, jordon: 0, singlong: 0,
      lineage: 0, coldroom1: 0, coldroom2: 0, blk15: 0
    });
  };

  // 动态计算第二行表头的位置
  const adjustSecondHeaderPosition = () => {
    const firstHeaderRow = document.querySelector('.table thead tr:first-child');
    if (firstHeaderRow) {
      const firstRowHeight = firstHeaderRow.offsetHeight;
      const secondHeaderCells = document.querySelectorAll('.table thead tr:nth-child(2) th');
      
      secondHeaderCells.forEach(th => {
        th.style.top = firstRowHeight + 'px';
      });
    }
  };

  // 格式化数字显示（添加千位分隔符）
  const formatNumber = (num) => {
    if (num === 0 || num === null || num === undefined) return '';
    return Math.round(num).toLocaleString();
  };

  // ========================================
  // 表头渲染函数
  // ========================================
  
  const renderTableHeaders = (data, columnsHidden) => {
    const thead = document.createElement('thead');
    const headers = ['Item Code', 'Product Name', 'Packing Size', 'Total', 'CR 5', 'CR 6', 'JD', 'SL', 'Lineage', 'CR 1', 'CR 2', 'B15'];
    
    if (!columnsHidden) {
      // 计算合计数据
      const sums = calculateSums(data);
      
      // 第一行表头
      const firstHeaderRow = document.createElement('tr');
      headers.forEach((headerText, index) => {
        const th = document.createElement('th');
        th.textContent = translate(headerText);
        
        if (index < 4) {
          // 前4列需要跨行
          th.rowSpan = 2;
          th.classList.add('main-header');
        }
        firstHeaderRow.appendChild(th);
      });
      
      // 第二行表头（合计行）
      const secondHeaderRow = document.createElement('tr');
      const sumLabels = ['CR 5', 'CR 6', 'JD', 'SL', 'Lineage', 'CR 1', 'CR 2', 'B15'];
      const sumValues = [
        sums.coldroom5, sums.coldroom6, sums.jordon, sums.singlong,
        sums.lineage, sums.coldroom1, sums.coldroom2, sums.blk15
      ];
      
      sumValues.forEach((sum, index) => {
        const sumTh = document.createElement('th');
        sumTh.textContent = formatNumber(sum);
        sumTh.title = sumLabels[index] + ' 总计: ' + Math.round(sum);
        sumTh.classList.add('sum-header');
        secondHeaderRow.appendChild(sumTh);
      });
      
      thead.appendChild(firstHeaderRow);
      thead.appendChild(secondHeaderRow);
      
    } else {
      // 折叠状态：单行表头
      const headerRow = document.createElement('tr');
      headers.forEach((headerText, index) => {
        const th = document.createElement('th');
        th.textContent = translate(headerText);
        
        // 隐藏不需要的列
        if (index >= 4) {
          th.classList.add('hidden');
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
    }
    
    return thead;
  };

  // ========================================
  // 表格主体渲染函数
  // ========================================
  
  const renderTableBody = (data) => {
    const tbody = document.createElement('tbody');

    data.forEach(row => {
      const tr = document.createElement('tr');
      
      // 设置行背景色
      const color = typeColorMap[row.type];
      if (color) {
        tr.style.backgroundColor = color;
      }

      // 计算总计
      const total = (row.coldroom5 || 0) + (row.coldroom6 || 0) + (row.jordon || 0) + 
                   (row.singlong || 0) + (row.lineage || 0) + (row.coldroom1 || 0) + 
                   (row.coldroom2 || 0) + (row.blk15 || 0);

      // 准备单元格数据
      const cells = [
        row.item_code,
        row.product_full_name,
        row.packing_size,
        formatNumber(total),
        formatNumber(row.coldroom5),
        formatNumber(row.coldroom6),
        formatNumber(row.jordon),
        formatNumber(row.singlong),
        formatNumber(row.lineage),
        formatNumber(row.coldroom1),
        formatNumber(row.coldroom2),
        formatNumber(row.blk15)
      ];

      // 创建单元格
      cells.forEach((cellText, index) => {
        const td = document.createElement('td');
        td.textContent = cellText;
        
        // 在折叠状态下隐藏指定列
        if (columnsHidden && index >= 4 && index <= 11) {
          td.classList.add('hidden');
        }
        
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    return tbody;
  };

  // ========================================
  // 主表格渲染函数
  // ========================================
  
  const renderTable = (data) => {
    const tableContainer = document.getElementById('inventory-table-container');
    if (!tableContainer) return;

    const table = document.createElement('table');
    table.className = 'table';
    
    // 使用改进的表头和表体渲染函数
    const thead = renderTableHeaders(data, columnsHidden);
    const tbody = renderTableBody(data);
    
    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
    
    // 动态调整第二行表头位置
    setTimeout(() => {
      adjustSecondHeaderPosition();
    }, 0);

    // 添加行点击事件监听器
    tbody.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;

      const itemCode = tr.cells[0].textContent;
      await showTransactionModal(itemCode);
    });
  };

  // ========================================
  // 交易记录模态框函数
  // ========================================
  
  const showTransactionModal = async (itemCode) => {
    try {
      const { data: transactions, error } = await supabaseClient
        .from('transactions')
        .select(`
          *,
          warehouses ( name )
        `)
        .eq('item_code', itemCode)
        .order('transaction_date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }

      renderModalTable(transactions);
      const modal = document.getElementById('transaction-modal');
      if (modal) {
        modal.style.display = 'block';
      }
    } catch (error) {
      console.error('Error showing transaction modal:', error);
    }
  };

  // ========================================
  // 模态框表格渲染函数
  // ========================================
  
  const renderModalTable = (data) => {
    const modalTableContainer = document.getElementById('modal-table-container');
    if (!modalTableContainer) return;
    modalTableContainer.innerHTML = '';

    // 按仓库分组
    const groupedByWarehouse = data.reduce((acc, row) => {
      const warehouseName = row.warehouses ? row.warehouses.name : row.warehouse_id;
      if (!acc[warehouseName]) {
        acc[warehouseName] = [];
      }
      acc[warehouseName].push(row);
      return acc;
    }, {});

    // 为每个仓库创建表格
    for (const warehouseName in groupedByWarehouse) {
      const warehouseData = groupedByWarehouse[warehouseName];
      
      // 仓库标题
      const warehouseHeader = document.createElement('h3');
      warehouseHeader.textContent = warehouseName;
      modalTableContainer.appendChild(warehouseHeader);

      // 创建表格
      const table = document.createElement('table');
      table.className = 'table';
      const thead = document.createElement('thead');
      const tbody = document.createElement('tbody');
      const tfoot = document.createElement('tfoot');

      // 表头
      const headers = ['Date', 'Type', 'Batch No', 'Quantity'];
      const headerRow = document.createElement('tr');
      headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = translate(headerText);
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);

      // 表体
      let totalQuantity = 0;
      warehouseData.forEach(row => {
        const tr = document.createElement('tr');
        
        // 格式化日期
        const date = new Date(row.transaction_date);
        const formattedDate = date.getDate().toString().padStart(2, '0') + '/' +
                             (date.getMonth() + 1).toString().padStart(2, '0') + '/' +
                             date.getFullYear().toString().slice(-2);
        
        const cells = [
          formattedDate,
          row.transaction_type,
          row.batch_no || '',
          formatNumber(row.quantity)
        ];
        
        cells.forEach(cellText => {
          const td = document.createElement('td');
          td.textContent = cellText;
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
        totalQuantity += row.quantity || 0;
      });

      // 表脚（总计行）
      const footerRow = document.createElement('tr');
      const totalLabelCell = document.createElement('td');
      totalLabelCell.colSpan = 3;
      totalLabelCell.textContent = translate('Total Quantity');
      totalLabelCell.style.textAlign = 'right';
      totalLabelCell.style.fontWeight = 'bold';
      
      const totalValueCell = document.createElement('td');
      totalValueCell.textContent = formatNumber(totalQuantity);
      totalValueCell.style.fontWeight = 'bold';
      totalValueCell.style.backgroundColor = '#f8f9fa';
      
      footerRow.appendChild(totalLabelCell);
      footerRow.appendChild(totalValueCell);
      tfoot.appendChild(footerRow);

      table.appendChild(thead);
      table.appendChild(tbody);
      table.appendChild(tfoot);
      modalTableContainer.appendChild(table);
    }
  };

  // ========================================
  // 筛选和搜索功能
  // ========================================
  
  const setupSearch = () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('keyup', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const tableRows = document.querySelectorAll('.table tbody tr');
        
        tableRows.forEach(row => {
          if (row.cells.length < 4) return; // 防止错误
          
          const itemCode = row.cells[0].textContent.toLowerCase();
          const productName = row.cells[1].textContent.toLowerCase();
          const packingSize = row.cells[2].textContent.toLowerCase();
          
          const matchesSearch = itemCode.includes(searchTerm) || 
                               productName.includes(searchTerm) || 
                               packingSize.includes(searchTerm);
          
          row.style.display = matchesSearch ? '' : 'none';
        });
      });
    }
  };

  const setupProductTypeFilter = (data) => {
    const productTypeFilter = document.getElementById('product-type-filter');
    if (productTypeFilter) {
      // 获取所有唯一的产品类型
      const types = [...new Set(data.map(item => item.type).filter(Boolean))].sort();
      
      // 清空并重新填充选项
      productTypeFilter.innerHTML = '<option value="">All Types</option>';
      types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        productTypeFilter.appendChild(option);
      });

      // 添加变化事件监听器
      productTypeFilter.addEventListener('change', () => {
        const selectedType = productTypeFilter.value;
        const tableRows = document.querySelectorAll('.table tbody tr');
        
        tableRows.forEach((row, index) => {
          if (index >= data.length) return;
          
          const rowType = data[index].type;
          const matchesFilter = !selectedType || rowType === selectedType;
          
          row.style.display = matchesFilter ? '' : 'none';
        });
      });
    }
  };

  // ========================================
  // 列显示切换功能
  // ========================================
  
  const setupToggleButton = (data) => {
    const toggleButton = document.getElementById('toggle-columns-btn');
    if (toggleButton) {
      // 设置初始文本
      const updateButtonText = () => {
        toggleButton.innerHTML = columnsHidden ? translate('Expand') : translate('Collapse');
      };
      
      updateButtonText();
      
      toggleButton.addEventListener('click', () => {
        columnsHidden = !columnsHidden;
        updateButtonText();
        renderTable(data);
      });
    }
  };

  // ========================================
  // 模态框设置
  // ========================================
  
  const setupModal = () => {
    const modal = document.getElementById('transaction-modal');
    const closeButton = document.querySelector('.close-button');
    
    if (modal && closeButton) {
      // 关闭按钮点击事件
      closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
      });
      
      // 点击模态框外部关闭
      window.addEventListener('click', (event) => {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      });
      
      // ESC键关闭模态框
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
          modal.style.display = 'none';
        }
      });
    }
  };

  // ========================================
  // 窗口大小改变处理
  // ========================================
  
  const setupResizeHandler = () => {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        adjustSecondHeaderPosition();
      }, 250);
    });
  };

  // ========================================
  // 错误处理函数
  // ========================================
  
  const handleError = (error, context = '') => {
    console.error('Error in inventory page' + (context ? ' - ' + context : '') + ':', error);
    
    // 可以在这里添加用户友好的错误提示
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.style.cssText = `
      background-color: #f8d7da;
      color: #721c24;
      padding: 12px;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      margin: 10px 0;
    `;
    errorMessage.textContent = 'An error occurred while loading data. Please refresh and try again.';
    
    const container = document.querySelector('.inventory') || document.body;
    container.insertBefore(errorMessage, container.firstChild);
    
    // 5秒后自动移除错误消息
    setTimeout(() => {
      if (errorMessage.parentNode) {
        errorMessage.parentNode.removeChild(errorMessage);
      }
    }, 5000);
  };

  // ========================================
  // 主初始化函数
  // ========================================
  
  try {
    // 获取数据
    const data = await fetchProductStockSummary();
    originalData = data;
    
    // 渲染表格
    renderTable(data);
    
    // 设置各种功能
    setupSearch();
    setupProductTypeFilter(data);
    setupToggleButton(data);
    setupModal();
    setupResizeHandler();
    
    console.log('Inventory page loaded successfully with', data.length, 'items');
    
  } catch (error) {
    handleError(error, 'initialization');
  }

  // ========================================
  // 返回公共API（如果需要）
  // ========================================
  
  return {
    refreshData: async () => {
      try {
        const newData = await fetchProductStockSummary();
        originalData = newData;
        renderTable(newData);
        setupProductTypeFilter(newData);
        setupToggleButton(newData);
      } catch (error) {
        handleError(error, 'refresh');
      }
    },
    
    getCurrentData: () => originalData,
    
    exportData: () => {
      // 可以添加导出功能
      console.log('Export functionality can be implemented here');
    }
  };
};
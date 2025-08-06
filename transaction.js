/**
* 优化的交易管理模块
* 改进点：
* 1. 添加类型检查和错误处理
* 2. 优化性能和用户体验
* 3. 重构代码结构，提高可维护性
* 4. 添加加载状态和防抖功能
* 5. 改进搜索和过滤功能
*/

// 交易管理类
class TransactionManager {
constructor() {
    // 状态管理
    this.state = {
        fetchController: null,
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        hasNextPage: false,
        isLoading: false,
        lastSearchParams: {}
    };

    // 配置常量
    this.config = {
        ITEMS_PER_PAGE: 15,
        SEARCH_DEBOUNCE_DELAY: 300,
        WAREHOUSE_TYPES: {
            PALLET: ['jordon', 'lineage', 'singlong']
        }
    };

    // 缓存
    this.cache = {
        warehouses: null,
        operators: null,
        products: null
    };

    // 防抖定时器
    this.debounceTimers = new Map();
}

/**
 * 初始化交易页面
 */
async init(contentElement, supabase) {
    if (!contentElement) {
        console.error("Content element not found. Cannot load transactions page.");
        return;
    }

    this.supabase = supabase;
    this.contentElement = contentElement;

    try {
        this.renderHTML();
        await this.initializeData();
        this.bindEvents();
    } catch (error) {
        console.error('Failed to initialize transactions:', error);
        this.showError('Failed to initialize transactions page');
    }
}

/**
 * 渲染HTML结构
 */
renderHTML() {
    this.contentElement.innerHTML = `
        <div class="tx-transactions">

            <div class="tx-search-container">
                <form id="transaction-search-form" class="tx-modern-filters">
                    <div class="tx-filter-row">
                        <div class="tx-form-group">
                            <label for="start-date">${translate('Start Date')}</label>
                            <input type="date" id="start-date" name="start-date" class="tx-form-control">
                        </div>
                        <div class="tx-form-group">
                            <label for="end-date">${translate('End Date')}</label>
                            <input type="date" id="end-date" name="end-date" class="tx-form-control">
                        </div>
                        <div class="tx-form-group">
                            <label for="warehouse">${translate('Warehouse')}</label>
                            <select id="warehouse" name="warehouse" class="tx-form-control">
                                <option value="">${translate('All Warehouses')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="tx-filter-row">
                        <div class="tx-form-group">
                            <label for="transaction-type">${translate('Transaction Type')}</label>
                            <select id="transaction-type" name="transaction-type" class="tx-form-control">
                                <option value="">${translate('All Types')}</option>
                            </select>
                        </div>
                        <div class="tx-form-group">
                            <label for="product-search">${translate('Product')}</label>
                            <div class="tx-search-input-container">
                                <input type="text" id="product-search" name="product-search"
                                       placeholder="${translate('Search by code or name')}"
                                       class="tx-form-control" autocomplete="off">
                                <div id="product-suggestions" class="tx-suggestions-dropdown"></div>
                            </div>
                        </div>
                        <div class="tx-form-group">
                            <label for="operator">${translate('Operator')}</label>
                            <select id="operator" name="operator" class="tx-form-control">
                                <option value="">${translate('All Operators')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="tx-filter-actions">
                        <button type="submit" class="tx-btn tx-btn-primary">
                            <i class="fas fa-search"></i> ${translate('Search')}
                        </button>
                        <button type="reset" class="tx-btn tx-btn-secondary">
                            <i class="fas fa-undo"></i> ${translate('Reset')}
                        </button>
                        <button type="button" id="export-btn" class="tx-btn tx-btn-success">
                            <i class="fas fa-download"></i> ${translate('Export')}
                        </button>
                    </div>
                </form>
            </div>

            <div class="tx-table-container">
                <div class="tx-table-header">
                    <div class="tx-table-info">
                        <span id="results-info">${translate('Loading...')}</span>
                    </div>
                    <div class="tx-table-actions">
                        <button id="refresh-btn" class="tx-btn tx-btn-outline">
                            <i class="fas fa-sync-alt"></i> ${translate('Refresh')}
                        </button>
                    </div>
                </div>

                <div class="tx-table-wrapper">
                    <table class="tx-data-table" id="transactions-table">
                        <thead>
                            <tr>
                                <th class="tx-sortable" data-column="transaction_date">
                                    ${translate('Date')} <i class="fas fa-sort"></i>
                                </th>
                                <th class="tx-sortable" data-column="item_code">
                                    ${translate('Item Code')} <i class="fas fa-sort"></i>
                                </th>
                                <th>${translate('Product Name')}</th>
                                <th>${translate('Warehouse')}</th>
                                <th class="tx-sortable" data-column="quantity">
                                    ${translate('Quantity')} <i class="fas fa-sort"></i>
                                </th>
                                <th class="tx-sortable" data-column="operator_id">
                                    ${translate('Operator')} <i class="fas fa-sort"></i>
                                </th>
                                <th class="tx-sortable" data-column="transaction_type">
                                    ${translate('Type')} <i class="fas fa-sort"></i>
                                </th>
                                <th>${translate('Actions')}</th>
                            </tr>
                        </thead>
                        <tbody id="transactions-table-body">
                        </tbody>
                    </table>
                </div>

                <div class="tx-table-footer">
                    <div class="tx-pagination" id="pagination"></div>
                    <div class="tx-page-size-selector">
                        <label for="page-size">${translate('Items per page')}:</label>
                        <select id="page-size" class="tx-form-control">
                            <option value="15">15</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- 加载遮罩 -->
            <div id="loading-overlay" class="tx-loading-overlay" style="display: none;">
                <div class="tx-loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>${translate('Loading transactions...')}</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * 初始化数据
 */
async initializeData() {
    this.showLoading(true);
    try {
        await Promise.all([
            this.loadTransactions(),
            this.populateFilterOptions()
        ]);
    } catch (error) {
        console.error('Failed to initialize data:', error);
        this.showError('Failed to load initial data');
    } finally {
        this.showLoading(false);
    }
}

/**
 * 绑定事件监听器
 */
bindEvents() {
    const form = document.getElementById('transaction-search-form');
    const productSearch = document.getElementById('product-search');
    const refreshBtn = document.getElementById('refresh-btn');
    const exportBtn = document.getElementById('export-btn');
    const pageSizeSelect = document.getElementById('page-size');
    const tableBody = document.getElementById('transactions-table-body');
    const tableHeader = document.querySelector('#transactions-table thead');

    // 搜索表单
    form?.addEventListener('submit', this.handleSearch.bind(this));
    form?.addEventListener('reset', this.handleReset.bind(this));

    // 产品搜索自动完成
    productSearch?.addEventListener('input', this.debounce(
        this.handleProductSearch.bind(this),
        this.config.SEARCH_DEBOUNCE_DELAY
    ));

    // 刷新按钮
    refreshBtn?.addEventListener('click', () => this.loadTransactions());

    // 导出按钮
    exportBtn?.addEventListener('click', this.handleExport.bind(this));

    // 页面大小选择
    pageSizeSelect?.addEventListener('change', this.handlePageSizeChange.bind(this));

    // 表格操作
    tableBody?.addEventListener('click', this.handleTableAction.bind(this));

    // 表头排序
    tableHeader?.addEventListener('click', this.handleSort.bind(this));

    // 点击外部关闭建议
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.tx-search-input-container')) {
            this.hideSuggestions();
        }
    });
}

/**
 * 防抖函数
 */
debounce(func, delay) {
    return (...args) => {
        const key = func.name || 'default';
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        this.debounceTimers.set(key, setTimeout(() => func.apply(this, args), delay));
    };
}

/**
 * 显示/隐藏加载状态
 */
showLoading(show = true) {
    this.state.isLoading = show;
    const overlay = document.getElementById('loading-overlay');
    const refreshBtn = document.getElementById('refresh-btn');

    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }

    if (refreshBtn) {
        refreshBtn.disabled = show;
        const icon = refreshBtn.querySelector('i');
        if (icon) {
            icon.className = show ? 'fas fa-spinner tx-fa-spin' : 'fas fa-sync-alt';
        }
    }
}

/**
 * 显示错误信息
 */
showError(message) {
    const tbody = document.getElementById('transactions-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="tx-no-data tx-text-center tx-text-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.escapeHtml(message)}</p>
                </td>
            </tr>
        `;
    }

    this.updateResultsInfo('Error occurred');
}

/**
 * 更新结果信息
 */
updateResultsInfo(info) {
    const resultsInfo = document.getElementById('results-info');
    if (resultsInfo) {
        resultsInfo.textContent = info;
    }
}

/**
 * 填充过滤选项
 */
async populateFilterOptions() {
    try {
        // 并行加载所有选项
        const [warehouses, operators] = await Promise.all([
            this.loadWarehouses(),
            this.loadOperators()
        ]);

        this.populateSelect('warehouse', warehouses, 'warehouse_id', 'name');
        this.populateSelect('operator', operators, 'operator_id', 'operator_id');

        const { data: transactionTypes, error: transactionTypesError } = await this.supabase
            .from('transactions')
            .select('transaction_type');

        if (transactionTypesError) throw transactionTypesError;

        const uniqueTransactionTypes = [...new Set(transactionTypes.map(t => t.transaction_type).filter(Boolean))].sort();

        const transactionTypeSelect = document.getElementById('transaction-type');
        uniqueTransactionTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            // Capitalize words and replace underscores for better readability
            option.textContent = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            transactionTypeSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Failed to populate filter options:', error);
    }
}

/**
 * 加载仓库列表
 */
async loadWarehouses() {
    if (this.cache.warehouses) {
        return this.cache.warehouses;
    }

    const { data, error } = await this.supabase
        .from('warehouses')
        .select('warehouse_id, name')
        .order('name');

    if (error) throw error;

    this.cache.warehouses = data;
    return data;
}

/**
 * 加载操作员列表
 */
async loadOperators() {
    if (this.cache.operators) {
        return this.cache.operators;
    }

    const { data, error } = await this.supabase
        .from('transactions')
        .select('operator_id')
        .not('operator_id', 'is', null);

    if (error) throw error;

    const uniqueOperators = [...new Set(data.map(t => t.operator_id))]
        .filter(Boolean)
        .map(id => ({ operator_id: id }))
        .sort((a, b) => a.operator_id.localeCompare(b.operator_id));

    this.cache.operators = uniqueOperators;
    return uniqueOperators;
}

/**
 * 填充选择框
 */
populateSelect(selectId, options, valueKey, textKey) {
    const select = document.getElementById(selectId);
    if (!select || !options) return;

    // 清除现有选项（保留第一个默认选项）
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }

    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option[valueKey];
        optionElement.textContent = option[textKey];
        select.appendChild(optionElement);
    });
}

/**
 * 处理产品搜索
 */
async handleProductSearch(event) {
    const searchTerm = event.target.value.trim();

    if (searchTerm.length < 2) {
        this.hideSuggestions();
        return;
    }

    try {
        const { data: products, error } = await this.supabase
            .from('products')
            .select('item_code, product_name')
            .or(`item_code.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        this.showProductSuggestions(products);
    } catch (error) {
        console.error('Failed to search products:', error);
    }
}

/**
 * 显示产品建议
 */
showProductSuggestions(products) {
    const suggestionsDiv = document.getElementById('product-suggestions');
    if (!suggestionsDiv) return;

    if (!products || products.length === 0) {
        this.hideSuggestions();
        return;
    }

    suggestionsDiv.innerHTML = products.map(product => `
        <div class="tx-suggestion-item" data-value="${this.escapeHtml(product.item_code)} - ${this.escapeHtml(product.product_name)}">
            <strong>${this.escapeHtml(product.item_code)}</strong>
            <span>${this.escapeHtml(product.product_name)}</span>
        </div>
    `).join('');

    suggestionsDiv.style.display = 'block';

    // 绑定点击事件
    suggestionsDiv.querySelectorAll('.tx-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById('product-search').value = item.dataset.value;
            this.hideSuggestions();
        });
    });
}

/**
 * 隐藏产品建议
 */
hideSuggestions() {
    const suggestionsDiv = document.getElementById('product-suggestions');
    if (suggestionsDiv) {
        suggestionsDiv.style.display = 'none';
    }
}

/**
 * 处理搜索
 */
async handleSearch(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const searchParams = {
        start_date: formData.get('start-date') || null,
        end_date: formData.get('end-date') || null,
        warehouse_id: formData.get('warehouse') || null,
        product_search: formData.get('product-search') || null,
        operator_id: formData.get('operator') || null,
        transaction_type: formData.get('transaction-type') || null,
    };

    // 清除空值
    Object.keys(searchParams).forEach(key => {
        if (!searchParams[key]) {
            delete searchParams[key];
        }
    });

    this.state.currentPage = 1;
    this.state.lastSearchParams = searchParams;
    await this.loadTransactions(searchParams);
}

/**
 * 处理重置
 */
async handleReset() {
    this.state.currentPage = 1;
    this.state.lastSearchParams = {};
    this.hideSuggestions();
    await this.loadTransactions();
}

/**
 * 处理页面大小变更
 */
async handlePageSizeChange(event) {
    this.config.ITEMS_PER_PAGE = parseInt(event.target.value, 10);
    this.state.currentPage = 1;
    await this.loadTransactions(this.state.lastSearchParams);
}

/**
 * 处理排序
 */
async handleSort(event) {
    const th = event.target.closest('th.tx-sortable');
    if (!th) return;

    const column = th.dataset.column;
    const currentOrder = th.dataset.order || 'none';

    // 重置所有排序图标
    document.querySelectorAll('th.tx-sortable').forEach(header => {
        header.dataset.order = 'none';
        const icon = header.querySelector('i');
        if (icon) icon.className = 'fas fa-sort';
    });

    // 设置当前列排序
    let newOrder;
    if (currentOrder === 'none' || currentOrder === 'desc') {
        newOrder = 'asc';
    } else {
        newOrder = 'desc';
    }

    th.dataset.order = newOrder;
    const icon = th.querySelector('i');
    if (icon) {
        icon.className = newOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }

    // 应用排序
    const searchParams = {
        ...this.state.lastSearchParams,
        sort_column: column,
        sort_order: newOrder
    };

    this.state.currentPage = 1;
    await this.loadTransactions(searchParams);
}

/**
 * 加载交易记录
 */
async loadTransactions(searchParams = {}) {
    // 取消之前的请求
    if (this.state.fetchController) {
        this.state.fetchController.abort();
    }

    this.state.fetchController = new AbortController();
    const signal = this.state.fetchController.signal;

    this.showLoading(true);

    try {
        // 构建查询
        let query = this.supabase
            .from('transactions')
            .select(`*`, { count: 'exact' });

        // 应用搜索条件
        query = this.applySearchFilters(query, searchParams);

        // 应用排序
        if (searchParams.sort_column && searchParams.sort_order) {
            query = query.order(searchParams.sort_column, {
                ascending: searchParams.sort_order === 'asc'
            });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        // 应用分页
        const offset = (this.state.currentPage - 1) * this.config.ITEMS_PER_PAGE;
        query = query.range(offset, offset + this.config.ITEMS_PER_PAGE - 1);

        const { data: transactions, error, count } = await query;

        if (signal.aborted) {
            console.log("Transaction fetch aborted");
            return;
        }

        if (error) throw error;

        // 获取相关的产品和仓库信息
        const productIds = [...new Set(transactions.map(t => t.item_code).filter(Boolean))];
        const warehouseIds = [...new Set(
            transactions.flatMap(t => [t.warehouse_id, t.source_warehouse_id, t.destination_warehouse_id]).filter(Boolean)
        )];

        const [
            { data: products, error: productError },
            { data: warehouses, error: warehouseError }
        ] = await Promise.all([
            this.supabase.from('products').select('item_code, product_name').in('item_code', productIds),
            this.supabase.from('warehouses').select('warehouse_id, name').in('warehouse_id', warehouseIds)
        ]);

        if (productError) throw productError;
        if (warehouseError) throw warehouseError;

        const productMap = new Map(products.map(p => [p.item_code, p.product_name]));
        const warehouseMap = new Map(warehouses.map(w => [w.warehouse_id, w.name]));

        const hydratedTransactions = transactions.map(t => ({
            ...t,
            products: { product_name: productMap.get(t.item_code) || 'N/A' },
            warehouses: { name: warehouseMap.get(t.warehouse_id) || t.warehouse_id },
            source_warehouses: { name: warehouseMap.get(t.source_warehouse_id) || t.source_warehouse_id },
            dest_warehouses: { name: warehouseMap.get(t.destination_warehouse_id) || t.destination_warehouse_id }
        }));

        // 更新状态
        this.state.totalItems = count || 0;
        this.state.totalPages = Math.ceil(this.state.totalItems / this.config.ITEMS_PER_PAGE);
        this.state.hasNextPage = this.state.currentPage < this.state.totalPages;

        // 渲染数据
        this.renderTransactionsTable(hydratedTransactions);
        this.renderPagination();
        this.updateResultsInfo(`${translate('Showing')} ${transactions.length} ${translate('of')} ${this.state.totalItems} ${translate('transactions')}`);

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Failed to fetch transactions:', error);
            this.showError(`${translate('Error loading transactions')}: ${error.message}`);
        }
    } finally {
        this.showLoading(false);
        this.state.fetchController = null;
    }
}

/**
 * 应用搜索过滤条件
 */
applySearchFilters(query, searchParams) {
    if (searchParams.start_date && searchParams.end_date) {
        query = query.gte('transaction_date', searchParams.start_date)
                     .lte('transaction_date', searchParams.end_date);
    } else if (searchParams.start_date) {
        query = query.gte('transaction_date', searchParams.start_date);
    } else if (searchParams.end_date) {
        query = query.lte('transaction_date', searchParams.end_date);
    }

    if (searchParams.warehouse_id) {
        query = query.eq('warehouse_id', searchParams.warehouse_id);
    }

    if (searchParams.operator_id) {
        query = query.eq('operator_id', searchParams.operator_id);
    }

    if (searchParams.transaction_type) {
        query = query.eq('transaction_type', searchParams.transaction_type);
    }

    if (searchParams.product_search) {
        const productCode = searchParams.product_search.split(' - ')[0];
        query = query.ilike('item_code', `%${productCode}%`);
    }

    return query;
}

/**
 * 渲染交易表格
 */
renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="tx-no-data tx-text-center">
                    <i class="fas fa-inbox"></i>
                    <p>${translate('No transactions found')}</p>
                    <small>${translate('Try adjusting your search criteria')}</small>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map(transaction => {
        const row = this.createTransactionRow(transaction);
        return row;
    }).join('');
}

/**
 * 创建交易行
 */
createTransactionRow(transaction) {
    const productName = transaction.products?.product_name || 'N/A';
    const warehouseDisplay = this.getWarehouseDisplay(transaction);
    const quantityDisplay = this.getQuantityDisplay(transaction);
    const typeDisplay = this.getTypeDisplay(transaction.transaction_type);
    const formattedDate = this.formatDate(transaction.transaction_date);

    return `
        <tr data-transaction-id="${transaction.id}">
            <td>
                <time datetime="${transaction.transaction_date}">
                    ${this.escapeHtml(formattedDate)}
                </time>
            </td>
            <td>
                <span class="tx-code">${this.escapeHtml(transaction.item_code || '')}</span>
            </td>
            <td class="tx-product-name">${this.escapeHtml(productName)}</td>
            <td>${warehouseDisplay}</td>
            <td class="tx-quantity">${quantityDisplay}</td>
            <td>
                <span class="tx-operator-badge">
                    ${this.escapeHtml(transaction.operator_id || 'System')}
                </span>
            </td>
            <td>${typeDisplay}</td>
            <td class="tx-actions">
                <div class="tx-action-buttons">
                    <button class="tx-btn-icon tx-view-btn" data-action="view" title="${translate('View Details')}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="tx-btn-icon tx-delete-btn" data-action="delete"
                            data-id="${transaction.id}"
                            data-inventory-id="${transaction.inventory_id}"
                            data-dest-inventory-id="${transaction.destination_inventory_id}"
                            data-quantity="${transaction.quantity}"
                            data-type="${transaction.transaction_type}"
                            title="${translate('Delete Transaction')}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * 获取仓库显示文本
 */
getWarehouseDisplay(transaction) {
    if (transaction.transaction_type === 'internal_transfer' || transaction.transaction_type === 'P.Warehouse transfer') {
        const warehouseName = transaction.warehouses?.name || transaction.warehouse_id;
        const destName = transaction.dest_warehouses?.name || transaction.destination_warehouse_id;
        return `
            <div class="tx-warehouse-transfer">
                <span class="tx-warehouse-name">${this.escapeHtml(warehouseName)}</span>
                <i class="fas fa-arrow-right tx-transfer-arrow"></i>
                <span class="tx-destination">${this.escapeHtml(destName)}</span>
            </div>
        `;
    } else {
        const warehouseName = transaction.warehouses?.name || transaction.warehouse_id;
        return `<span class="tx-warehouse-name">${this.escapeHtml(warehouseName)}</span>`;
    }
}

/**
 * 获取数量显示
 */
getQuantityDisplay(transaction) {
    const quantity = Math.abs(transaction.quantity);

    switch (transaction.transaction_type) {
        case 'inbound':
        case 'from_production':
            return `<span class="tx-quantity-positive">+${quantity.toLocaleString()}</span>`;
        case 'outbound':
        case 'to_production':
            return `<span class="tx-quantity-negative">-${quantity.toLocaleString()}</span>`;
        case 'adjustment':
            const sign = transaction.quantity >= 0 ? '+' : '-';
            const className = transaction.quantity >= 0 ? 'tx-quantity-positive' : 'tx-quantity-negative';
            return `<span class="${className}">${sign}${quantity.toLocaleString()}</span>`;
        default:
            return `<span class="tx-quantity-neutral">${quantity.toLocaleString()}</span>`;
    }
}

/**
 * 获取交易类型显示
 */
getTypeDisplay(type) {
    const typeMap = {
        'inbound': { text: 'Inbound', class: 'tx-type-inbound', icon: 'fa-arrow-down' },
        'outbound': { text: 'Outbound', class: 'tx-type-outbound', icon: 'fa-arrow-up' },
        'internal_transfer': { text: 'Transfer', class: 'tx-type-transfer', icon: 'fa-exchange-alt' },
        'to_production': { text: 'To Production', class: 'tx-type-production', icon: 'fa-cogs' },
        'from_production': { text: 'From Production', class: 'tx-type-production', icon: 'fa-cogs' },
        'adjustment': { text: 'Adjustment', class: 'tx-type-adjustment', icon: 'fa-edit' }
    };

    const typeInfo = typeMap[type];

    if (typeInfo) {
        return `
            <span class="tx-transaction-type ${typeInfo.class}">
                <i class="fas ${typeInfo.icon}"></i>
                ${typeInfo.text}
            </span>
        `;
    } else {
        // For unknown types, just display the text, formatted nicely.
        const formattedText = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `
            <span class="tx-transaction-type tx-type-default">
                ${this.escapeHtml(formattedText)}
            </span>
        `;
    }
}

/**
 * 格式化日期
 */
formatDate(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * 渲染分页
 */
renderPagination() {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;

    if (this.state.totalItems === 0 || this.state.totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    const { currentPage, totalPages } = this.state;
    let paginationHTML = '';

    // 上一页按钮
    paginationHTML += `
        <button class="tx-btn-pagination ${currentPage <= 1 ? 'tx-disabled' : ''}"
                ${currentPage <= 1 ? 'disabled' : ''}
                data-page="${currentPage - 1}">
            <i class="fas fa-chevron-left"></i> ${translate('Previous')}
        </button>
    `;

    // 页码按钮
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 第一页
    if (startPage > 1) {
        paginationHTML += `<button class="tx-btn-pagination" data-page="1">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="tx-pagination-ellipsis">...</span>`;
        }
    }

    // 页码范围
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="tx-btn-pagination ${i === currentPage ? 'tx-active' : ''}"
                    data-page="${i}">${i}</button>
        `;
    }

    // 最后一页
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="tx-pagination-ellipsis">...</span>`;
        }
        paginationHTML += `<button class="tx-btn-pagination" data-page="${totalPages}">${totalPages}</button>`;
    }

    // 下一页按钮
    paginationHTML += `
        <button class="tx-btn-pagination ${!this.state.hasNextPage ? 'tx-disabled' : ''}"
                ${!this.state.hasNextPage ? 'disabled' : ''}
                data-page="${currentPage + 1}">
            ${translate('Next')} <i class="fas fa-chevron-right"></i>
        </button>
    `;

    paginationDiv.innerHTML = paginationHTML;

    // 绑定分页事件
    paginationDiv.addEventListener('click', this.handlePagination.bind(this));
}

/**
 * 处理分页点击
 */
async handlePagination(event) {
    const button = event.target.closest('.tx-btn-pagination');
    if (!button || button.disabled || button.classList.contains('tx-active')) {
        return;
    }

    const page = parseInt(button.dataset.page, 10);
    if (page && page !== this.state.currentPage) {
        this.state.currentPage = page;
        await this.loadTransactions(this.state.lastSearchParams);
    }
}

/**
 * 处理表格操作
 */
async handleTableAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const transactionId = button.closest('tr').dataset.transactionId;


    switch (action) {
        case 'view':
            await this.viewTransactionDetails(transactionId);
            break;
        case 'delete':
            await this.handleDeleteTransaction(button);
            break;
    }
}

/**
 * 查看交易详情
 */
async viewTransactionDetails(transactionId) {
    try {
        const { data: transaction, error } = await this.supabase
            .from('transactions')
            .select(`*`)
            .eq('id', transactionId)
            .single();

        if (error) throw error;

        // 获取相关的产品和仓库信息
        const productIds = [transaction.item_code].filter(Boolean);
        const warehouseIds = [transaction.warehouse_id, transaction.source_warehouse_id, transaction.destination_warehouse_id].filter(Boolean);

        const [
            { data: products, error: productError },
            { data: warehouses, error: warehouseError }
        ] = await Promise.all([
            this.supabase.from('products').select('item_code, product_name').in('item_code', productIds),
            this.supabase.from('warehouses').select('warehouse_id, name').in('warehouse_id', warehouseIds)
        ]);

        if (productError) throw productError;
        if (warehouseError) throw warehouseError;

        const productMap = new Map(products.map(p => [p.item_code, p]));
        const warehouseMap = new Map(warehouses.map(w => [w.warehouse_id, w.name]));

        const hydratedTransaction = {
            ...transaction,
            products: productMap.get(transaction.item_code) || { product_name: 'N/A', description: '' },
            warehouses: { name: warehouseMap.get(transaction.warehouse_id) || transaction.warehouse_id },
            source_warehouses: { name: warehouseMap.get(transaction.source_warehouse_id) || transaction.source_warehouse_id },
            dest_warehouses: { name: warehouseMap.get(transaction.destination_warehouse_id) || transaction.destination_warehouse_id }
        };


        this.showTransactionModal(hydratedTransaction);
    } catch (error) {
        console.error('Failed to fetch transaction details:', error);
        alert(`${translate('Failed to load transaction details')}: ${error.message}`);
    }
}

/**
 * 显示交易详情模态框
 */
showTransactionModal(transaction) {
    const modalHTML = `
        <div class="tx-modal-backdrop" id="transaction-modal">
            <div class="tx-modal-content">
                <div class="tx-modal-header">
                    <h3>${translate('Transaction Details')}</h3>
                    <button class="tx-close-button" type="button">&times;</button>
                </div>
                <div class="tx-modal-body">
                    <div class="tx-detail-grid">
                        <div class="tx-detail-item">
                            <label>${translate('Transaction ID')}</label>
                            <span>${this.escapeHtml(transaction.id)}</span>
                        </div>
                        <div class="tx-detail-item">
                            <label>${translate('Date')}</label>
                            <span>${this.formatDate(transaction.transaction_date)}</span>
                        </div>
                        <div class="tx-detail-item">
                            <label>${translate('Type')}</label>
                            <span>${this.getTypeDisplay(transaction.transaction_type)}</span>
                        </div>
                        <div class="tx-detail-item">
                            <label>${translate('Item Code')}</label>
                            <span><span class="tx-code">${this.escapeHtml(transaction.item_code || '')}</span></span>
                        </div>
                        <div class="tx-detail-item">
                            <label>${translate('Product')}</label>
                            <span>${this.escapeHtml(transaction.products?.product_name || 'N/A')}</span>
                        </div>
                        <div class="tx-detail-item">
                            <label>${translate('Quantity')}</label>
                            <span class="tx-quantity-large">${this.getQuantityDisplay(transaction)}</span>
                        </div>
                        <div class="tx-detail-item">
                            <label>${translate('Warehouse')}</label>
                            <span>${this.getWarehouseDisplay(transaction)}</span>
                        </div>
                        <div class="tx-detail-item">
                            <label>${translate('Operator')}</label>
                            <span>${this.escapeHtml(transaction.operator_id || 'System')}</span>
                        </div>
                        ${transaction.notes ? `
                            <div class="tx-detail-item tx-full-width">
                                <label>${translate('Notes')}</label>
                                <span>${this.escapeHtml(transaction.notes)}</span>
                            </div>
                        ` : ''}
                        ${transaction.inventory_details ? `
                            <div class="tx-detail-item tx-full-width">
                                <label>${translate('Additional Details')}</label>
                                <pre>${this.escapeHtml(JSON.stringify(transaction.inventory_details, null, 2))}</pre>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="tx-modal-footer">
                    <button class="tx-btn tx-btn-secondary" type="button" data-dismiss="modal">
                        ${translate('Close')}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('transaction-modal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('.tx-close-button') || e.target.matches('[data-dismiss="modal"]')) {
            modal.remove();
        }
    });
}

/**
 * 处理删除交易
 */
async handleDeleteTransaction(button) {
    const transactionId = button.dataset.id;
    const inventoryId = button.dataset.inventoryId;
    const destInventoryId = button.dataset.destInventoryId;
    const quantity = parseInt(button.dataset.quantity, 10);
    const type = button.dataset.type;

    const confirmed = await this.showConfirmDialog(
        translate('Confirm Deletion'),
        translate('Are you sure you want to delete this transaction? This will also update the inventory and cannot be undone.'),
        translate('Delete'),
        'danger'
    );

    if (!confirmed) return;

    try {
        await this.deleteTransaction(transactionId, inventoryId, destInventoryId, quantity, type);
        await this.loadTransactions(this.state.lastSearchParams);
        this.showSuccessMessage(translate('Transaction deleted successfully'));
    } catch (error) {
        console.error('Failed to delete transaction:', error);
        this.showErrorMessage(`${translate('Failed to delete transaction')}: ${error.message}`);
    }
}

/**
 * 删除交易
 */
async deleteTransaction(transactionId, inventoryId, destInventoryId, quantity, type) {
    const { data: transaction, error: fetchError } = await this.supabase
        .from('transactions')
        .select('inventory_details, warehouse_id')
        .eq('id', transactionId)
        .single();

    if (fetchError) throw fetchError;

    // 删除交易记录
    const { error: deleteError } = await this.supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);

    if (deleteError) throw deleteError;

    // 更新库存
    await this.updateInventoryAfterDeletion(
        transaction,
        inventoryId,
        destInventoryId,
        quantity,
        type
    );
}

/**
 * 删除后更新库存
 */
async updateInventoryAfterDeletion(transaction, inventoryId, destInventoryId, quantity, type) {
    const palletWarehouses = this.config.WAREHOUSE_TYPES.PALLET;

    switch (type) {
        case 'inbound':
            await this.updateInventoryQuantity(inventoryId, -quantity);
            break;

        case 'outbound':
            await this.updateInventoryQuantity(inventoryId, quantity);
            break;

        case 'internal_transfer':
        case 'P.Warehouse transfer':
            const pallet = transaction.inventory_details?.pallet;

            // 恢复源仓库库存
            await this.updateInventoryQuantity(inventoryId, quantity);
            if (pallet && palletWarehouses.includes(transaction.warehouse_id)) {
                await this.updateInventoryPallet(inventoryId, pallet, 'add');
            }

            // 减少目标仓库库存
            await this.updateInventoryQuantity(destInventoryId, -quantity);
            if (pallet && palletWarehouses.includes(transaction.warehouse_id)) {
                await this.updateInventoryPallet(destInventoryId, pallet, 'remove');
            }
            break;

        case 'adjustment':
            await this.updateInventoryQuantity(inventoryId, -quantity);
            break;

        case 'Container Unload':
            await this.deleteInventoryItem(inventoryId);
            break;
    }
}

/**
 * 更新库存数量
 */
async updateInventoryQuantity(inventoryId, quantityChange) {
    const { data: inventory, error: fetchError } = await this.supabase
        .from('inventory')
        .select('quantity')
        .eq('id', inventoryId)
        .single();

    if (fetchError) throw fetchError;

    const newQuantity = inventory.quantity + quantityChange;

    const { error: updateError } = await this.supabase
        .from('inventory')
        .update({ quantity: Math.max(0, newQuantity) })
        .eq('id', inventoryId);

    if (updateError) throw updateError;
}

/**
 * 更新库存托盘信息
 */
async updateInventoryPallet(inventoryId, pallet, operation) {
    const { data: inventory, error: fetchError } = await this.supabase
        .from('inventory')
        .select('details')
        .eq('id', inventoryId)
        .single();

    if (fetchError) throw fetchError;

    let newDetails = { ...inventory.details };

    if (operation === 'add') {
        const currentPallet = newDetails.pallet ? parseInt(newDetails.pallet, 10) : 0;
        const palletToAdd = parseInt(pallet, 10);
        newDetails.pallet = (currentPallet + palletToAdd).toString();
    } else if (operation === 'remove') {
        if (newDetails.pallet) {
            const pallets = newDetails.pallet.split(',');
            const updatedPallets = pallets.filter(p => p !== pallet);
            newDetails.pallet = updatedPallets.join(',');
        }
    }

    const { error: updateError } = await this.supabase
        .from('inventory')
        .update({ details: newDetails })
        .eq('id', inventoryId);

    if (updateError) throw updateError;
}

async deleteInventoryItem(inventoryId) {
    const { error } = await this.supabase
        .from('inventory')
        .delete()
        .eq('id', inventoryId);

    if (error) throw error;
}

/**
 * 更新库存数量
 */
async updateInventoryQuantity(inventoryId, quantityChange) {
    const { data: inventory, error: fetchError } = await this.supabase
        .from('inventory')
        .select('quantity')
        .eq('id', inventoryId)
        .single();

    if (fetchError) throw fetchError;

    const newQuantity = inventory.quantity + quantityChange;

    const { error: updateError } = await this.supabase
        .from('inventory')
        .update({ quantity: Math.max(0, newQuantity) })
        .eq('id', inventoryId);

    if (updateError) throw updateError;
}

/**
 * 更新库存托盘信息
 */
async updateInventoryPallet(inventoryId, pallet, operation) {
    const { data: inventory, error: fetchError } = await this.supabase
        .from('inventory')
        .select('details')
        .eq('id', inventoryId)
        .single();

    if (fetchError) throw fetchError;

    let newDetails = { ...inventory.details };

    if (operation === 'add') {
        const currentPallet = newDetails.pallet ? parseInt(newDetails.pallet, 10) : 0;
        const palletToAdd = parseInt(pallet, 10);
        newDetails.pallet = (currentPallet + palletToAdd).toString();
    } else if (operation === 'remove') {
        if (newDetails.pallet) {
            const pallets = newDetails.pallet.split(',');
            const updatedPallets = pallets.filter(p => p !== pallet);
            newDetails.pallet = updatedPallets.join(',');
        }
    }

    const { error: updateError } = await this.supabase
        .from('inventory')
        .update({ details: newDetails })
        .eq('id', inventoryId);

    if (updateError) throw updateError;
}

/**
 * 处理导出
 */
async handleExport() {
    try {
        this.showLoading(true);

        // 获取所有符合条件的数据（不分页）
        let query = this.supabase
            .from('transactions')
            .select(`*`);

        query = this.applySearchFilters(query, this.state.lastSearchParams);
        query = query.order('created_at', { ascending: false });

        const { data: transactions, error } = await query;
        if (error) throw error;

        // 获取相关的产品和仓库信息
        const productIds = [...new Set(transactions.map(t => t.item_code).filter(Boolean))];
        const warehouseIds = [...new Set(
            transactions.flatMap(t => [t.warehouse_id, t.source_warehouse_id, t.destination_warehouse_id]).filter(Boolean)
        )];

        const [
            { data: products, error: productError },
            { data: warehouses, error: warehouseError }
        ] = await Promise.all([
            this.supabase.from('products').select('item_code, product_name').in('item_code', productIds),
            this.supabase.from('warehouses').select('warehouse_id, name').in('warehouse_id', warehouseIds)
        ]);

        if (productError) throw productError;
        if (warehouseError) throw warehouseError;

        const productMap = new Map(products.map(p => [p.item_code, p.product_name]));
        const warehouseMap = new Map(warehouses.map(w => [w.warehouse_id, w.name]));

        const hydratedTransactions = transactions.map(t => ({
            ...t,
            products: { product_name: productMap.get(t.item_code) || 'N/A' },
            warehouses: { name: warehouseMap.get(t.warehouse_id) || t.warehouse_id },
            source_warehouses: { name: warehouseMap.get(t.source_warehouse_id) || t.source_warehouse_id },
            dest_warehouses: { name: warehouseMap.get(t.destination_warehouse_id) || t.destination_warehouse_id }
        }));

        this.exportToCSV(hydratedTransactions);
    } catch (error) {
        console.error('Failed to export transactions:', error);
        this.showErrorMessage(`${translate('Failed to export transactions')}: ${error.message}`);
    } finally {
        this.showLoading(false);
    }
}

/**
 * 导出为CSV
 */
exportToCSV(transactions) {
    const headers = [
        'Date',
        'Item Code',
        'Product Name',
        'Type',
        'Warehouse',
        'Quantity',
        'Operator',
        'Notes'
    ];

    const csvData = transactions.map(transaction => [
        this.formatDate(transaction.transaction_date),
        transaction.item_code || '',
        transaction.products?.product_name || '',
        transaction.transaction_type,
        this.getWarehouseDisplayText(transaction),
        transaction.quantity,
        transaction.operator_id || '',
        transaction.notes || ''
    ]);

    const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

/**
 * 获取仓库显示文本（用于导出）
 */
getWarehouseDisplayText(transaction) {
    if (transaction.transaction_type === 'internal_transfer') {
        const sourceName = transaction.source_warehouses?.name || transaction.source_warehouse_id;
        const destName = transaction.dest_warehouses?.name || transaction.destination_warehouse_id;
        return `${sourceName} → ${destName}`;
    } else {
        return transaction.warehouses?.name || transaction.warehouse_id;
    }
}

/**
 * 显示确认对话框
 */
showConfirmDialog(title, message, confirmText = 'Confirm', type = 'primary') {
    return new Promise((resolve) => {
        const modalHTML = `
            <div class="tx-modal-backdrop" id="confirm-modal">
                <div class="tx-modal-content">
                    <div class="tx-modal-header">
                        <h3>${this.escapeHtml(title)}</h3>
                    </div>
                    <div class="tx-modal-body">
                        <p>${this.escapeHtml(message)}</p>
                    </div>
                    <div class="tx-modal-footer">
                        <button class="tx-btn tx-btn-secondary" type="button" data-action="cancel">
                            ${translate('Cancel')}
                        </button>
                        <button class="tx-btn tx-btn-${type}" type="button" data-action="confirm">
                            ${this.escapeHtml(confirmText)}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('confirm-modal');
        modal.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'confirm') {
                resolve(true);
            } else if (action === 'cancel' || e.target === modal) {
                resolve(false);
            }
            modal.remove();
        });
    });
}

/**
 * 显示成功消息
 */
showSuccessMessage(message) {
    this.showToast(message, 'success');
}

/**
 * 显示错误消息
 */
showErrorMessage(message) {
    this.showToast(message, 'error');
}

/**
 * 显示提示消息
 */
showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `tx-toast tx-toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${this.escapeHtml(message)}</span>
    `;

    document.body.appendChild(toast);

    // 显示动画
    setTimeout(() => toast.classList.add('tx-show'), 100);

    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('tx-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * HTML转义
 */
escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
}

// 全局实例
let transactionManager = null;

// 向后兼容的全局函数
window.loadTransactions = async function(contentElement, supabase) {
if (!transactionManager) {
    transactionManager = new TransactionManager();
}
await transactionManager.init(contentElement, supabase);
};

// 导出类以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
module.exports = TransactionManager;
}
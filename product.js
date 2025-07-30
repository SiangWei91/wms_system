// State variables for pagination
let productFetchController = null; // To abort previous fetches
let currentProductSearchTerm = '';
const PRODUCTS_PER_PAGE = 15;

// Pagination state variables (client-side pagination with IndexedDB)
let currentPageNum = 1;
let totalNumPages = 1;
let totalNumItems = 0;
let globalHasNextPage = false;

window.loadProducts = async function(contentElement, supabase) {
    const content = contentElement || document.getElementById('content');
    if (!content) {
        console.error("Content element not found. Cannot load products page.");
        return;
    }
    content.innerHTML = `
        <div class="products">
            <div class="page-header">
                <div class="actions-container">
                    <div class="search-box">
                        <input type="text" id="product-search" placeholder="Search Product..." value="${escapeHtml(currentProductSearchTerm)}">
                        <i class="fas fa-search"></i>
                    </div>
                    <button id="add-product-btn" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Add Product
                    </button>
                </div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Item Code</th>
                            <th>Product Description</th>
                            <th>Packing Size</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="products-table-body">
                    </tbody>
                </table>
                <div class="pagination" id="pagination">
                </div>
            </div>
        </div>
    `;

    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => loadAddProductForm(content, supabase));
    }

    const productSearchInput = document.getElementById('product-search');
    if (productSearchInput) {
        productSearchInput.addEventListener('input', (e) => handleProductSearch(e, supabase));
    }

    const productsTableBody = document.getElementById('products-table-body');
    if (productsTableBody) {
        productsTableBody.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const id = button.dataset.id;
            if (button.classList.contains('view-btn')) {
                viewProduct(id, supabase);
            } else if (button.classList.contains('edit-btn')) {
                editProduct(id, supabase);
            } else if (button.classList.contains('delete-btn')) {
                deleteProduct(id, supabase);
            }
        });
    }

    currentPageNum = 1;
    await fetchProducts({
        searchTerm: currentProductSearchTerm,
        limit: PRODUCTS_PER_PAGE,
        page: currentPageNum
    }, supabase);
}

async function fetchProducts({ searchTerm = '', limit = PRODUCTS_PER_PAGE, page = 1 } = {}, supabase) {
    const tbody = document.getElementById('products-table-body');
    if (!tbody) {
        console.error("Products table body not found. Cannot fetch products.");
        return;
    }
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Loading products...</td></tr>`;

    if (productFetchController) {
        productFetchController.abort();
    }
    productFetchController = new AbortController();
    const signal = productFetchController.signal;

    try {
        const { data, error, count } = await supabase
            .from('products')
            .select('*', { count: 'exact' })
            .or(`product_name.ilike.%${searchTerm}%,item_code.ilike.%${searchTerm}%,product_chinese_name.ilike.%${searchTerm}%`)
            .order('item_code', { ascending: true })
            .range((page - 1) * limit, page * limit - 1)

        if (signal.aborted) {
            console.log("Product fetch aborted");
            return;
        }

        if (error) {
            throw error
        }

        renderProductsTable(data, supabase);

        totalNumItems = count
        totalNumPages = Math.ceil(totalNumItems / limit)
        currentPageNum = page
        globalHasNextPage = page < totalNumPages

        renderPagination(supabase);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted by user.');
        } else {
            console.error('Failed to fetch product list:', error);
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading products: ${escapeHtml(error.message)}</td></tr>`;
            const paginationDiv = document.getElementById('pagination');
            if (paginationDiv) {
                paginationDiv.innerHTML = '<p class="text-danger text-center">Pagination unavailable.</p>';
            }
        }
    } finally {
        productFetchController = null;
    }
}

function renderProductsTable(products, supabase) {
    const tbody = document.getElementById('products-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!products || products.length === 0) {
        const productSearchInput = document.getElementById('product-search');
        const searchTerm = productSearchInput ? productSearchInput.value.trim() : '';
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="no-data text-center">
                    No products found${searchTerm ? ` for "${escapeHtml(searchTerm)}"` : ''}.
                </td>
            </tr>
        `;
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');
        let createdAtDisplay = 'N/A';
        if (product.createdAt) {
            try {
                createdAtDisplay = new Date(product.createdAt).toLocaleString();
            } catch (e) {
                console.warn("Could not parse createdAt date for product:", product.id, product.createdAt, e);
            }
        }

        let productDescription = escapeHtml(product.product_name || '');
        if (product.product_chinese_name) {
            productDescription += ` ${escapeHtml(product.product_chinese_name)}`;
        }

        row.innerHTML = `
            <td>${escapeHtml(product.item_code || '')}</td>
            <td>${productDescription}</td>
            <td>${escapeHtml(product.packing_size || '')}</td>
            <td class="actions">
                <button class="btn-icon view-btn" data-id="${escapeHtml(product.item_code || '')}">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon edit-btn" data-id="${escapeHtml(product.item_code || '')}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete-btn" data-id="${escapeHtml(product.item_code || '')}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

}

function renderPagination(supabase) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) return;
    paginationDiv.innerHTML = '';

    if (totalNumItems === 0 && !currentProductSearchTerm) return;
    if (totalNumPages <= 1 && (!currentProductSearchTerm || (currentProductSearchTerm && totalNumItems <= PRODUCTS_PER_PAGE))) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn-pagination';
    prevBtn.disabled = currentPageNum <= 1;
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
    prevBtn.addEventListener('click', () => {
        if (currentPageNum > 1) {
            fetchProducts({ searchTerm: currentProductSearchTerm, limit: PRODUCTS_PER_PAGE, page: currentPageNum - 1 }, supabase);
        }
    });
    paginationDiv.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Page ${currentPageNum} of ${totalNumPages} (${totalNumItems} items)`;
    paginationDiv.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-pagination';
    nextBtn.disabled = !globalHasNextPage;
    nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
    nextBtn.addEventListener('click', () => {
        if (globalHasNextPage) {
            fetchProducts({ searchTerm: currentProductSearchTerm, limit: PRODUCTS_PER_PAGE, page: currentPageNum + 1 }, supabase);
        }
    });
    paginationDiv.appendChild(nextBtn);
}

function handleProductSearch(e, supabase) {
    currentProductSearchTerm = e.target.value.trim();
    currentPageNum = 1;
    fetchProducts({ searchTerm: currentProductSearchTerm, limit: PRODUCTS_PER_PAGE, page: currentPageNum }, supabase);
}

function loadAddProductForm(contentElement, supabase) {
    const content = contentElement || document.getElementById('content');
     if (!content) return;
    if (typeof window.clearAllPageMessages === 'function') {
        window.clearAllPageMessages();
    }
    content.innerHTML = `
        <div class="form-container">
            <h1>Add Product</h1>
            <form id="product-form">
                <div class="form-group">
                    <label for="product_code">Item Code*</label>
                    <input type="text" id="product_code" name="product_code" required>
                </div>
                <div class="form-group">
                    <label for="name">Product Description*</label>
                    <input type="text" id="name" name="name" required>
                </div>
                <div class="form-group">
                    <label for="product_chinese_name">Chinese Name</label>
                    <input type="text" id="product_chinese_name" name="product_chinese_name">
                </div>
                <div class="form-group">
                    <label for="packaging">Packing Size*</label>
                    <input type="text" id="packaging" name="packaging" required placeholder="Example: 250g x 40p">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        </div>
    `;
    const cancelBtn = document.getElementById('cancel-btn');
    if(cancelBtn) cancelBtn.addEventListener('click', () => { currentProductSearchTerm = ''; currentPageNum = 1; loadProducts(content, supabase); });

    const productForm = document.getElementById('product-form');
    if(productForm) productForm.addEventListener('submit', (e) => handleAddProduct(e, content, supabase));
}

async function handleAddProduct(e, contentElement, supabase) {
    e.preventDefault();
    if (typeof window.clearAllPageMessages === 'function') {
        window.clearAllPageMessages();
    }
    const form = e.target;
    const productData = {
        item_code: form.product_code.value,
        product_name: form.name.value,
        product_chinese_name: form.product_chinese_name.value,
        packing_size: form.packaging.value
    };

    try {
        const { error } = await supabase
            .from('products')
            .insert([productData])
        if (error) {
            throw error
        }
        alert('产品添加成功!');
        currentProductSearchTerm = '';
        currentPageNum = 1;
        loadProducts(contentElement, supabase);
    } catch (error) {
        console.error('添加产品失败:', error);
        alert('添加产品失败: ' + error.message);
    }
}

async function viewProduct(productId, supabase) {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select()
            .eq('item_code', productId)
            .single()
        if (error) {
            throw error
        }
        if (product) {
            const modalContainer = document.getElementById('modal-container');
            modalContainer.innerHTML = `
                <div class="modal">
                    <div class="modal-header">
                        <h2>Product Details</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Item Code:</strong> ${escapeHtml(product.item_code)}</p>
                        <p><strong>Product Name:</strong> ${escapeHtml(product.product_name)}</p>
                        <p><strong>Chinese Name:</strong> ${escapeHtml(product.product_chinese_name || '')}</p>
                        <p><strong>Packing Size:</strong> ${escapeHtml(product.packing_size)}</p>
                    </div>
                </div>
            `;
            modalContainer.style.display = 'flex';
            modalContainer.querySelector('.modal-close').addEventListener('click', () => {
                modalContainer.style.display = 'none';
            });
        } else {
            alert('Product not found.');
        }
    } catch (error) {
        console.error('Failed to view product:', error);
        alert('Failed to view product: ' + error.message);
    }
}

async function editProduct(productId, supabase) {
    const content = document.getElementById('content');
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select()
            .eq('item_code', productId)
            .single()
        if (error) {
            throw error
        }
        if (product) {
            if (!content) return;
            content.innerHTML = `
                <div class="form-container">
                    <h1>Edit Product</h1>
                    <form id="edit-product-form" data-product-id="${escapeHtml(product.item_code || '')}">
                        <div class="form-group">
                            <label for="edit-item_code">Item Code*</label>
                            <input type="text" id="edit-item_code" name="item_code" value="${escapeHtml(product.item_code || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-name">Product Description*</label>
                            <input type="text" id="edit-name" name="name" value="${escapeHtml(product.product_name || '')}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-chineseName">Chinese Name</label>
                            <input type="text" id="edit-chineseName" name="chineseName" value="${escapeHtml(product.product_chinese_name || '')}">
                        </div>
                        <div class="form-group">
                            <label for="edit-packaging">Packing Size*</label>
                            <input type="text" id="edit-packaging" name="packaging" value="${escapeHtml(product.packing_size || '')}" required placeholder="Example: 250g x 40p">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" id="cancel-edit-product-btn">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Changes</button>
                        </div>
                    </form>
                </div>
            `;
            const cancelEditBtn = document.getElementById('cancel-edit-product-btn');
            if(cancelEditBtn) cancelEditBtn.addEventListener('click', () => { currentPageNum = 1; loadProducts(content, supabase); });

            const editForm = document.getElementById('edit-product-form');
            if(editForm) editForm.addEventListener('submit', (e) => handleUpdateProduct(e, content, supabase));

        } else {
            alert('Product not found for editing.');
            currentPageNum = 1;
            loadProducts(content, supabase);
        }
    } catch (error) {
        console.error('Failed to fetch product for editing:', error);
        alert('Failed to fetch product for editing: ' + error.message);
    }
}

async function deleteProduct(productId, supabase) {
    const content = document.getElementById('content');
    if (confirm(`Are you sure you want to delete this product (ID: ${escapeHtml(productId)})?`)) {
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .match({ item_code: productId })
            if (error) {
                throw error
            }
            alert('Product deleted successfully!');
            currentPageNum = 1;
            loadProducts(content, supabase);
        } catch (error) {
            console.error('Failed to delete product:', error);
            alert('Failed to delete product: ' + error.message);
        }
    }
}

async function handleUpdateProduct(e, contentElement, supabase) {
    e.preventDefault();
    const form = e.target;
    const productId = form.dataset.productId;

    const updatedProductData = {
        item_code: form.item_code.value,
        product_name: form.name.value,
        product_chinese_name: form.chineseName.value,
        packing_size: form.packaging.value
    };

    if (!updatedProductData.item_code || !updatedProductData.product_name || !updatedProductData.packing_size) {
        const msg = 'Product Code, Product Description, and Packing Size are required.';
        alert(msg);
        return;
    }

    const saveButton = form.querySelector('button[type="submit"]');
    try {
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
        }
        const { error } = await supabase
            .from('products')
            .update(updatedProductData)
            .match({ item_code: productId })
        if (error) {
            throw error
        }
        alert('Product updated successfully!');
        loadProducts(contentElement, supabase);
    } catch (error) {
        console.error('Failed to update product:', error);
        alert('Failed to update product: ' + error.message);
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Changes';
        }
    }
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

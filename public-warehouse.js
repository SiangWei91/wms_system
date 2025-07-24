window.loadJordonPage = (supabaseClient) => {
  createWarehousePage('jordon', supabaseClient);
};

window.loadLineagePage = (supabaseClient) => {
  createWarehousePage('lineage', supabaseClient);
};

// The tab initialization logic has been moved to warehouse.js

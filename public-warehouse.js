window.loadJordonPage = (content, supabaseClient, user) => {
  createWarehousePage('jordon', supabaseClient, user);
};

window.loadLineagePage = (content, supabaseClient, user) => {
  createWarehousePage('lineage', supabaseClient, user);
};

// The tab initialization logic has been moved to warehouse.js

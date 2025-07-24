const supabaseUrl = "https://xnwjvhbkzrazluihnzhw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhud2p2aGJrenJhemx1aWhuemh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyODI2MDYsImV4cCI6MjA2Nzg1ODYwNn0.jGSW0pQgMzcYxuxNixh4XKgku5Oz-cYspHxxhjQ5tCg";

const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

const setCookie = (name, value, days) => {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Strict; Secure";
};

const getCookie = (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
};

const eraseCookie = (name) => {
    document.cookie = name + '=; Max-Age=-99999999; path=/; domain=' + window.location.hostname;
};

const handleAuthError = (error) => {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.innerText = error.message;
        errorMessage.style.display = 'block';
    } else {
        alert(error.message);
    }
};

const loadedScripts = new Set();

const loadScript = (url) => {
    return new Promise((resolve, reject) => {
        if (loadedScripts.has(url)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
            loadedScripts.add(url);
            resolve();
        };
        script.onerror = (error) => {
            reject(new Error(`Failed to load script: ${url}`));
        };
        document.head.appendChild(script);
    });
};

const loadContent = async (page) => {
    const content = document.getElementById('content');
    if (content) {
        try {
            const response = await fetch(`templates/${page}.html`);
            if (response.ok) {
                content.innerHTML = await response.text();

                const runPageScript = async () => {
                    try {
                        if (page === 'product') {
                            await loadScript('product.js');
                            window.loadProducts(content, supabaseClient);
                        } else if (page === 'stock-take') {
                            await loadScript('stock-take.js');
                            window.loadStockTakeData(content, supabaseClient);
                        } else if (page === 'shipment') {
                            await loadScript('shipment.js');
                            await loadScript('shipment-allocation.js');
                            window.loadShipmentPage(content, supabaseClient);
                            window.loadShipmentAllocationPage(supabaseClient);
                        } else if (page === 'transactions') {
                            await loadScript('transaction.js');
                            window.loadTransactions(content, supabaseClient);
                        } else if (page === 'cr-temperature') {
                            await loadScript('cr-temperature.js');
                            window.loadCrTemperaturePage(supabaseClient);
                        } else if (page === 'dashboard') {
                            await loadScript('dashboard.js');
                            window.loadDashboard(supabaseClient);
                        } else if (page === 'service-record') {
                            await loadScript('service-record.js');
                            window.loadServiceRecordPage(content, supabaseClient);
                        } else if (page === 'inventory') {
                            await loadScript('inventory.js');
                            if (window.loadInventoryPage) {
                                window.loadInventoryPage(supabaseClient);
                            }
                        } else if (page === 'jordon' || page === 'lineage') {
                            await loadScript('warehouse.js');
                            await loadScript('public-warehouse.js');
                            if (page === 'jordon') {
                                window.loadJordonPage(supabaseClient);
                            } else {
                                window.loadLineagePage(supabaseClient);
                            }
                        } else if (page === 'sing-long') {
                            navigateTo('coming-soon');
                            return;
                        }
                    } catch (scriptError) {
                        console.error('Error running page script for', page, ':', scriptError);
                    }
                };

                await runPageScript();

            } else {
                content.innerHTML = '<p>Page not found.</p>';
            }
        } catch (error) {
            console.error('Error loading page:', page, error);
            content.innerHTML = '<p>Error loading page.</p>';
        }
    }
};

let isNavigating = false;

const navigateTo = (page) => {
    if (isNavigating) {
        return;
    }
    
    isNavigating = true;
    
    loadContent(page).finally(() => {
        isNavigating = false;
    });
    
    if ('#' + page !== window.location.hash) {
        window.location.hash = page;
    }
    
    updateNavigationState(page);
};

const updateNavigationState = (page) => {
    document.querySelectorAll('nav ul li').forEach(item => {
        item.classList.remove('active');
    });

    const selectedNavItem = document.querySelector(`[data-page="${page}"]`);
    if (selectedNavItem) {
        selectedNavItem.classList.add('active');
        
        if (selectedNavItem.classList.contains('warehouse-option')) {
            const publicWarehouse = document.querySelector('[data-page="public-warehouse"]');
            if (publicWarehouse) {
                publicWarehouse.classList.add('active');
                publicWarehouse.classList.add('open');
                document.querySelectorAll('.warehouse-option').forEach(option => {
                    option.style.display = 'flex';
                });
            }
        }
    }
};

const initializePage = () => {
    const page = window.location.hash.substring(1) || 'dashboard';
    navigateTo(page);
};

window.onhashchange = () => {
    const page = window.location.hash.substring(1) || 'dashboard';
    
    if (isNavigating) {
        return;
    }
    
    navigateTo(page);
};

const loginForm = document.getElementById('login-form');
if (loginForm) {
    eraseCookie('userName');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userId = document.getElementById('user-id').value;
        const password = document.getElementById('password').value;

        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('email, name')
            .eq('user_id', userId)
            .single();

        if (profileError || !profile) {
            handleAuthError({ message: 'User ID not found' });
            return;
        }

        const email = profile.email;
        const name = profile.name;

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            handleAuthError(error);
        } else {
            setCookie('userName', name, 1);
            window.location.href = 'app.html';
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    // DOMContentLoaded 事件处理已经在下面的代码中处理了
});

if (window.location.pathname.endsWith('app.html')) {
    const userName = getCookie('userName');
    if (userName) {
        const setUserInfo = () => {
            const userInfo = document.getElementById('user-info');
            if (userInfo) {
                userInfo.innerText = userName;
            }
        };

        const initializeApp = () => {
            setupEventListeners();

            const page = window.location.hash.substring(1) || 'dashboard';

            loadContent(page).then(() => {
                updateNavigationState(page);
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setUserInfo();
                initializeApp();
            });
        } else {
            setUserInfo();
            initializeApp();
        }
    } else {
        window.location.href = 'index.html';
    }
}

const logoutButton = document.getElementById('logout-button');
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            handleAuthError(error);
        } else {
            eraseCookie('userName');
            window.location.href = 'index.html';
        }
    });
}

const avatarTrigger = document.querySelector('.avatar-menu-trigger');
if (avatarTrigger) {
    const avatarDropdown = document.querySelector('.avatar-dropdown');

    avatarTrigger.addEventListener('click', () => {
        avatarDropdown.classList.toggle('show');
    });

    window.addEventListener('click', (event) => {
        if (!avatarTrigger.contains(event.target)) {
            avatarDropdown.classList.remove('show');
        }
    });
}

let eventListenersAttached = false;

function setupEventListeners() {
    if (eventListenersAttached) return;

    const navItems = document.querySelectorAll('nav ul li');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const page = item.getAttribute('data-page');
            if (page === 'public-warehouse') {
                e.preventDefault();
                const warehouseOptions = document.querySelectorAll('.warehouse-option');
                const publicWarehouseArrow = document.querySelector('[data-page="public-warehouse"]');
                publicWarehouseArrow.classList.toggle('open');
                warehouseOptions.forEach(option => {
                    option.style.display = option.style.display === 'none' ? 'flex' : 'none';
                });
            } else if (page) {
                navigateTo(page);
            }
        });
    });

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');

    const handleSidebar = () => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            sidebar.classList.remove('sidebar-collapsed');
        } else {
            sidebar.classList.remove('show');
        }
    };

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('show');
            } else {
                sidebar.classList.toggle('sidebar-collapsed');
            }
        });
    }

    window.addEventListener('resize', handleSidebar);
    handleSidebar(); // Initial check

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('show');
            }
        });
    });

    eventListenersAttached = true;
}

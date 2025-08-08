const supabaseUrl = "https://xnwjvhbkzrazluihnzhw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhud2p2aGJrenJhemx1aWhuemh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyODI2MDYsImV4cCI6MjA2Nzg1ODYwNn0.jGSW0pQgMzcYxuxNixh4XKgku5Oz-cYspHxxhjQ5tCg";

const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

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
// A mapping of page names to their corresponding script URLs and initialization functions.
// Note: The init functions will now receive the user object.
const pageScripts = {
    'product': {
        urls: ['product.js'],
        init: (content, supabaseClient, user) => window.loadProducts(content, supabaseClient, user)
    },
    'stock-take': {
        urls: ['stock-take.js'],
        init: (content, supabaseClient, user) => window.loadStockTakeData(content, supabaseClient, user)
    },
    'shipment': {
        urls: ['shipment.js'],
        init: (content, supabaseClient, user) => {
            window.loadShipmentPage(content, supabaseClient, user);
        }
    },
    'transactions': {
        urls: ['transaction.js'],
        styles: ['transaction.css'],
        init: (content, supabaseClient, user) => window.loadTransactions(content, supabaseClient, user)
    },
    'cr-temperature': {
        urls: ['cr-temperature.js'],
        init: (content, supabaseClient, user) => window.loadCrTemperaturePage(supabaseClient, user)
    },
    'dashboard': {
        urls: ['dashboard.js'],
        init: (content, supabaseClient, user) => window.loadDashboard(supabaseClient, user)
    },
    'schedule': {
        urls: ['js/schedule.js'],
        styles: ['css/schedule.css'],
        init: (content, supabaseClient, user) => {
            if (window.loadSchedulePage) {
                window.loadSchedulePage(content, supabaseClient, user);
            } else {
                console.error('loadSchedulePage function not found');
            }
        }
    },
    'service-record': {
        urls: ['service-record.js'],
        init: (content, supabaseClient, user) => window.loadServiceRecordPage(content, supabaseClient, user)
    },
    'inventory': {
        urls: ['inventory.js'],
        init: (content, supabaseClient, user) => window.loadInventoryPage(supabaseClient, user)
    },
    'jordon': {
        urls: ['warehouse.js', 'public-warehouse.js'],
        init: (content, supabaseClient, user) => window.loadJordonPage(content, supabaseClient, user)
    },
    'lineage': {
        urls: ['warehouse.js', 'public-warehouse.js'],
        init: (content, supabaseClient, user) => window.loadLineagePage(content, supabaseClient, user)
    },
    'sing-long': {
        urls: ['warehouse.js', 'singlong.js'],
        init: (content, supabaseClient, user) => window.loadSingLongPage(content, supabaseClient, user)
    },
    'transfer': {
        styles: ['css/transfer.css'],
        urls: ['js/transfer.js'],
        init: (content, supabaseClient, user) => window.loadTransferPage(supabaseClient, user)
    },
    'surimi': {
        styles: ['surimi.css'],
        urls: ['surimi.js'],
        init: (content, supabaseClient, user) => window.loadSurimiPage(supabaseClient, user)
    },
    'packaging-material': {
        urls: ['packaging-material.js'],
        init: (content, supabaseClient, user) => window.loadPackagingMaterialPage(supabaseClient, user)
    }
};

const loadedStyles = new Set();
let currentUser = null;

const loadStyle = (url) => {
    return new Promise((resolve, reject) => {
        if (loadedStyles.has(url)) {
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = () => {
            loadedStyles.add(url);
            resolve();
        };
        link.onerror = (error) => {
            console.error(`Failed to load style: ${url}`, error);
            reject(new Error(`Failed to load style: ${url}`));
        };
        document.head.appendChild(link);
    });
};

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
            console.error(`Failed to load script: ${url}`, error);
            reject(new Error(`Failed to load script: ${url}`));
        };
        document.head.appendChild(script);
    });
};

const loadContent = async (page, user) => {
    const content = document.getElementById('content');
    if (!content) return;

    try {
        const response = await fetch(`templates/${page}.html`);
        if (!response.ok) {
            content.innerHTML = '<p>Page not found.</p>';
            return;
        }
        content.innerHTML = await response.text();

        const pageScript = pageScripts[page];
        if (pageScript) {
            if (pageScript.styles) {
                await Promise.all(pageScript.styles.map(url => loadStyle(url)));
            }
            if (pageScript.urls) {
                await Promise.all(pageScript.urls.map(url => loadScript(url)));
            }
            if (pageScript.init) {
                pageScript.init(content, supabaseClient, user);
            }
        }
    } catch (error) {
        console.error('Error loading page:', page, error);
        content.innerHTML = '<p>Error loading page.</p>';
    }
};

let isNavigating = false;

const navigateTo = (page, user) => {
    if (isNavigating) return;
    isNavigating = true;

    const pageScript = pageScripts[page];
    if (pageScript && pageScript.redirect) {
        navigateTo(pageScript.redirect, user);
        return;
    }

    loadContent(page, user).finally(() => {
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

const initializePage = (user) => {
    const page = window.location.hash.substring(1) || 'dashboard';
    navigateTo(page, user);
};

window.onhashchange = () => {
    const page = window.location.hash.substring(1) || 'dashboard';
    if (isNavigating || !currentUser) return;
    navigateTo(page, currentUser);
};

// Logic for the login page (index.html)
const loginForm = document.getElementById('login-form');
if (loginForm) {
    supabaseClient.auth.signOut();

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
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            handleAuthError(error);
        } else {
            window.location.href = 'app.html';
        }
    });
}

// Logic for the main application page (app.html)
if (window.location.pathname.endsWith('app.html')) {
    const handleSession = async () => {
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error || !session) {
            window.location.href = 'index.html';
            return;
        }

        currentUser = session.user;

        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('name')
            .eq('id', currentUser.id)
            .single();

        const userName = (profile && profile.name) ? profile.name : currentUser.email;

        const setUserInfo = () => {
            const userInfo = document.getElementById('user-info');
            if (userInfo) {
                userInfo.innerText = userName;
            }
        };

        const initializeApp = () => {
            setupEventListeners(currentUser);
            initializePage(currentUser);

            const sidebar = document.querySelector('.sidebar');
            const sidebarToggle = document.getElementById('sidebar-toggle');
            if (sidebar && sidebarToggle && window.innerWidth > 768) {
                const icon = sidebarToggle.querySelector('i');
                if (!sidebar.classList.contains('sidebar-collapsed')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-arrow-left');
                }
            }
        };

        setUserInfo();
        initializeApp();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleSession);
    } else {
        handleSession();
    }
}

// Event Listeners that should be available on all pages
document.addEventListener('DOMContentLoaded', () => {
    const languageSwitcher = document.getElementById('language-switcher');
    if (languageSwitcher) {
        const currentLanguage = getLanguage();
        languageSwitcher.value = currentLanguage;
        languageSwitcher.addEventListener('change', (event) => {
            setLanguage(event.target.value);
        });
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                handleAuthError(error);
            } else {
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
});

window.addEventListener('resize', () => {
    if (typeof updateText === 'function') {
        updateText();
    }
});

function handleSidebarToggle(sidebarToggle) {
    const sidebar = document.querySelector('.sidebar');
    const appContainer = document.querySelector('.app-container');
    const icon = sidebarToggle.querySelector('i');
    if (!sidebar || !appContainer) return;
    appContainer.classList.toggle('sidebar-show');
    if (getComputedStyle(sidebar).position !== 'fixed') {
        const isCollapsed = appContainer.classList.contains('sidebar-show');
        sidebarToggle.setAttribute('aria-expanded', !isCollapsed);
        if (isCollapsed) {
            icon.classList.remove('fa-arrow-left');
            icon.classList.add('fa-bars');
        } else {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-arrow-left');
        }
    } else {
        sidebarToggle.setAttribute('aria-expanded', appContainer.classList.contains('sidebar-show'));
    }
}

function setupEventListeners(user) {
    document.body.addEventListener('click', (e) => {
        const navItem = e.target.closest('nav ul li');
        if (navItem) {
            const page = navItem.getAttribute('data-page');
            if (page === 'public-warehouse') {
                e.preventDefault();
                const warehouseOptions = document.querySelectorAll('.warehouse-option');
                const publicWarehouseArrow = document.querySelector('[data-page="public-warehouse"]');
                publicWarehouseArrow.classList.toggle('open');
                warehouseOptions.forEach(option => {
                    option.style.display = option.style.display === 'none' ? 'flex' : 'none';
                });
            } else if (page) {
                navigateTo(page, user);
            }
        }

        const sidebarToggle = e.target.closest('#sidebar-toggle');
        if (sidebarToggle) {
            handleSidebarToggle(sidebarToggle);
        }

        const overlay = e.target.closest('#overlay');
        if (overlay) {
            const appContainer = document.querySelector('.app-container');
            if (appContainer.classList.contains('sidebar-show')) {
                appContainer.classList.remove('sidebar-show');
            }
        }

        if (navItem && getComputedStyle(document.querySelector('.sidebar')).position === 'fixed') {
            const page = navItem.getAttribute('data-page');
            if (page !== 'public-warehouse') {
                const appContainer = document.querySelector('.app-container');
                if (appContainer.classList.contains('sidebar-show')) {
                    appContainer.classList.remove('sidebar-show');
                }
            }
        }
    });
}

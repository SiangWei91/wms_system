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
// A mapping of page names to their corresponding script URLs and initialization functions.
const pageScripts = {
    'product': {
        urls: ['product.js'],
        init: (content) => window.loadProducts(content, supabaseClient)
    },
    'stock-take': {
        urls: ['stock-take.js'],
        init: (content) => window.loadStockTakeData(content, supabaseClient)
    },
    'shipment': {
        urls: ['shipment.js'],
        init: (content) => {
            window.loadShipmentPage(content, supabaseClient);
        }
    },
    'transactions': {
        urls: ['transaction.js'],
        init: (content) => window.loadTransactions(content, supabaseClient)
    },
    'cr-temperature': {
        urls: ['cr-temperature.js'],
        init: () => window.loadCrTemperaturePage(supabaseClient)
    },
    'dashboard': {
        urls: ['dashboard.js'],
        init: () => window.loadDashboard(supabaseClient)
    },
    'service-record': {
        urls: ['service-record.js'],
        init: (content) => window.loadServiceRecordPage(content, supabaseClient)
    },
    'inventory': {
        urls: ['inventory.js'],
        init: () => window.loadInventoryPage(supabaseClient)
    },
    'jordon': {
        urls: ['warehouse.js', 'public-warehouse.js'],
        init: () => window.loadJordonPage(supabaseClient)
    },
    'lineage': {
        urls: ['warehouse.js', 'public-warehouse.js'],
        init: () => window.loadLineagePage(supabaseClient)
    },
    'sing-long': {
        urls: ['warehouse.js', 'singlong.js'],
        init: () => window.loadSingLongPage(supabaseClient)
    },
    'transfer': {
        redirect: 'coming-soon'
    },
    'surimi': {
        styles: ['surimi.css'],
        urls: ['surimi.js'],
        init: () => window.loadSurimiPage(supabaseClient)
    },
    'packaging-material': {
        urls: ['packaging-material.js'],
        init: () => window.loadPackagingMaterialPage(supabaseClient)
    }
};

const loadedStyles = new Set();

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
            reject(new Error(`Failed to load script: ${url}`));
        };
        document.head.appendChild(script);
    });
};

const loadContent = async (page) => {
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
            try {
                if (pageScript.styles) {
                    for (const url of pageScript.styles) {
                        await loadStyle(url);
                    }
                }
                if (pageScript.urls) {
                    for (const url of pageScript.urls) {
                        await loadScript(url);
                    }
                }
                if (pageScript.init) {
                    pageScript.init(content);
                }
            } catch (scriptError) {
                console.error('Error running page script for', page, ':', scriptError);
            }
        }
    } catch (error) {
        console.error('Error loading page:', page, error);
        content.innerHTML = '<p>Error loading page.</p>';
    }
};

let isNavigating = false;

const navigateTo = (page) => {
    if (isNavigating) {
        return;
    }

    const pageScript = pageScripts[page];
    if (pageScript && pageScript.redirect) {
        navigateTo(pageScript.redirect);
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

// Language switcher logic
document.addEventListener('DOMContentLoaded', () => {
    const languageSwitcher = document.getElementById('language-switcher');
    if (languageSwitcher) {
        // Set the initial value of the dropdown from localStorage
        const currentLanguage = getLanguage();
        languageSwitcher.value = currentLanguage;

        languageSwitcher.addEventListener('change', (event) => {
            setLanguage(event.target.value);
        });
    }
});

window.addEventListener('DOMContentLoaded', () => {
    // DOMContentLoaded 事件处理已经在下面的代码中处理了
});

window.addEventListener('resize', () => {
    updateText();
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

function handleSidebarToggle(sidebarToggle) {
    const sidebar = document.querySelector('.sidebar');
    const appContainer = document.querySelector('.app-container');
    const icon = sidebarToggle.querySelector('i');

    if (!sidebar || !appContainer) return;

    appContainer.classList.toggle('sidebar-show');

    // Handle desktop icon toggle
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
        // Handle mobile ARIA attribute
        sidebarToggle.setAttribute('aria-expanded', appContainer.classList.contains('sidebar-show'));
    }
}

function setupEventListeners() {
    const content = document.getElementById('content');
    if (content) {
        content.addEventListener('click', (e) => {
            // Handle delegated events here
        });
    }
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
                navigateTo(page);
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

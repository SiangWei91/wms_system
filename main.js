const supabaseUrl = "https://xnwjvhbkzrazluihnzhw.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhud2p2aGJrenJhemx1aWhuemh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyODI2MDYsImV4cCI6MjA2Nzg1ODYwNn0.jGSW0pQgMzcYxuxNixh4XKgku5Oz-cYspHxxhjQ5tCg"

const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey)

const setCookie = (name, value, days) => {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Strict; Secure";
}

const getCookie = (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0;i < ca.length;i++) {
        let c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

const eraseCookie = (name) => {
    document.cookie = name + '=; Max-Age=-99999999; path=/; domain=' + window.location.hostname;
}

const handleAuthError = (error) => {
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) {
    errorMessage.innerText = error.message;
    errorMessage.style.display = 'block';
  } else {
    alert(error.message);
  }
};


const loadScript = (url) => {
    return new Promise((resolve, reject) => {
        // 检查脚本是否已经加载
        const existingScript = document.querySelector(`script[src="${url}"]`);
        if (existingScript) {
            console.log(`Script already loaded: ${url}`);
            resolve();
            return;
        }
        
        console.log(`Loading script: ${url}`);
        const script = document.createElement('script');
        script.src = url;
        
        script.onload = () => {
            console.log(`✅ Script loaded successfully: ${url}`);
            // 给脚本一点时间来执行和定义函数
            setTimeout(resolve, 50);
        };
        
        script.onerror = (error) => {
            console.error(`❌ Script failed to load: ${url}`, error);
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
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runPageScript);
        } else {
            runPageScript();
        }

      } else {
        content.innerHTML = '<p>Page not found.</p>';
      }
    } catch (error) {
      console.error('Error loading page:', error);
      content.innerHTML = '<p>Error loading page.</p>';
    }
  }
};

const navigateTo = (page) => {
  loadContent(page);
  window.location.hash = page;
  document.querySelectorAll('nav ul li').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-page') === page) {
      item.classList.add('active');
    }
  });
};

window.onhashchange = () => {
  const page = window.location.hash.substring(1) || 'dashboard';
  navigateTo(page);
};

// Login functionality
const loginForm = document.getElementById('login-form');
if (loginForm) {
    // Clear any existing user session data on page load
    eraseCookie('userName');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userId = document.getElementById('user-id').value;
        const password = document.getElementById('password').value;

        // Get email from profiles table
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

// Check user session on all pages except login
if (window.location.pathname.endsWith('app.html')) {
    const userName = getCookie('userName');
    if (userName) {
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.innerText = userName;
        }
        const page = window.location.hash.substring(1) || 'dashboard';
        loadContent(page);
        if (!window.location.hash) {
            window.location.hash = 'dashboard';
        }
    } else {
        window.location.href = 'index.html';
    }
}


// Logout functionality
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

// Avatar dropdown functionality
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

// Navigation functionality
const navItems = document.querySelectorAll('nav ul li');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const page = item.getAttribute('data-page');
        if (page) {
            navigateTo(page);
        }
    });
});

// Sidebar toggle functionality
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.querySelector('.sidebar');
if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-collapsed');
    });
}

import { supabase } from './supabase-client.js'

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

const loadContent = async (page) => {
  const content = document.getElementById('content');
  if (content) {
    try {
      const response = await fetch(`/templates/${page}.html`);
      if (response.ok) {
        content.innerHTML = await response.text();
        if (page === 'product') {
          const module = await import('/product.js');
          module.loadProducts(content, supabase);
        } else if (page === 'stock-take') {
          const module = await import('/stock-take.js');
          module.loadStockTakeData(content);
        } else if (page === 'shipment') {
          const module = await import('/shipment.js');
          module.loadShipmentPage(content);
          const allocationModule = await import('/shipment-allocation.js');
          allocationModule.loadShipmentAllocationPage();
        } else if (page === 'transactions') {
            const module = await import('/transaction.js');
            module.loadTransactions(content, supabase);
        } else if (page === 'cr-temperature') {
          const module = await import('/cr-temperature.js');
          module.loadCrTemperaturePage();
        } else if (page === 'dashboard') {
          const module = await import('/dashboard.js');
          module.loadDashboard();
        } else if (page === 'service-record') {
          const module = await import('/service-record.js');
          module.loadServiceRecordPage(content);
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
  history.pushState({ page }, '', `/app.html/${page}`);
  document.querySelectorAll('nav ul li').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-page') === page) {
      item.classList.add('active');
    }
  });
};

window.onpopstate = (event) => {
  if (event.state && event.state.page) {
    loadContent(event.state.page);
  }
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
        const { data: profile, error: profileError } = await supabase
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

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            handleAuthError(error);
        } else {
            setCookie('userName', name, 1);
            window.location.href = '/app.html';
        }
    });
}

// Check user session on all pages except login
if (window.location.pathname.startsWith('/app')) {
    const userName = getCookie('userName');
    if (userName) {
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.innerText = userName;
        }
        const page = window.location.pathname.split('/')[2] || 'dashboard';
        loadContent(page);
    } else {
        window.location.href = '/index.html';
    }
}


// Logout functionality
const logoutButton = document.getElementById('logout-button');
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        const { error } = await supabase.auth. signOut();
        if (error) {
            handleAuthError(error);
        } else {
            eraseCookie('userName');
            window.location.href = '/index.html';
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

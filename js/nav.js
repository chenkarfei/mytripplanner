(function () {
  // ── Theme ──────────────────────────────────────────────────────────
  const saved = localStorage.getItem('theme');
  const theme = saved === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);

  document.addEventListener('DOMContentLoaded', function () {
    const themeBtn = document.getElementById('theme-toggle');
    const sunIcon  = document.getElementById('icon-sun');
    const moonIcon = document.getElementById('icon-moon');

    function applyTheme(t) {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('theme', t);
      if (sunIcon && moonIcon) {
        sunIcon.style.display  = t === 'dark' ? 'block' : 'none';
        moonIcon.style.display = t === 'dark' ? 'none'  : 'block';
      }
    }

    applyTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');

    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }

    // ── Mobile menu ────────────────────────────────────────────────
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileMenu   = document.getElementById('mobile-menu');
    const iconOpen     = document.getElementById('icon-menu-open');
    const iconClose    = document.getElementById('icon-menu-close');

    if (hamburgerBtn && mobileMenu) {
      hamburgerBtn.addEventListener('click', function () {
        const isOpen = mobileMenu.classList.toggle('open');
        mobileMenu.classList.toggle('mobile-menu-open', isOpen);
        if (iconOpen)  iconOpen.style.display  = isOpen ? 'none'  : 'block';
        if (iconClose) iconClose.style.display = isOpen ? 'block' : 'none';
      });

      // Close menu when a link is clicked
      mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          mobileMenu.classList.remove('open');
          if (iconOpen)  iconOpen.style.display  = 'block';
          if (iconClose) iconClose.style.display = 'none';
        });
      });
    }

    // ── Active link ────────────────────────────────────────────────
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    const filename = path.split('/').pop() || 'index.html';

    document.querySelectorAll('.nav-link').forEach(function (link) {
      const href = link.getAttribute('href') || '';
      const linkFile = href.split('/').pop() || 'index.html';
      if (linkFile === filename || (filename === '' && linkFile === 'index.html')) {
        link.classList.add('active');
      }
    });
  });
})();

const initTabs = () => {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const tab = link.dataset.tab;

      tabLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      tabPanes.forEach(pane => {
        if (pane.id === tab) {
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
    });
  });
};

initTabs();

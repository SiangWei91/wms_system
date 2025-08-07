window.loadTransferPage = (supabaseClient) => {
    const tabButtons = document.querySelectorAll('.transfer-tab-button');
    const tabPanes = document.querySelectorAll('.transfer-tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const tab = button.getAttribute('data-tab');
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

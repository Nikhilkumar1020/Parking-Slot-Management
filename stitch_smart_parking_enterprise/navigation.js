document.addEventListener('DOMContentLoaded', () => {
    // Mapping of sidebar text to HTML files
    const routeMap = {
        'Dashboard': '../admin_dashboard/code.html',
        'Slot Management': '../slot_management/code.html',
        'Vehicle Registry': '../vehicle_management/code.html',
        'Visitor Access': '../visitor_management/code.html',
        'Reservations': '../reservation_module/code.html',
        'Live Map': '../live_parking_map/code.html',
        'Analytics': '../reports_analytics/code.html',
        'Settings': '../user_profile/code.html'
    };

    // Handle Sidebar Items
    const sidebarItems = document.querySelectorAll('aside nav div');
    sidebarItems.forEach(item => {
        const textSpan = item.querySelector('span:nth-child(2)');
        if (textSpan) {
            const text = textSpan.textContent.trim();
            if (routeMap[text]) {
                item.addEventListener('click', () => {
                    window.location.href = routeMap[text];
                });
                item.style.cursor = 'pointer';
            }
        }
    });

    // Handle Header Notifications Bell
    const notifBtn = document.querySelector('header button.material-symbols-outlined');
    if (notifBtn && notifBtn.textContent.includes('notifications')) {
        notifBtn.addEventListener('click', () => {
            window.location.href = '../notifications_center/code.html';
        });
        notifBtn.style.cursor = 'pointer';
    }

    // Handle Profile Picture Click
    const profileImg = document.querySelector('header img');
    if (profileImg) {
        const container = profileImg.closest('div');
        container.addEventListener('click', () => {
            window.location.href = '../user_profile/code.html';
        });
        container.style.cursor = 'pointer';
    }

    // Handle Logo/Title Click
    const logo = document.querySelector('header h1');
    if (logo) {
        logo.addEventListener('click', () => {
            window.location.href = '../landing_dashboard/code.html';
        });
        logo.style.cursor = 'pointer';
    }
});

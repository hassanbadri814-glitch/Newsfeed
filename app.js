// app.js - Hoofdlogica voor de MSF Commander app

// Wacht tot de DOM geladen is
document.addEventListener('DOMContentLoaded', () => {
    // Schermen
    const disclaimerScreen = document.getElementById('disclaimer-screen');
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');

    // Knoppen
    const btnAccept = document.getElementById('btn-accept');
    const btnConnect = document.getElementById('btn-connect');
    const btnLogout = document.getElementById('btn-logout');

    // Check of de gebruiker de disclaimer al heeft geaccepteerd
    const hasAccepted = localStorage.getItem('msf_disclaimer_accepted');
    if (hasAccepted === 'true') {
        // Sla disclaimer over, ga direct naar login of dashboard
        if (localStorage.getItem('msf_server_ip')) {
            showDashboard();
        } else {
            showLogin();
        }
    } else {
        showDisclaimer();
    }

    // --- Disclaimer ---
    btnAccept.addEventListener('click', () => {
        localStorage.setItem('msf_disclaimer_accepted', 'true');
        showLogin();
    });

    // --- Login ---
    btnConnect.addEventListener('click', async () => {
        const ip = document.getElementById('server-ip').value.trim();
        const pass = document.getElementById('server-pass').value.trim();
        const errorEl = document.getElementById('login-error');

        if (!ip || !pass) {
            errorEl.textContent = 'Vul alle velden in.';
            return;
        }

        // Test de verbinding met de backend (via msf-api.js)
        try {
            errorEl.textContent = 'Verbinden...';
            const success = await MSFApi.testConnection(ip, pass);
            if (success) {
                localStorage.setItem('msf_server_ip', ip);
                localStorage.setItem('msf_server_pass', pass); // Let op: in productie beter niet plaintext opslaan
                showDashboard();
            } else {
                errorEl.textContent = 'Verbinding mislukt. Controleer IP en wachtwoord.';
            }
        } catch (e) {
            errorEl.textContent = 'Fout: ' + e.message;
        }
    });

    // --- Dashboard ---
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('msf_server_ip');
        localStorage.removeItem('msf_server_pass');
        showLogin();
    });

    // --- Scherm wissel functies ---
    function showDisclaimer() {
        disclaimerScreen.classList.add('active');
        loginScreen.classList.remove('active');
        dashboardScreen.classList.remove('active');
    }

    function showLogin() {
        disclaimerScreen.classList.remove('active');
        loginScreen.classList.add('active');
        dashboardScreen.classList.remove('active');
    }

    function showDashboard() {
        disclaimerScreen.classList.remove('active');
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        // Hier kun je later data laden voor het dashboard
    }
});
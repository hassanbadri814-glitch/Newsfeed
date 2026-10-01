// msf-api.js - API laag voor de Metasploit RPC verbinding

const MSFApi = {
    // Jouw specifieke Replit URL
    BASE_URL: 'https://8129f60e-ad46-4e16-b163-72caab78ee20-00-11jpk23wccygv.reed.replit.dev',

    async testConnection(ip, pass) {
        try {
            console.log('Verstuur naar:', `${this.BASE_URL}/connect`);
            const response = await fetch(`${this.BASE_URL}/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: ip, password: pass })
            });
            console.log('HTTP status:', response.status);
            const rawText = await response.text();
            console.log('Ruwe response:', rawText);
            
            // Elke 200-299 status is goed
            return response.ok;
        } catch (error) {
            console.error('Verbindingsfout:', error);
            alert('Fout: ' + error.message); // Dit toont de fout op je scherm
            return false;
        }
    },

    async getSessions() {
        return [];
    },

    async executeCommand(sessionId, command) {
        return 'Commando output komt hier';
    }
};
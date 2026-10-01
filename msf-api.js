// msf-api.js - API laag voor de Metasploit RPC verbinding

const MSFApi = {
    // De URL van je Replit backend
    BASE_URL: 'https://8129f60e-ad46-4e16-b163-72caab78ee20-00-11jpk23wccygv.reed.replit.dev',

    // Test of de backend bereikbaar is en of de inloggegevens kloppen
    async testConnection(ip, pass) {
        try {
            const response = await fetch(`${this.BASE_URL}/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: ip, password: pass })
            });
            const data = await response.json();
            // Let op: de Replit AI stuurt { "status": "connected" } terug
            return data.status === 'connected';
        } catch (error) {
            console.error('Verbindingsfout:', error);
            return false;
        }
    },

    // Haal sessies op van de backend
    async getSessions() {
        return [];
    },

    // Stuur een commando naar een sessie
    async executeCommand(sessionId, command) {
        return 'Commando output komt hier';
    }
};
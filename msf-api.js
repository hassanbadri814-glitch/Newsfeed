// msf-api.js - API laag voor de Metasploit RPC verbinding

const MSFApi = {
    BASE_URL: 'https://8129f60e-ad46-4e16-b163-72caab78ee20-00-11jpk23wccygv.reed.replit.dev',

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    async testConnection(ip, pass) {
        const maxPogingen = 3;
        
        for (let poging = 1; poging <= maxPogingen; poging++) {
            try {
                console.log(`Poging ${poging}...`);
                
                // Server wakker maken
                const wakeUp = await fetch(`${this.BASE_URL}/?t=${Date.now()}`);
                if (!wakeUp.ok) throw new Error('Server reageerde niet');
                
                // Inloggegevens versturen
                const response = await fetch(`${this.BASE_URL}/connect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip: ip, password: pass })
                });
                
                if (!response.ok) throw new Error(`Status ${response.status}`);
                
                const data = await response.json();
                console.log('Server antwoord:', data);
                return true;
                
            } catch (error) {
                console.error(`Poging ${poging} mislukt:`, error.message);
                
                if (poging < maxPogingen) {
                    await this.sleep(2000);
                } else {
                    alert('VERBINDINGSFOUT:\n\n' + error.message + 
                          '\n\nMogelijke oplossingen:\n' +
                          '1. Open Replit en klik op "Run"\n' +
                          '2. Wacht 10 seconden en probeer opnieuw\n' +
                          '3. Controleer je internetverbinding');
                    return false;
                }
            }
        }
    },

    async getSessions() { return []; },
    async executeCommand(sessionId, command) { return 'Commando output komt hier'; }
};
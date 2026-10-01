// msf-api.js - API laag voor de Metasploit RPC verbinding

const MSFApi = {
    // De exacte URL van je Replit backend
    BASE_URL: 'https://8129f60e-ad46-4e16-b163-72caab78ee20-00-11jpk23wccygv.reed.replit.dev',

    // Test of de backend bereikbaar is en of de inloggegevens kloppen
    async testConnection(ip, pass) {
        try {
            // --- STAP A: Server wakker maken en basisverbinding testen ---
            console.log('Stap A: Server wakker maken...');
            // We voegen een timestamp toe om caching door de browser te voorkomen
            const wakeUpResponse = await fetch(`${this.BASE_URL}/?t=${Date.now()}`);
            
            if (!wakeUpResponse.ok) {
                throw new Error(`Server reageerde niet goed. Status: ${wakeUpResponse.status}`);
            }
            
            const wakeUpData = await wakeUpResponse.text();
            console.log('Server is wakker. Antwoord:', wakeUpData);

            // --- STAP B: Inloggegevens versturen ---
            console.log('Stap B: Inloggegevens versturen...');
            const response = await fetch(`${this.BASE_URL}/connect`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ ip: ip, password: pass })
            });

            console.log('HTTP status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Server gaf foutcode ${response.status} terug.`);
            }

            const data = await response.json();
            console.log('Succes! Server antwoord:', data);

            // We accepteren een succesvolle response
            return true;

        } catch (error) {
            // Toon de exacte fout op het scherm van je telefoon
            console.error('Verbindingsfout:', error);
            alert('VERBINDINGSFOUT:\n\n' + error.message + '\n\nMogelijke oorzaken:\n1. Replit server is in slaapstand (klik op Run in Replit)\n2. Verkeerde URL in msf-api.js\n3. Geen internetverbinding');
            return false;
        }
    },

    // Haal sessies op van de backend (placeholder voor nu)
    async getSessions() {
        return [];
    },

    // Stuur een commando naar een sessie (placeholder voor nu)
    async executeCommand(sessionId, command) {
        return 'Commando output komt hier';
    }
};
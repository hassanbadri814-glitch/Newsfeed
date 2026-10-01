// msf-api.js - TIJDELIJKE TESTVERSIE

const MSFApi = {
    BASE_URL: 'https://8129f60e-ad46-4e16-b163-72caab78ee20-00-11jpk23wccygv.reed.replit.dev',

    async testConnection(ip, pass) {
        // We doen alsof het 1 seconde duurt en geven dan succes terug
        console.log('Test verbinding met:', ip);
        return new Promise((resolve) => {
            setTimeout(() => resolve(true), 1000);
        });
    },

    async getSessions() {
        return [];
    },

    async executeCommand(sessionId, command) {
        return 'Commando output komt hier';
    }
};
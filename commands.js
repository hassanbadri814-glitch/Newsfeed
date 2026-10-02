cat > ~/msf-app/commands.js << 'EOF'
// Commando Bibliotheek voor MSF Commander
const CommandLibrary = {
    categories: [
        {
            id: "linux",
            name: "Linux Shell",
            icon: "",
            commands: [
                { cmd: "whoami", desc: "Huidige gebruiker" },
                { cmd: "id", desc: "User + groups" },
                { cmd: "uname -a", desc: "Kernel info" },
                { cmd: "hostname", desc: "Systeemnaam" },
                { cmd: "cat /etc/os-release", desc: "OS versie" },
                { cmd: "uptime", desc: "Systeem uptime" },
                { cmd: "date", desc: "Huidige tijd" },
                { cmd: "env", desc: "Environment vars" },
                { cmd: "history", desc: "Commando historie" }
            ]
        },
        {
            id: "files",
            name: "Bestanden",
            icon: "",
            commands: [
                { cmd: "pwd", desc: "Huidige map" },
                { cmd: "ls -la", desc: "Alle bestanden" },
                { cmd: "ls -lah /", desc: "Root met grote" },
                { cmd: "cat /etc/passwd", desc: "User lijst" },
                { cmd: "cat /etc/shadow", desc: "Wachtwoord hashes" },
                { cmd: "find / -name '*.conf' 2>/dev/null", desc: "Config files" },
                { cmd: "find / -perm -4000 -type f 2>/dev/null", desc: "SUID binaries" },
                { cmd: "find / -writable -type d 2>/dev/null", desc: "Schrijfbare mappen" },
                { cmd: "df -h", desc: "Schijfgebruik" },
                { cmd: "du -sh /home/*", desc: "Home groottes" }
            ]
        },
        {
            id: "network",
            name: "Netwerk",
            icon: "",
            commands: [
                { cmd: "ifconfig", desc: "Netwerk interfaces" },
                { cmd: "ip addr show", desc: "IP adressen" },
                { cmd: "ip route", desc: "Routing tabel" },
                { cmd: "netstat -an", desc: "Actieve connecties" },
                { cmd: "ss -tuln", desc: "Luisterende poorten" },
                { cmd: "arp -a", desc: "ARP cache" },
                { cmd: "cat /etc/resolv.conf", desc: "DNS servers" },
                { cmd: "cat /etc/hosts", desc: "Hosts file" },
                { cmd: "ping -c 3 8.8.8.8", desc: "Internet test" },
                { cmd: "traceroute 8.8.8.8", desc: "Route naar internet" }
            ]
        },
        {
            id: "process",
            name: "Processen",
            icon: "",
            commands: [
                { cmd: "ps aux", desc: "Alle processen" },
                { cmd: "ps aux | grep root", desc: "Root processen" },
                { cmd: "top -b -n 1", desc: "Top processen" },
                { cmd: "cat /proc/cpuinfo", desc: "CPU info" },
                { cmd: "cat /proc/meminfo", desc: "Geheugen info" },
                { cmd: "lsof -i", desc: "Open netwerk files" },
                { cmd: "crontab -l", desc: "Cron jobs" },
                { cmd: "cat /etc/crontab", desc: "System cron" }
            ]
        },
        {
            id: "priv",
            name: "Privilege Escalation",
            icon: "",
            commands: [
                { cmd: "sudo -l", desc: "Sudo rechten" },
                { cmd: "id", desc: "Huidige rechten" },
                { cmd: "groups", desc: "Groep lidmaatschap" },
                { cmd: "cat /etc/sudoers", desc: "Sudo config" },
                { cmd: "ls -la /root", desc: "Root home" },
                { cmd: "find / -perm -u=s -type f 2>/dev/null", desc: "SUID zoeken" },
                { cmd: "getcap -r / 2>/dev/null", desc: "Capabilities" },
                { cmd: "uname -r", desc: "Kernel versie (voor exploits)" }
            ]
        },
        {
            id: "android",
            name: "Android / Termux",
            icon: "",
            commands: [
                { cmd: "whoami", desc: "Termux user" },
                { cmd: "getprop ro.build.version.release", desc: "Android versie" },
                { cmd: "getprop ro.product.model", desc: "Telefoon model" },
                { cmd: "ip addr show wlan0", desc: "WiFi IP" },
                { cmd: "termux-info", desc: "Termux info" },
                { cmd: "pm list packages | head -20", desc: "Geïnstalleerde apps" },
                { cmd: "ls /sdcard/", desc: "SD kaart inhoud" },
                { cmd: "df -h", desc: "Opslag" }
            ]
        },
        {
            id: "meterpreter",
            name: "Meterpreter",
            icon: "",
            commands: [
                { cmd: "sysinfo", desc: "Systeem info" },
                { cmd: "getuid", desc: "Huidige user" },
                { cmd: "getsystem", desc: "Privilege escalation" },
                { cmd: "ps", desc: "Processen" },
                { cmd: "migrate <PID>", desc: "Naar ander process" },
                { cmd: "hashdump", desc: "Wachtwoord hashes" },
                { cmd: "screenshot", desc: "Schermafbeelding" },
                { cmd: "shell", desc: "System shell" },
                { cmd: "background", desc: "Naar achtergrond" },
                { cmd: "keyscan_start", desc: "Keylogger starten" }
            ]
        },
        {
            id: "windows",
            name: "Windows Shell",
            icon: "",
            commands: [
                { cmd: "systeminfo", desc: "Systeem info" },
                { cmd: "whoami /all", desc: "User + privileges" },
                { cmd: "ipconfig /all", desc: "Netwerk" },
                { cmd: "netstat -an", desc: "Connecties" },
                { cmd: "net user", desc: "Gebruikers" },
                { cmd: "net localgroup administrators", desc: "Admins" },
                { cmd: "tasklist", desc: "Processen" },
                { cmd: "dir C:\\Users", desc: "Gebruikersmappen" }
            ]
        }
    ]
};
EOF
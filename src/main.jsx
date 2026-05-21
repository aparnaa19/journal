import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const skills = [
  "SIEM & Detection",
  "Incident Response",
  "Threat Hunting",
  "AI Security",
  "Forensics",
  "Email Security",
  "Payload Development",
  "Malware Analysis",
];

const entries = [
  {
    title: "Phishing Simulation, Detection & Incident Response - Full Kill Chain Lab",
    projectTitle: "Phishing Simulation, Detection & Incident Response",
    type: "LAB",
    summary:
      "Built and investigated a controlled phishing kill chain from delivery through payload execution, persistence, C2 callback, Splunk detection, and SOC-style reporting.",
    goal:
      "Simulate a realistic phishing attack in a controlled home lab and detect it the way a SOC analyst would - using behavioral log analysis in Splunk, without prior knowledge of the payload.",
    environment: "Attacker: Ubuntu VM - Victim: Windows 11 - SIEM: Splunk Enterprise",
    phases: ["Delivery", "Execution", "Reconnaissance", "Persistence", "C2", "Exfiltration"],
    keyFindings: [
      "Phishing email bypassed Outlook filters using a password-protected zip",
      "Custom payload had zero antivirus detections on VirusTotal",
      "Full kill chain detected using a single Splunk behavioral query on Event ID 4688",
      "Registry persistence disguised as WindowsUpdater among legitimate startup entries",
      "Entire kill chain completed in under 5 seconds from execution to exfiltration",
    ],
    outcome:
      "Attack fully detected, contained, and documented as a SOC-style incident report with timeline, IOCs, and remediation recommendations",
    details: {
      objective:
        "Design and execute a controlled phishing attack simulation covering all six phases of the Cyber Kill Chain, then detect and investigate the attack using industry-standard SOC tools and workflows - Splunk SIEM, Windows Event Logs, MXToolbox, and VirusTotal - and document findings in a formal incident report.",
      labEnvironment: [
        ["Attacker Machine", "Ubuntu 24 (VirtualBox - Bridged Network)"],
        ["Victim Machine", "Windows 11 Home - Lenovo - Build 26200"],
        ["SIEM", "Splunk Enterprise"],
        ["Network", "Both machines on same LAN via bridged adapter"],
        ["Attacker IP", "192.168.0.24"],
        ["Victim IP", "192.168.0.14"],
      ],
      delivery: [
        'A phishing email was crafted impersonating an IT security notice with the subject "April invoice report." The payload was a Windows batch script renamed to .txt and compressed into a password-protected zip archive. The password was included in the email body - simulating a real attacker technique used to bypass email content scanners that cannot inspect encrypted archives.',
        "The email was sent from a university Outlook account to another university Outlook account on the same tenant. Despite DKIM, DMARC, and SPF all failing authentication, the email was delivered successfully with a low spam confidence score (SCL: 1). The originating server was flagged as blacklisted on MXToolbox.",
      ],
      emailAuth: [
        ["DKIM", "Failed - not signed"],
        ["DMARC", "Failed - no policy on subdomain"],
        ["SPF", "Failed - not authenticated"],
        ["SCL Score", "1 - bypassed spam filter"],
        ["Originating Server", "Blacklisted"],
      ],
      execution:
        "The victim extracted the zip archive and executed the batch file. Windows Event ID 4688 logged explorer.exe spawning cmd.exe - the anomalous parent-child relationship that served as the primary detection trigger. Under normal circumstances, opening a file does not result in a command prompt being launched as a child process.",
      reconIntro:
        "Immediately after execution, the payload ran five native Windows recon commands in automated sequence:",
      reconCommands: [
        ["whoami", "Identify current user and domain"],
        ["systeminfo", "Profile OS, hardware, and installed patches"],
        ["ipconfig", "Map network configuration and IP addresses"],
        ["net user", "Enumerate all local user accounts"],
        ["net localgroup administrators", "Identify accounts with admin privileges"],
      ],
      reconConclusion:
        "All output was written to %USERPROFILE%\\incident_log.txt for exfiltration. The exclusive use of native Windows binaries - no foreign executables introduced - is consistent with Living off the Land (LotL) tradecraft.",
      persistence:
        "The payload added a registry Run key to ensure execution on every subsequent user login. The entry name WindowsUpdater was deliberately chosen to blend in alongside legitimate startup entries such as OneDrive, Spotify, and Discord - a masquerading technique. Detection required cross-referencing every Run key value against known legitimate software.",
      persistenceRows: [
        ["Key", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"],
        ["Name", "WindowsUpdater"],
        ["Value", "C:\\Users\\theep\\invoice_report.bat"],
      ],
      c2:
        "PowerShell was launched by cmd.exe and initiated an outbound TCP connection to the attacker machine at 192.168.0.24 on port 4444. A netcat listener on the attacker machine received the connection. Port 4444 is not associated with any approved business application and is commonly associated with reverse shell frameworks.",
      exfiltration:
        "The collected reconnaissance data was transmitted over the established C2 channel. The exfiltrated data included hostname, OS version, victim IP, installed hotfixes, registered email, and a full list of local administrator accounts - sufficient for an attacker to plan privilege escalation and lateral movement.",
      detectionIntro:
        "Detection was performed using behavioral hunting in Splunk - no prior knowledge of the payload name, file hash, or attacker IP was used during the investigation.",
      detectionApproach:
        "Hunt for anomalous parent-child process relationships in Event ID 4688.",
      splunkQuery: `index=* EventCode=4688
| where Creator_Process_Name="C:\\\\Windows\\\\System32\\\\cmd.exe"
OR Creator_Process_Name="C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe"
OR Creator_Process_Name="C:\\\\Windows\\\\explorer.exe"
| where NOT New_Process_Name LIKE "%splunk%"
| table _time, user, New_Process_Name, Creator_Process_Name
| sort _time`,
      attackChain: [
        ["18:40:04.186", "cmd.exe", "explorer.exe", "Execution"],
        ["18:40:04.888", "whoami.exe", "cmd.exe", "Recon"],
        ["18:40:04.923", "systeminfo.exe", "cmd.exe", "Recon"],
        ["18:40:08.421", "ipconfig.exe", "cmd.exe", "Recon"],
        ["18:40:08.476", "net.exe", "cmd.exe", "Recon"],
        ["18:40:08.560", "net.exe", "cmd.exe", "Recon"],
        ["18:40:08.612", "reg.exe", "cmd.exe", "Persistence"],
        ["18:40:08.651", "powershell.exe", "cmd.exe", "C2"],
      ],
      payloadAnalysis: [
        ["Filename", "invoice_report.bat"],
        ["File Type", "Windows Batch Script"],
        ["SHA256", "d8d89dba02219e4d3014a0fa4bdf9e671e2891b95cbf0d4381d595f9c02d06d8"],
        ["VirusTotal Detections", "0 / Not Found"],
      ],
      payloadConclusion:
        "Zero detections across all antivirus engines confirmed the payload was custom-built with no prior signatures. Signature-based antivirus provided no protection. Behavioral detection via Splunk was the only effective control.",
      iocs: [
        ["Sender Email", "amahalaxmiarulljothi@hawk.illinoistech.edu"],
        ["Recipient Email", "tgandhi3@hawk.illinoistech.edu"],
        ["Malicious File", "invoice_report.bat"],
        ["SHA256", "d8d89dba02219e4d3014a0fa4bdf9e671e2891b95cbf0d4381d595f9c02d06d8"],
        ["Attacker IP", "192.168.0.24"],
        ["C2 Port", "4444 TCP"],
        ["Registry Key", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\WindowsUpdater"],
      ],
      nistMapping: [
        ["Preparation", "Enabled audit policy, configured Splunk, set up process creation logging"],
        ["Detection & Analysis", "Hunted process chains in Splunk, analyzed email headers, hashed payload, built timeline"],
        ["Containment", "Isolated endpoint, terminated C2 connection"],
        ["Eradication", "Removed registry key, deleted payload and staging file"],
        ["Recovery", "Reconnected endpoint, reset compromised credentials"],
        ["Post-Incident Activity", "Wrote SOC incident report, documented IOCs, identified detection gaps"],
      ],
      takeaways: [
        "Password-protected zip attachments bypass email content scanners - a real and widely used attacker technique",
        "A custom payload with no prior signatures is completely invisible to signature-based antivirus",
        "Behavioral detection via SIEM process chain analysis was the only effective control in this scenario",
        "The full kill chain was recovered using a single Splunk query - no prior knowledge of the payload required",
        "Living off the Land tradecraft leaves minimal forensic footprint - native Windows tools generate less suspicion than foreign executables",
        "Registry masquerading makes persistence difficult to detect without methodical cross-referencing of all startup entries",
      ],
      next: [
        "Enable command line argument logging (ProcessCreationIncludeCmdLine_Enabled) so future Event 4688 logs capture full process parameters",
        "Capture network traffic (PCAP) during the C2 phase to confirm exfiltrated data at the packet level",
        "Deploy Sysmon for richer endpoint telemetry including network connections, file creation, and DNS queries",
        "Build a Splunk alert to automatically fire when explorer.exe spawns cmd.exe or powershell.exe",
      ],
    },
    story: [
      {
        title: "The Setup",
        paragraphs: [
          "I wanted to do more than just follow a tutorial. I wanted to understand what a phishing attack actually looks like from both sides - build it, deliver it, then switch seats and find it the way a SOC analyst would. No hints. No knowing what to look for. Just logs.",
          "I set up a simple home lab - my Windows laptop as the victim, an Ubuntu VM as the attacker, both on the same network. Nothing fancy. Just enough to simulate a real scenario.",
        ],
      },
      {
        title: "Building the Attack",
        paragraphs: [
          "The first thing I learned was that delivering a malicious file is harder than it sounds.",
          "I tried sending a .bat file directly - Gmail blocked it. I zipped it - still blocked. I tried Mailinator for a test inbox - port 25 was closed. Every time I thought I had a working delivery method, something blocked it.",
          "Eventually I figured out what real attackers do - rename the payload to .txt, compress it into a password-protected zip, and put the password in the email body. The email scanner can't open an encrypted archive. It lets it through. That was my first real learning moment - email filters have a very specific blind spot, and attackers exploit it deliberately.",
          "I sent the email from one university Outlook account to another. It landed in the inbox without a single spam flag - despite DKIM, DMARC, and SPF all failing. The email looked legitimate enough that the filters gave it a low spam score and delivered it anyway.",
        ],
      },
      {
        title: "The Payload",
        paragraphs: [
          "I kept the payload simple on purpose. No Metasploit. No pre-built frameworks. Just a Windows batch script I wrote myself.",
          "It did four things in sequence - ran recon commands to profile the machine, added a registry Run key for persistence, then used PowerShell to open a TCP connection back to my Ubuntu VM and send everything it collected.",
          "I named the registry key WindowsUpdater. It sat right next to OneDrive, Spotify, Discord in the startup list. Nobody would look at it twice.",
          "On my Ubuntu terminal I had netcat listening on port 4444. When the payload ran on the Windows machine, I watched the connection come in live - hostname, OS version, IP address, all the admin accounts, installed patches. Everything an attacker needs to plan their next move. It felt uncomfortable how easy it was.",
        ],
      },
      {
        title: "Switching Sides",
        paragraphs: [
          "This was the part I was most curious about.",
          "I opened Splunk and started from scratch - no searching for invoice_report.bat, no filtering by the attacker IP I already knew. I wanted to find it the same way a real analyst would, with no prior knowledge of what to look for.",
          "The problem was noise. Splunk had over 1,500 Event ID 4688 entries. Splunk's own internal processes were generating most of them. I had to filter those out first before I could see anything meaningful.",
          "Once the noise was cleared, I narrowed my search to one question - are there any processes being spawned by parents that shouldn't be spawning them? Specifically cmd.exe, powershell.exe, and explorer.exe.",
          "That's when I saw it.",
          "explorer.exe had spawned cmd.exe at 18:40:04. That's the red flag. A user opening a normal file doesn't launch a command prompt. Something was wrong.",
          "I followed the chain. cmd.exe had spawned whoami.exe, then systeminfo.exe, then ipconfig.exe, then net.exe twice, then reg.exe, then powershell.exe - all within 4 seconds. That's not a human doing things manually. That's a script running automatically.",
          "I had the full kill chain. Six phases. Nine process events. All recovered from a single behavioral query without knowing what I was looking for when I started.",
        ],
      },
      {
        title: "The Persistence Find",
        paragraphs: [
          "The reg.exe entry in the process chain told me something had touched the registry. I queried the Run key directly and found WindowsUpdater pointing to invoice_report.bat.",
          "Looking at it sitting there among OneDrive and Spotify - I understood immediately why masquerading works. If you're not specifically looking for it, you scroll right past it. Detection required going through every single startup entry and asking whether it belonged there.",
        ],
      },
      {
        title: "What the Logs Couldn't Tell Me",
        paragraphs: [
          "After writing the incident report I noticed two gaps in my own investigation.",
          "First - Event ID 4688 showed me that reg.exe ran, but not what registry key it wrote. Command line argument logging wasn't enabled. In a real investigation that would have slowed things down significantly.",
          "Second - I knew PowerShell made an outbound connection, but I had no PCAP to prove what data actually left the machine at the network level. The Splunk logs showed the process. They didn't show the packets.",
          "Both of those gaps went into my recommendations section. Knowing what your detection setup can't see is just as important as knowing what it can.",
        ],
      },
      {
        title: "What I Took Away",
        paragraphs: [
          "The thing that stuck with me most was the VirusTotal result. Zero detections. A payload I built in twenty minutes, using nothing but native Windows tools and a PowerShell one-liner, was completely invisible to every antivirus engine.",
          "The only thing that caught it was behavioral analysis - looking at what processes spawned what, in what order, and asking whether that made sense.",
          "That's the gap between signature-based detection and behavioral detection. And it's a much bigger gap than I expected before I did this.",
        ],
      },
      {
        title: "What's Next",
        list: [
          "Enable command line logging so Event 4688 captures full process arguments",
          "Capture PCAP during C2 to confirm exfiltration at the packet level",
          "Deploy Sysmon for richer telemetry - network connections, file creation, DNS queries",
          "Upgrade the payload to a macro-based Word document to simulate a more realistic delivery mechanism and capture Event ID 4104",
        ],
      },
    ],
    date: "May 16, 2026",
    roleFit: "SOC Analyst / Cybersecurity Analyst",
    skills: [
      "SIEM & Detection",
      "Incident Response",
      "Threat Hunting",
      "Email Security",
      "Payload Development",
      "Forensics",
    ],
    demonstratedSkills: [
      "Threat Hunting",
      "Behavioral Log Analysis",
      "Email Header Analysis",
      "SIEM Querying",
      "Persistence Detection",
      "Incident Reporting",
      "IOC Identification",
      "AV Evasion Awareness",
    ],
    tools: [
      "Splunk",
      "Windows Event ID 4688",
      "MXToolbox",
      "VirusTotal",
      "netcat",
      "PowerShell",
      "Microsoft Outlook",
      "auditpol",
      "Ubuntu",
      "Windows 11",
    ],
    link: "/entry/3",
  },
  {
    title: "Setting up Pi-hole on VirtualBox for home network DNS monitoring",
    projectTitle: "Setting up Pi-hole on VirtualBox for home network DNS monitoring",
    type: "LAB",
    summary:
      "Built a live home network DNS monitoring lab with Pi-hole, VirtualBox, Ubuntu Server, Wireshark, and real device traffic.",
    goal:
      "Gain hands-on SOC-relevant skills in DNS analysis, network traffic monitoring, device fingerprinting, and threat detection on a real network - not a simulation.",
    environment:
      "Pi-hole VM on Ubuntu Server 22.04 - VirtualBox - Hitron CODA-5512 - Wireshark - 8 live clients",
    phases: [
      "VM Setup",
      "Pi-hole Deployment",
      "Router DNS Configuration",
      "Client Labeling",
      "DNS Monitoring",
      "Traffic Analysis",
    ],
    keyFindings: [
      "8 devices monitored across a live home network",
      "Identified device types, usernames, and apps in use passively",
      "Blocked 82,208 malicious and tracking domains network-wide",
      "Built a complete network map from scratch using traffic analysis",
      "Detected DNS bypass, beaconing, trackers, ARP patterns, and an unknown device mystery",
    ],
    outcome:
      "A working home SOC setup that directly mirrors enterprise DNS security tools like Cisco Umbrella and Infoblox.",
    details: {
      sections: [
        {
          title: "Objective",
          paragraphs: [
            "Deploy a DNS monitoring solution on a live home network to develop practical SOC analyst skills including traffic analysis, device fingerprinting, threat detection, and network forensics - using real devices and real traffic.",
          ],
        },
        {
          title: "Environment",
          table: {
            headers: ["Component", "Detail"],
            rows: [
              ["Hypervisor", "Oracle VirtualBox on Windows 11"],
              ["VM OS", "Ubuntu Server 22.04 LTS"],
              ["VM Resources", "2048MB RAM, 25GB storage, 1 CPU"],
              ["Network Mode", "Bridged Adapter (Realtek RTL8852AE WiFi 6)"],
              ["Pi-hole IP", "192.168.0.200 (static)"],
              ["Router", "Hitron CODA-5512 (192.168.0.1)"],
              ["Subnet", "192.168.0.0/24"],
              ["Active Clients", "8 devices"],
              ["Packet Capture", "Wireshark on Windows host"],
            ],
            monoColumns: [1],
          },
          codeTitle: "Network Topology",
          code: `Internet
    |
Hitron CODA-5512 (192.168.0.1)
    |
Pi-hole VM (192.168.0.200) <- all DNS intercepted here
    |                           |
Main WiFi devices        TP-Link RE220 Extender (192.168.0.193)
                                    |
                         Devices behind extender`,
        },
        {
          title: "Deployment Steps",
          subsections: [
            {
              title: "Step 1 - VM Setup",
              list: [
                "Created Ubuntu Server VM with Bridged network adapter",
                "Assigned static IP 192.168.0.200 via Netplan configuration",
                "Confirmed internet connectivity before Pi-hole installation",
              ],
            },
            {
              title: "Step 2 - Pi-hole Installation",
              code: "curl -sSL https://install.pi-hole.net | bash",
              list: [
                "Upstream DNS: Google (8.8.8.8)",
                "Query logging: Enabled (Privacy Mode 0 - full visibility)",
                "Blocklist: 82,208 domains loaded",
              ],
            },
            {
              title: "Step 3 - Router Configuration",
              list: [
                "Changed Hitron DHCP End IP from .200 to .199 to reserve .200 for Pi-hole",
                "Set router Primary DNS to 192.168.0.200",
                "Set Secondary DNS to 8.8.8.8 as fallback",
                "All 8 devices automatically routed through Pi-hole without individual configuration",
              ],
            },
            {
              title: "Step 4 - Client Labeling",
              table: {
                headers: ["Client", "MAC Address"],
                rows: [
                  ["aparnaa phone", "9A:9E:6D:D7:71:8F"],
                  ["aparnaa lap", "E0:0A:F6:A0:29:37"],
                  ["amazon", "B8:F8:62:A7:41:74"],
                  ["amazon2", "58:E6:C5:8A:91:78"],
                  ["ram?", "DA:62:79:3C:60:A3"],
                ],
                monoColumns: [1],
              },
            },
          ],
        },
        {
          title: "Findings",
          subsections: [
            {
              title: "Finding 1 - Device Fingerprinting via DNS",
              paragraphs: ["Identified all device types purely from DNS behavioral patterns:"],
              table: {
                headers: ["IP", "Device", "Key Evidence"],
                rows: [
                  ["192.168.0.21", "Pixel 9 (Android)", "T-Mobile RCS, Google domains"],
                  ["192.168.0.23", "iPhone (T-Mobile)", "iphone-ld.apple.com, carrier domain"],
                  ["192.168.0.193", "TP-Link Extender", "ARP sweep pattern, MAC confirmed"],
                  ["192.168.0.198", "Windows laptop", "grafana.com, office.com, theepan.local"],
                  ["192.168.0.11", "Amazon Fire TV", "acs.ntp-fireos.com"],
                ],
                monoColumns: [0],
              },
              codeTitle: "iPhone vs iPad vs Mac decision tree",
              code: `iphone-ld.apple.com present?  -> iPhone (100% confirmed)
ipad-ld.apple.com present?    -> iPad (100% confirmed)
swscan.apple.com present?     -> Mac (100% confirmed)
Carrier RCS domain present?   -> Phone (never iPad/Mac)`,
            },
            {
              title: "Finding 2 - Passive Reconnaissance Demonstration",
              paragraphs: [
                "Without any admin access or active scanning, I identified the device owner name Theepan, Windows username theep, apps in use including Spotify, Twitter/X, and DoorDash, and VirtualBox installation evidence from the 192.168.56.x virtual interface in the ARP table.",
                "This demonstrates the power and risk of passive network reconnaissance.",
              ],
            },
            {
              title: "Finding 3 - Background App Tracking",
              paragraphs: ["Captured silent background beaconing from devices at rest:"],
              table: {
                headers: ["Domain", "App", "Behavior"],
                rows: [
                  ["edge-mqtt.facebook.com", "Facebook", "Beaconing every 30 seconds"],
                  ["test-gateway.instagram.com", "Instagram", "Silent check-in"],
                  ["otel-mobile.doordash.com", "DoorDash", "Telemetry when idle"],
                  ["sdk.iad-06.braze.com", "Marketing SDK", "User tracking"],
                  ["api3.siftscience.com", "Fraud detection", "Behavior monitoring"],
                  ["api.segment.io", "Analytics", "Blocked by Pi-hole"],
                ],
                monoColumns: [0],
              },
            },
            {
              title: "Finding 4 - DNS Bypass Detection",
              list: [
                "Laptop: Hardcoded Cloudflare DNS (1.1.1.1) - identified via nslookup",
                "Pixel 9: Android Private DNS enabled - identified via phone settings",
                "SOC relevance: Same technique used by malware to bypass corporate DNS controls",
              ],
            },
            {
              title: "Finding 5 - Network Topology via ARP Analysis",
              list: [
                "Mapped complete network topology using Wireshark ARP filter",
                "Identified extender changed IP from .23 to .193 after reboot using the same MAC",
                "Confirmed devices behind extender: .13, .26, .27, .28",
                "Detected DHCP failure - unknown device repeatedly requesting IP 7+ times",
                "Identified Chromecast/Google TV via _googlecast._tcp.local MDNS",
              ],
            },
            {
              title: "Finding 6 - ARP Security Awareness",
              list: [
                "Normal ARP: gateway lookup",
                "Gratuitous ARP: new device announcing itself",
                "ARP sweep: extender scanning for known devices",
                "ARP spoofing indicator: same IP with two different MACs",
              ],
            },
          ],
        },
        {
          title: "Protocol Analysis Summary",
          table: {
            headers: ["Protocol", "Findings"],
            rows: [
              ["DNS", "Primary monitoring tool - identified all devices and apps"],
              ["ARP", "Mapped network topology, detected device changes"],
              ["QUIC", "Twitter/X streaming traffic identified"],
              ["TLS", "Microsoft/Office365 encrypted sessions"],
              ["MDNS", "Device names, Spotify, AirPlay, Chromecast discovery"],
              ["SSDP", "Smart device announcements from router"],
              ["NBNS", "Windows PC names leaked to network"],
              ["DHCP", "Unknown device failing to join network detected"],
              ["IGMPv3", "Apple multicast group membership"],
            ],
          },
        },
        {
          title: "MITRE ATT&CK Mapping",
          table: {
            headers: ["Finding", "Technique ID", "Technique Name", "Tactic"],
            rows: [
              ["Beaconing traffic detected", "T1071.004", "Application Layer Protocol: DNS", "Command and Control"],
              ["Background app calling home", "T1071.001", "Application Layer Protocol: Web", "Command and Control"],
              ["Passive device fingerprinting", "T1040", "Network Sniffing", "Discovery"],
              ["Device names leaked via NBNS", "T1016", "System Network Configuration Discovery", "Discovery"],
              ["ARP sweep by extender", "T1018", "Remote System Discovery", "Discovery"],
              ["DNS bypass via 1.1.1.1", "T1071.004", "DNS C2 bypass", "Defense Evasion"],
              ["Tracker SDKs beaconing", "T1020", "Automated Exfiltration", "Exfiltration"],
              ["App data sent silently", "T1041", "Exfiltration Over C2 Channel", "Exfiltration"],
              ["DHCP failure detection", "T1200", "Hardware Additions", "Initial Access"],
              ["MAC address randomization", "T1disguise", "Defense Evasion via MAC spoofing", "Defense Evasion"],
            ],
            monoColumns: [1],
          },
          paragraphs: [
            "These techniques were observed from a defender's perspective - detected and analyzed, not executed. This mirrors real SOC analyst work: identifying attacker techniques in live traffic.",
          ],
        },
        {
          title: "NIST Cybersecurity Framework Alignment",
          table: {
            headers: ["NIST Function", "Activity Performed", "Tool Used"],
            rows: [
              ["IDENTIFY", "Mapped all devices on network by IP, MAC, device type", "Pi-hole, Wireshark, ARP analysis"],
              ["IDENTIFY", "Identified protocols in use across network", "Wireshark protocol hierarchy"],
              ["IDENTIFY", "Discovered shadow devices", "ARP + MAC tracing"],
              ["PROTECT", "Blocked 82,208 malicious/tracking domains", "Pi-hole blocklist"],
              ["PROTECT", "Reserved static IP for DNS server", "Router DHCP configuration"],
              ["PROTECT", "Labeled all clients by MAC for tracking", "Pi-hole client management"],
              ["DETECT", "Monitored all DNS queries network-wide in real time", "Pi-hole Query Log"],
              ["DETECT", "Captured and analyzed all network packets", "Wireshark"],
              ["DETECT", "Identified DNS bypass on two devices", "nslookup + phone settings"],
              ["DETECT", "Detected background beaconing from idle devices", "Pi-hole + Wireshark"],
              ["DETECT", "Identified ARP sweep and gratuitous ARP", "Wireshark ARP filter"],
              ["RESPOND", "Documented all findings with evidence", "Project journal"],
              ["RESPOND", "Fixed DNS bypass on laptop and phone", "Manual DNS configuration"],
              ["RESPOND", "Reserved DHCP range to prevent IP conflicts", "Router settings"],
              ["RECOVER", "Confirmed Pi-hole still functional after router DNS change", "nslookup verification"],
            ],
          },
        },
        {
          title: "Enterprise Tool Mapping",
          table: {
            headers: ["This Lab", "Enterprise Equivalent"],
            rows: [
              ["Pi-hole", "Cisco Umbrella, Infoblox, Windows DNS"],
              ["Wireshark", "Network TAP, SPAN port capture"],
              ["Pi-hole Query Log", "SIEM DNS logs (Splunk, ELK)"],
              ["MAC fingerprinting", "802.1X NAC solutions"],
              ["ARP monitoring", "Dynamic ARP Inspection (DAI)"],
            ],
          },
        },
        {
          title: "Challenges and Solutions",
          table: {
            headers: ["Challenge", "Solution"],
            rows: [
              ["VM assigned wrong IP (10.10.10.2)", "Configured static IP via Netplan"],
              ["Laptop bypassing Pi-hole (1.1.1.1)", "Identified via nslookup, changed manually"],
              ["Phone not appearing in logs", "Found Android Private DNS bypass"],
              ["Devices behind extender sharing one IP", "Used DNS fingerprinting to identify individually"],
              ["Extender changing IP on reboot", "Traced via MAC address across both IPs"],
              ["DHCP conflict risk on .200", "Adjusted DHCP range to .10-.199"],
              ["Pi-hole installation taking 20+ min", "Identified slow package installation, waited"],
            ],
          },
        },
        {
          title: "Next Steps",
          list: [
            "Nmap network mapping",
            "DHCP reservations for all devices",
            "Extender AP mode for individual device visibility",
            "ELK Stack integration for log aggregation",
            "Suricata IDS deployment",
            "DNS tunneling simulation and detection",
            "ARP spoofing simulation and detection",
            "pfSense firewall deployment",
          ],
        },
      ],
    },
    date: "May 21, 2026",
    roleFit: "SOC Analyst / Network Security Analyst",
    skills: [
      "Network Security",
      "DNS Forensics",
      "Traffic Analysis",
      "Device Fingerprinting",
      "Threat Detection",
      "Incident Investigation",
    ],
    demonstratedSkills: [
      "Network Architecture",
      "DNS Forensics",
      "Traffic Analysis",
      "Device Fingerprinting",
      "Threat Awareness",
      "Incident Investigation",
      "Protocol Knowledge",
    ],
    tools: [
      "Pi-hole",
      "VirtualBox",
      "Ubuntu Server 22.04",
      "Wireshark",
      "Hitron CODA-5512",
    ],
    link: "/entry/4",
    story: [
      {
        title: "How It Started",
        paragraphs: [
          "I wanted to learn cybersecurity practically, not just theoretically. Reading about DNS and network monitoring is one thing - actually seeing it happen on a real network is completely different. So I decided to build a home network monitoring lab from scratch.",
          "The goal was simple: deploy Pi-hole on a virtual machine, point my router at it, and start watching what my network actually does. What I didn't expect was how much I would discover.",
        ],
      },
      {
        title: "Setting Up - The First Hurdles",
        paragraphs: [
          "The first mistake I made was downloading Ubuntu 26.04 instead of 22.04. A small thing, but it taught me immediately that in cybersecurity, version numbers matter. Tools are tested against specific versions and using the wrong one causes unexpected problems.",
          "Setting up VirtualBox was straightforward, but the network mode choice - Bridged vs NAT - was my first real learning moment. NAT would have kept the VM isolated. Bridged mode gave it a real IP on my home network. The difference between those two choices is the difference between a VM that works and one that doesn't for this purpose. Understanding why matters, not just which button to click.",
          "The Pi-hole installation itself took over 20 minutes. I thought it had frozen. It hadn't - just slow. That patience is also a skill.",
        ],
      },
      {
        title: "The Moment It Clicked",
        paragraphs: [
          "When I opened the Pi-hole dashboard for the first time and saw 8 active clients already logging traffic - before I had even done anything - that was the moment it clicked. The network was already talking. It had always been talking. I just couldn't see it before.",
          "Within minutes I could see someone watching YouTube, someone on Twitter, Amazon Fire devices checking in, and ads being blocked automatically.",
          "This wasn't a simulation. These were real people in my house, real devices, real traffic - and I was seeing all of it from a dashboard I built myself.",
        ],
      },
      {
        title: "The Investigation That Surprised Me Most",
        paragraphs: [
          "The most interesting discovery came from a device showing as 192.168.0.23. I thought it was the WiFi extender. Then it appeared as 192.168.0.193. Two IPs, same network - confusing.",
          "I filtered Wireshark by ARP traffic. The extender was broadcasting to find all its connected devices. I traced the MAC address across both IPs - da:62:79:3c:60:a3 - identical. Same device, two IPs. The extender had rebooted and received a new IP from DHCP.",
          "That single investigation taught me more about ARP, DHCP, and MAC addresses than any textbook could. I wasn't reading about it - I was solving it in real time.",
        ],
      },
      {
        title: "Finding Someone's Name From Passive Monitoring",
        paragraphs: [
          "The most eye-opening moment was identifying a person's name - Theepan - purely from passive network monitoring. No hacking. No admin access. Just watching.",
          "theepan.local appeared in MDNS traffic. C:\\Users\\theep leaked via NBNS broadcast. grafana.com confirmed developer or IT background. Spotify MDNS confirmed app usage.",
          "From network traffic alone I knew their name, their Windows username, their profession, what apps they were using, and that they had VirtualBox installed. They had no idea any of this was visible.",
          "This is what attackers call passive reconnaissance - and it's completely silent. No alerts. No logs on their end. Just listening.",
        ],
      },
      {
        title: "What Surprised Me About DNS",
        paragraphs: [
          "I came in thinking Pi-hole was just an ad blocker. I left understanding that DNS is one of the most powerful visibility layers in network security. Every connection starts with a DNS query. Malware has to call home - and to call home, it needs DNS. That's where you catch it.",
          "Seeing trackers like api.segment.io, sdk.iad-06.braze.com, and api3.siftscience.com all returning 0.0.0.0 - blocked by Pi-hole - while the person was just sitting there not actively using their phone - that was a revelation. Apps are constantly talking. Most people have no idea.",
        ],
      },
      {
        title: "What I Would Tell Myself Before Starting",
        list: [
          "The network is always talking - you just need the right tools to listen",
          "Version numbers matter - always double check before downloading",
          "Bridged vs NAT - understand the why, not just the what",
          "DNS is not just for ad blocking - it's your first line of security visibility",
          "Passive monitoring reveals more than active scanning - silence is powerful",
        ],
      },
      {
        title: "Where This Is Going",
        paragraphs: [
          "This lab is phase 1. The foundation is built. Next comes Nmap for active network mapping, ELK Stack for log aggregation and alerting, Suricata for intrusion detection, and eventually simulating real attacks - DNS tunneling, ARP spoofing, C2 beaconing - so I can practice detecting them.",
          "Every phase gets documented. Every finding gets written up. Because in cybersecurity, if it isn't documented, it didn't happen.",
        ],
      },
    ],
  },
  {
    title: "SIEM Threat Detection Lab",
    projectTitle: "SIEM Threat Detection Lab",
    type: "LAB",
    summary:
      "Built a multi-host SOC environment ingesting Windows and Linux logs into Splunk, simulated 7 real-world attacks, and built live detection alerts and a monitoring dashboard.",
    goal:
      "Build a working SOC lab that detects real attack patterns across Windows and Linux hosts using Splunk as the SIEM.",
    environment:
      "Windows Host (16GB): Windows log source + Splunk SIEM | Linux VM (Ubuntu 25.10, VirtualBox): Linux log source | Network: Both on same LAN via bridged adapter",
    phases: [
      "Brute Force",
      "Privilege Escalation",
      "PowerShell Execution",
      "Persistence",
      "Reconnaissance",
      "Linux Auth Abuse",
      "Sudo Abuse",
    ],
    keyFindings: [
      "25,000+ events ingested across Windows Security, Sysmon, Linux auth",
      "Sysmon captured encoded PowerShell command character by character",
      "Windows Defender flagged encoded payload as Mimikatz — demonstrating endpoint + SIEM layered detection",
      "Full attack chain detected using behavioral SPL queries",
      "Cross-platform visibility achieved over bridged LAN via rsyslog UDP 514",
      "Sysmon XML parsing failure resolved through manual forwarder config",
    ],
    outcome:
      "7 detection alerts built and firing. SOC dashboard live with 7 panels. Full Windows and Linux log visibility achieved end-to-end.",
    details: {
      sections: [
        {
          title: "Project Overview",
          paragraphs: [
            "A home SOC lab built to simulate a real Security Operations Center using Splunk Enterprise as the SIEM, ingesting logs from a Windows host and a Linux VM, detecting simulated attacks in real time.",
          ],
        },
        {
          title: "Infrastructure",
          table: {
            headers: ["Component", "Detail"],
            rows: [
              ["Laptop 1", "Windows 11, 16GB RAM — SIEM + logs"],
              ["Linux VM", "Ubuntu 25.10, VirtualBox"],
              ["SIEM", "Splunk Enterprise 10.2"],
              ["Forwarder", "Splunk Universal Forwarder"],
              ["Linux Forwarding", "rsyslog UDP 514"],
              ["Network", "Bridged adapter, same LAN"],
            ],
          },
        },
        {
          title: "Log Ingestion — Windows",
          list: [
            "Enabled security auditing via auditpol for logon events, account management, privilege use, and process creation",
            "Installed Sysmon v15 with SwiftOnSecurity community config for enriched telemetry — process creation, DNS queries, network connections",
            "Deployed Splunk Universal Forwarder configured via inputs.conf to ship Security and Sysmon logs to Splunk on port 9997",
            "Resolved Sysmon XML binary parsing issue by installing Splunk Add-on for Sysmon and reconfiguring sourcetype to xmlwineventlog",
          ],
        },
        {
          title: "Log Ingestion — Linux",
          list: [
            "Configured rsyslog to forward /var/log/auth.log to Splunk via UDP 514",
            "Resolved cross-host connectivity by switching VirtualBox adapter from NAT to Bridged and adding Windows Firewall inbound rule for UDP 514",
          ],
        },
        {
          title: "Attacks Simulated and Detections Built",
          subsections: [
            {
              title: "1. Brute Force — MITRE T1110",
              list: [
                "Simulation: PowerShell loop generating 20 failed logons for fakeuser",
                "Detection: EventCode 4625, count > 5 per account",
                "Severity: Medium",
              ],
            },
            {
              title: "2. Suspicious PowerShell — MITRE T1059.001",
              list: [
                "Simulation: Encoded command and hidden window PowerShell execution",
                "Detection: Sysmon Event ID 1, CommandLine contains EncodedCommand or hidden",
                "Severity: High",
                "Note: Windows Defender flagged as Mimikatz — demonstrated layered endpoint + SIEM detection",
              ],
            },
            {
              title: "3. New User Creation — MITRE T1136.001",
              list: [
                "Simulation: net user hacker Password123! /add",
                "Detection: EventCode 4720",
                "Severity: High",
              ],
            },
            {
              title: "4. Privilege Escalation — MITRE T1078.003",
              list: [
                "Simulation: net localgroup administrators hacker /add",
                "Detection: EventCode 4732",
                "Severity: Critical",
              ],
            },
            {
              title: "5. CMD Reconnaissance — MITRE T1059.003",
              list: [
                "Simulation: cmd.exe /c whoami, ipconfig, net user",
                "Detection: Sysmon Event ID 1, Image contains cmd.exe",
                "Severity: Medium",
              ],
            },
            {
              title: "6. Linux Failed Authentication — MITRE T1110",
              list: [
                "Simulation: su - fakeuser, su - root repeated attempts",
                "Detection: syslog keywords failed, authentication failure",
                "Severity: High",
              ],
            },
            {
              title: "7. Linux Sudo Abuse — MITRE T1548.003",
              list: [
                "Simulation: sudo cat /etc/shadow",
                "Detection: syslog keyword sudo from Linux host",
                "Severity: Medium",
              ],
            },
          ],
        },
        {
          title: "Dashboard",
          paragraphs: ["Built a 7-panel SOC Monitoring Dashboard in Splunk:"],
          list: [
            "Failed logon bar chart (by account and machine)",
            "Suspicious PowerShell command table",
            "New user creation table",
            "Privilege escalation table (by account and group)",
            "CMD process creation table (by CommandLine)",
            "Linux failed auth count (by host)",
            "Linux sudo usage count (by host)",
          ],
        },
        {
          title: "MITRE ATT&CK Coverage",
          list: [
            "T1110 — Brute Force",
            "T1059.001 — PowerShell",
            "T1059.003 — Windows Command Shell",
            "T1136.001 — Create Local Account",
            "T1078.003 — Valid Accounts",
            "T1548.003 — Sudo Abuse",
          ],
        },
        {
          title: "NIST SP 800-61 Mapping",
          table: {
            headers: ["Phase", "Actions Taken"],
            rows: [
              ["Preparation", "Enabled auditpol, installed Sysmon, configured Splunk forwarder"],
              ["Detection & Analysis", "Built SPL queries, hunted by EventCode, verified log sources"],
              ["Containment", "Alerts configured to fire on detection"],
              ["Eradication", "Cleaned up test users and registry entries"],
              ["Post-Incident", "Documented IOCs, wrote investigation report"],
            ],
          },
        },
        {
          title: "Challenges Resolved",
          list: [
            "Sysmon logs appeared as raw binary in Splunk — fixed by installing Sysmon add-on and reconfiguring sourcetype",
            "Linux VM isolated from Windows host — fixed by switching VirtualBox from NAT to Bridged adapter",
            "Windows Firewall blocking UDP 514 — fixed by adding inbound rule",
            "Splunk admin password lost — recovered via user-seed.conf",
            "Splunk Universal Forwarder reading .evtx as raw file — fixed by switching to WinEventLog input method",
          ],
        },
      ],
    },
    date: "May 21, 2026",
    roleFit: "SOC Analyst / Security Engineer",
    skills: ["SIEM & Detection", "Incident Response", "Threat Hunting", "Forensics"],
    demonstratedSkills: [
      "SIEM Configuration",
      "SPL Querying",
      "Log Ingestion",
      "Threat Detection",
      "MITRE ATT&CK Mapping",
      "Incident Alerting",
      "Cross-Platform Forensics",
      "Network Troubleshooting",
      "Sysmon Telemetry",
      "Dashboard Building",
    ],
    tools: [
      "Splunk",
      "Sysmon",
      "Windows Event Logs",
      "rsyslog",
      "VirtualBox",
      "Ubuntu",
      "Splunk Universal Forwarder",
      "auditpol",
      "PowerShell",
    ],
    images: [
      {
        src: "/images/soc-dashboard.png",
        caption: "SOC Monitoring Dashboard — 7 live panels across Windows and Linux detection alerts",
      },
      {
        src: "/images/bruteforce.png",
        caption: "Brute Force Detection — EventCode 4625, 20 failed logons for fakeuser detected via SPL",
      },
      {
        src: "/images/suspowershell.png",
        caption: "Suspicious PowerShell Detection — Sysmon Event ID 1, encoded CommandLine captured across 29,100 events",
      },
      {
        src: "/images/newuseracc.png",
        caption: "New User Account Created — EventCode 4720 fired on account creation (ComputerName: Theepan_Hrithik)",
      },
      {
        src: "/images/privescalation.png",
        caption: "Privilege Escalation — EventCode 4732, theep added to Administrators group",
      },
      {
        src: "/images/suscmd.png",
        caption: "Suspicious CMD Process Creation — 672 events, whoami, ipconfig, net user detected via Sysmon",
      },
      {
        src: "/images/linuxfailed.png",
        caption: "Linux Failed Authentication — 61 events from 192.168.0.24 via rsyslog UDP 514",
      },
      {
        src: "/images/inuxsudo.png",
        caption: "Linux Sudo Abuse — sudo cat /etc/shadow captured via syslog from 192.168.0.24",
      },
    ],
    link: "/entry/5",
    story: [
      {
        title: "The Idea",
        paragraphs: [
          "I wanted to build something that worked like a real SOC — not just follow a tutorial and call it done. The goal was simple: set up a SIEM, throw real attacks at it, and see if I could catch them.",
          "I had two laptops. One became the Windows host and Splunk server. The other ran an Ubuntu VM in VirtualBox as the Linux log source. Nothing fancy. Just enough to simulate what a real two-host environment looks like.",
        ],
      },
      {
        title: "The First Wall",
        paragraphs: [
          "Installing Splunk was straightforward. Installing Sysmon was straightforward. The first real problem came when I checked Splunk and saw nothing.",
          "Sysmon was running. Event Viewer showed hundreds of events. But Splunk was empty.",
          "I spent time going back and forth between the forwarder config and Splunk. Eventually figured out the issue — I had configured the forwarder to monitor the raw .evtx file directly. Splunk was reading it as binary. The fix was switching to WinEventLog input instead of file monitoring. Once I did that, events started flowing.",
          "Then the same thing happened with Sysmon — events were coming in but showing as unreadable hex. Installed the Splunk Add-on for Sysmon and reconfigured the sourcetype to xmlwineventlog. That fixed it.",
        ],
      },
      {
        title: "Getting Linux In",
        paragraphs: [
          "I assumed forwarding Linux logs to Splunk would be quick. It wasn't.",
          "rsyslog was configured, Splunk had the UDP port open, but nothing arrived. The Linux VM couldn't reach the Windows host at all. The problem was VirtualBox's NAT mode — the VM was completely isolated from the LAN. Switched to Bridged Adapter, the VM got a real IP on the same network, and connectivity was restored. Added a Windows Firewall inbound rule for UDP 514 and Linux logs started appearing in Splunk.",
        ],
      },
      {
        title: "Simulating the Attacks",
        paragraphs: [
          "This was the part that made everything real.",
          "Running the brute force simulation — a PowerShell loop hammering failed logons — and then watching 20 EventCode 4625 entries appear in Splunk with account names and timestamps felt like the first moment the lab actually worked.",
          "The PowerShell simulation hit an unexpected wall. Windows Defender flagged the encoded command as Mimikatz and killed the session automatically before Sysmon could log it. That was actually a valuable lesson — it showed exactly where endpoint protection picks up and where SIEM detection is needed when it doesn't.",
          "Disabled Defender temporarily, reran the command, and Sysmon captured the full encoded CommandLine. Seeing that in Splunk — the exact base64 string, the hidden window flag, the parent process — made it clear why Sysmon is so valuable for detection.",
          "The privilege escalation was the most satisfying alert. Adding a fake user to the Administrators group and watching EventCode 4732 fire in Splunk with the account name and group name — that's exactly the kind of alert that would wake someone up at 3am in a real SOC.",
        ],
      },
      {
        title: "The Password Problem",
        paragraphs: [
          "Midway through the project I lost the Splunk admin password. Tried resetting it through the CLI — every method failed because the user database had been wiped when I deleted the passwd file. Eventually recovered by creating a user-seed.conf file with the credentials and restarting Splunk. Lost the saved alerts and dashboard in the process and had to rebuild them from scratch.",
          "Annoying at the time. But rebuilding from scratch actually reinforced everything — the second time writing the SPL queries was faster and cleaner than the first.",
        ],
      },
      {
        title: "Building the Dashboard",
        paragraphs: [
          "Once all 7 alerts were working, pulling them together into a dashboard made the whole thing feel like a real SOC tool. Seeing failed logon bar charts, PowerShell command tables, privilege escalation entries, and Linux auth counts all in one view — that's what a tier-1 analyst looks at every shift.",
        ],
      },
      {
        title: "What I Took Away",
        paragraphs: [
          "The troubleshooting was 70% of the work. Every error — the binary logs, the isolated VM, the firewall blocks, the lost password — was a real problem that real analysts face. Solving them taught me more than any guided lab would have.",
          "The other thing that stuck: behavioral detection works where signature detection doesn't. Windows Defender missed the encoded PowerShell until it matched a known signature. Splunk caught it behaviorally — parent process, command flags, execution pattern. That gap is real and bigger than I expected.",
        ],
      },
      {
        title: "What's Next",
        list: [
          "Add Elastic Stack alongside Splunk to compare SIEM detection approaches on the same log data",
          "Enable command line argument logging so EventCode 4688 captures full process parameters",
          "Deploy Sysmon network connection logging to detect C2 callbacks",
          "Build correlation rules that chain multiple alerts together — brute force followed by new user creation followed by privilege escalation as a single incident",
        ],
      },
    ],
  },
];

function normalizePath(pathname) {
  const path = pathname.replace(/\/+$/, "");
  return path || "/";
}

const basePath = normalizePath(import.meta.env.BASE_URL);

function routePath(pathname) {
  const path = normalizePath(pathname);

  if (basePath === "/") {
    return path;
  }

  if (path === basePath) {
    return "/";
  }

  if (path.startsWith(`${basePath}/`)) {
    return normalizePath(path.slice(basePath.length));
  }

  return path;
}

function browserPath(path) {
  if (basePath === "/") {
    return path;
  }

  return path === "/" ? `${basePath}/` : `${basePath}${path}`;
}

function pagePath(page) {
  if (page === "entries") return "/entries";
  if (page === "research") return "/research";
  return "/";
}

function routeFromPath(pathname) {
  const path = routePath(pathname);
  const entry = entries.find((item) => item.link === path);

  if (entry) {
    return { activePage: "entries", selectedEntry: entry };
  }

  if (path === "/entries") {
    return { activePage: "entries", selectedEntry: null };
  }

  if (path === "/research") {
    return { activePage: "research", selectedEntry: null };
  }

  return { activePage: "overview", selectedEntry: null };
}

function pushPath(path) {
  const nextPath = browserPath(path);

  if (normalizePath(window.location.pathname) !== normalizePath(nextPath)) {
    window.history.pushState({}, "", nextPath);
  }
}

function App() {
  const initialRoute = routeFromPath(window.location.pathname);
  const [activePage, setActivePage] = useState(initialRoute.activePage);
  const [selectedEntry, setSelectedEntry] = useState(initialRoute.selectedEntry);
  const [openingEntry, setOpeningEntry] = useState("");
  const [entryView, setEntryView] = useState("skim");
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    function syncRoute() {
      const nextRoute = routeFromPath(window.location.pathname);
      setActivePage(nextRoute.activePage);
      setSelectedEntry(nextRoute.selectedEntry);
      setEntryView("skim");
      setOpeningEntry("");
    }

    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  function navigate(page) {
    pushPath(pagePath(page));
    setSelectedEntry(null);
    setEntryView("skim");
    setActivePage(page);
  }

  function openEntry(entry) {
    setOpeningEntry(entry.title);
    window.setTimeout(() => {
      pushPath(entry.link);
      setEntryView("skim");
      setSelectedEntry(entry);
      setOpeningEntry("");
    }, 360);
  }

  return (
    <div className={`gitlab-app theme-${theme}`}>
      <Sidebar
        activePage={activePage}
        entryView={entryView}
        selectedEntry={selectedEntry}
        setEntryView={setEntryView}
        setActivePage={navigate}
        setTheme={setTheme}
        theme={theme}
      />

      <main className="workspace" id="top">
        <div
          className={`content-shell ${
            activePage === "overview" && !selectedEntry ? "overview-mode" : ""
          }`}
        >
          <div className="breadcrumbs">
            <span>aparnaa-cybersec</span>
            <span>/</span>
            <span>personal-journal</span>
            <span>/</span>
            <strong>
              {selectedEntry
                ? selectedEntry.title
                : pageLabel(activePage)}
            </strong>
          </div>

          {selectedEntry ? (
            <EntryPage
              entry={selectedEntry}
              entryView={entryView}
              key={`${selectedEntry.title}-${entryView}`}
            />
          ) : (
            <>
              <PageHeader activePage={activePage} />
              {activePage === "overview" && <Overview />}
              {activePage === "entries" && (
                <EntryIndex entries={entries} onOpen={openEntry} openingEntry={openingEntry} />
              )}
              {activePage === "research" && <ResearchEmpty />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function PageHeader({ activePage }) {
  if (activePage === "entries") {
    return (
      <section className="project-header index-header">
        <h1>Index</h1>
        <p>{entries.length} entries</p>
      </section>
    );
  }

  if (activePage === "research") {
    return (
      <section className="project-header index-header">
        <h1>Research</h1>
        <p>Notes and papers</p>
      </section>
    );
  }

  return (
    <section className="project-header">
      <div>
        <div className="project-kicker">Personal journal</div>
        <h1>Aparnaa Mahalaxmi Arulljothi</h1>
        <p>Master's in Cybersecurity - Illinois Institute of Technology</p>
      </div>
    </section>
  );
}

function pageLabel(page) {
  if (page === "entries") return "All Entries";
  if (page === "research") return "Research";
  return "Overview";
}

function Sidebar({ activePage, entryView, selectedEntry, setActivePage, setEntryView, setTheme, theme }) {
  const isDark = theme === "dark";

  return (
    <aside className="sidebar">
      <button className="project-pill" onClick={() => setActivePage("overview")} type="button">
        Aparnaa-Journal
      </button>

      {selectedEntry ? (
        <>
          <div className="entry-context">
            <div className="entry-nav-title">Current Entry</div>
            <p>{selectedEntry.projectTitle}</p>
          </div>
          <nav className="nav-group nav-main entry-nav" aria-label="Entry navigation">
            <button
              className={entryView === "skim" ? "active" : ""}
              onClick={() => setEntryView("skim")}
              type="button"
            >
              <span className="nav-number">1.</span>
              Skim
            </button>
            <button
              className={entryView === "detailed" ? "active" : ""}
              onClick={() => setEntryView("detailed")}
              type="button"
            >
              <span className="nav-number">2.</span>
              Detailed
            </button>
            <button
              className={entryView === "story" ? "active" : ""}
              onClick={() => setEntryView("story")}
              type="button"
            >
              <span className="nav-number">3.</span>
              Story
            </button>
            {selectedEntry.images && (
              <button
                className={entryView === "gallery" ? "active" : ""}
                onClick={() => setEntryView("gallery")}
                type="button"
              >
                <span className="nav-number">4.</span>
                Gallery
              </button>
            )}
          </nav>
          <nav className="nav-group nav-main return-nav" aria-label="Return navigation">
            <button onClick={() => setActivePage("entries")} type="button">
              Index
            </button>
          </nav>
        </>
      ) : (
        <nav className="nav-group nav-main" aria-label="Journal navigation">
          <button
            className={activePage === "overview" ? "active" : ""}
            onClick={() => setActivePage("overview")}
            type="button"
          >
            <span className="nav-number">1.</span>
            Overview
          </button>
          <button
            className={activePage === "entries" ? "active" : ""}
            onClick={() => setActivePage("entries")}
            type="button"
          >
            <span className="nav-number">2.</span>
            All Entries
          </button>
          <button
            className={activePage === "research" ? "active" : ""}
            onClick={() => setActivePage("research")}
            type="button"
          >
            <span className="nav-number">3.</span>
            Research
          </button>
        </nav>
      )}

      <div className="theme-toggle-row">
        <span>{isDark ? "Dark" : "Light"}</span>
        <button
          aria-label="Toggle color theme"
          aria-pressed={isDark}
          className="theme-toggle"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          type="button"
        >
          <span />
        </button>
      </div>
    </aside>
  );
}

function Overview() {
  return (
    <section className="overview-stack">
      <article className="readme-simple">
        <p>
          This is my working journal - a place where I document what I learned, built, and figured
          out during my time studying cybersecurity.
        </p>
        <p>
          Every entry is something I actually did - a lab, an investigation, a simulation. I write
          down what worked, what didn't, and what I'd do differently. I recently graduated from
          Illinois Institute of Technology with a Master's in Cybersecurity, and most of what's here
          came from curiosity and a lot of trial and error.
        </p>
        <p className="journal-line">
          I build labs, break things intentionally, document everything, and write about it.
        </p>
      </article>

      <article className="panel achievement-card">
        <div className="panel-heading">
          <h2>Latest achievement</h2>
          <span>Research paper</span>
        </div>
        <h3>
          AgentForensics: Exploring the Real-Time Prompt Injection Detection and Forensics Threats
          in LLM Agents
        </h3>
        <p className="muted">SSRN - April 28, 2026</p>
        <p>
          An open-source security framework that detects prompt injection attacks in LLM agents in
          real time - achieving 100% detection on 7,763 injection payloads with zero false
          positives.
        </p>
        <a
          className="link-button"
          href="https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6589479"
          rel="noreferrer"
          target="_blank"
        >
          Read on SSRN
        </a>
      </article>
    </section>
  );
}

function EntryIndex({ entries: visibleEntries, onOpen, openingEntry, subtitle, title }) {
  return (
    <section className="work-panel" id="journal">
      {(title || subtitle) && (
        <div className="index-context">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      <div className="results-frame" aria-live="polite">
        {visibleEntries.length === 0 ? (
          <div className="empty-row">No entries yet</div>
        ) : (
          visibleEntries.map((entry) => (
            <EntryRow
              entry={entry}
              isOpening={openingEntry === entry.title}
              key={entry.title}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ResearchEmpty() {
  return (
    <section className="research-empty">
      <div className="research-empty-inner">
        <h2>Research</h2>
        <p>Research notes and papers will live here.</p>
        <div>No research entries yet</div>
      </div>
    </section>
  );
}

function EntryRow({ entry, isOpening, onOpen }) {
  function handleClick(event) {
    const shouldUseBrowserNavigation =
      event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    if (shouldUseBrowserNavigation) {
      return;
    }

    event.preventDefault();
    onOpen(entry);
  }

  return (
    <a
      aria-label={`Open ${entry.title}`}
      className={`entry-row clickable-entry ${isOpening ? "is-opening" : ""}`}
      href={browserPath(entry.link)}
      onClick={handleClick}
    >
      <div className="entry-content-column">
        <h3>{entry.title}</h3>
        <p>{entry.summary}</p>
      </div>
        <div className="row-meta">
          {entry.skills.map((skill) => (
            <span className="mini-label" key={skill}>
              {skill}
            </span>
          ))}
        </div>
    </a>
  );
}

function EntryPage({ entry, entryView }) {
  return (
    <article className="entry-page">
      {entryView === "skim" && <SkimEntry entry={entry} />}
      {entryView === "detailed" && <DetailedEntry entry={entry} />}
      {entryView === "story" && <StoryEntry entry={entry} />}
      {entryView === "gallery" && entry.images && <GalleryEntry entry={entry} />}
    </article>
  );
}

function SkimEntry({ entry }) {
  return (
    <>
      <header className="entry-page-header">
        <span>SKIM VIEW</span>
        <h1>{entry.projectTitle}</h1>
        <p>{entry.summary}</p>
      </header>

      <div className="skim-grid">
        <SkimSection title="Goal">
          <p>{entry.goal}</p>
        </SkimSection>

        <SkimSection title="Environment">
          <p>{entry.environment}</p>
        </SkimSection>

        <SkimSection title="Attack Phases Covered">
          <div className="phase-chain">
            {entry.phases.map((phase) => (
              <span key={phase}>{phase}</span>
            ))}
          </div>
        </SkimSection>

        <SkimSection title="Key Findings">
          <ul className="finding-list">
            {entry.keyFindings.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
        </SkimSection>

        <SkimSection title="Outcome">
          <p>{entry.outcome}</p>
        </SkimSection>

        <SkimSection title="Skills Demonstrated">
          <div className="row-meta">
            {entry.demonstratedSkills.map((skill) => (
              <span className="mini-label" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        </SkimSection>

        <SkimSection title="Tools Used">
          <div className="row-meta">
            {entry.tools.map((tool) => (
              <span className="mini-label tool-label" key={tool}>
                {tool}
              </span>
            ))}
          </div>
        </SkimSection>
      </div>
    </>
  );
}

function SkimSection({ children, title }) {
  return (
    <section className="skim-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DetailedEntry({ entry }) {
  const details = entry.details;

  if (details.sections) {
    return <GenericDetailedEntry entry={entry} />;
  }

  return (
    <div className="detailed-entry">
      <header className="entry-page-header">
        <span>DETAILED VIEW</span>
        <h1>{entry.title}</h1>
      </header>

      <DetailBlock title="Objective">
        <p>{details.objective}</p>
      </DetailBlock>

      <DetailBlock title="Lab Environment">
        <DataTable headers={["Component", "Detail"]} rows={details.labEnvironment} monoSecond />
      </DetailBlock>

      <DetailBlock title="Phase 1 - Delivery">
        {details.delivery.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <h3>Email Authentication Results</h3>
        <DataTable headers={["Check", "Result"]} rows={details.emailAuth} />
      </DetailBlock>

      <DetailBlock title="Phase 2 - Execution">
        <p>{details.execution}</p>
      </DetailBlock>

      <DetailBlock title="Phase 3 - Reconnaissance">
        <p>{details.reconIntro}</p>
        <DataTable headers={["Command", "Purpose"]} rows={details.reconCommands} monoFirst />
        <p>{details.reconConclusion}</p>
      </DetailBlock>

      <DetailBlock title="Phase 4 - Persistence">
        <p>{details.persistence}</p>
        <DataTable headers={["Field", "Value"]} rows={details.persistenceRows} monoSecond />
      </DetailBlock>

      <DetailBlock title="Phase 5 - Command and Control (C2)">
        <p>{details.c2}</p>
      </DetailBlock>

      <DetailBlock title="Phase 6 - Exfiltration">
        <p>{details.exfiltration}</p>
      </DetailBlock>

      <DetailBlock title="Detection - Splunk Analysis">
        <p>{details.detectionIntro}</p>
        <p>
          <strong>Detection approach:</strong> {details.detectionApproach}
        </p>
        <h3>Primary detection query</h3>
        <pre>{details.splunkQuery}</pre>
        <h3>Complete attack chain recovered in Splunk</h3>
        <DataTable
          headers={["Time", "New Process", "Parent Process", "Phase"]}
          rows={details.attackChain}
          monoColumns={[0, 1, 2]}
        />
      </DetailBlock>

      <DetailBlock title="Payload Analysis">
        <DataTable headers={["Field", "Value"]} rows={details.payloadAnalysis} monoSecond />
        <p>{details.payloadConclusion}</p>
      </DetailBlock>

      <DetailBlock title="Indicators of Compromise (IOCs)">
        <DataTable headers={["Type", "Value"]} rows={details.iocs} monoSecond />
      </DetailBlock>

      <DetailBlock title="NIST Mapping">
        <DataTable headers={["NIST SP 800-61 Phase", "Actions Taken"]} rows={details.nistMapping} />
      </DetailBlock>

      <DetailBlock title="Key Takeaways">
        <ul className="finding-list">
          {details.takeaways.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </DetailBlock>

      <DetailBlock title="What I Would Do Next">
        <ul className="finding-list">
          {details.next.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </DetailBlock>
    </div>
  );
}

function GenericDetailedEntry({ entry }) {
  return (
    <div className="detailed-entry">
      <header className="entry-page-header">
        <span>DETAILED VIEW</span>
        <h1>{entry.title}</h1>
      </header>

      {entry.details.sections.map((section) => (
        <DetailBlock title={section.title} key={section.title}>
          <ReportSection section={section} />
        </DetailBlock>
      ))}
    </div>
  );
}

function ReportSection({ section }) {
  return (
    <>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      {section.table && (
        <DataTable
          headers={section.table.headers}
          monoColumns={section.table.monoColumns || []}
          rows={section.table.rows}
        />
      )}

      {section.codeTitle && <h3>{section.codeTitle}</h3>}
      {section.code && <pre>{section.code}</pre>}

      {section.list && (
        <ul className="finding-list">
          {section.list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      {section.subsections?.map((subsection) => (
        <div className="report-subsection" key={subsection.title}>
          <h3>{subsection.title}</h3>
          <ReportSection section={subsection} />
        </div>
      ))}
    </>
  );
}

function DetailBlock({ children, title }) {
  return (
    <section className="detail-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DataTable({ headers, monoColumns = [], monoFirst = false, monoSecond = false, rows }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) => {
                const isMono =
                  monoColumns.includes(index) ||
                  (monoFirst && index === 0) ||
                  (monoSecond && index === 1);

                return (
                  <td className={isMono ? "mono-value" : ""} key={`${cell}-${index}`}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StoryEntry({ entry }) {
  return (
    <div className="story-entry">
      <header className="entry-page-header">
        <span>STORY VIEW</span>
        <h1>{entry.projectTitle}</h1>
        <p>How it actually went</p>
      </header>

      <div className="story-body">
        {entry.story.map((section) => (
          <section className="story-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.list && (
              <ul className="finding-list">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function GalleryEntry({ entry }) {
  const [lightboxIndex, setLightboxIndex] = React.useState(null);

  React.useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") setLightboxIndex((i) => Math.min(i + 1, entry.images.length - 1));
      if (e.key === "ArrowLeft") setLightboxIndex((i) => Math.max(i - 1, 0));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxIndex, entry.images.length]);

  return (
    <div className="gallery-entry">
      <header className="entry-page-header">
        <span>GALLERY</span>
        <h1>{entry.projectTitle}</h1>
        <p>Evidence and screenshots from the lab</p>
      </header>

      <div className="gallery-grid">
        {entry.images.map((image, index) => (
          <button
            className="gallery-card"
            key={image.src}
            onClick={() => setLightboxIndex(index)}
            type="button"
          >
            <img src={image.src} alt={image.caption} />
            <p className="gallery-caption">{image.caption}</p>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="lightbox-inner">
            <img
              src={entry.images[lightboxIndex].src}
              alt={entry.images[lightboxIndex].caption}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
              <p className="lightbox-caption">{entry.images[lightboxIndex].caption}</p>
              <div className="lightbox-controls">
                <button
                  disabled={lightboxIndex === 0}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => i - 1); }}
                  type="button"
                >
                  ←
                </button>
                <span className="lightbox-counter">
                  {lightboxIndex + 1} / {entry.images.length}
                </span>
                <button
                  disabled={lightboxIndex === entry.images.length - 1}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => i + 1); }}
                  type="button"
                >
                  →
                </button>
                <button onClick={() => setLightboxIndex(null)} type="button">
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

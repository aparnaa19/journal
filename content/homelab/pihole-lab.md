# Setting up Pi-hole for Home Network DNS Monitoring

skills: DNS Forensics, Network Traffic Analysis, Device Fingerprinting, Threat Detection, Passive Reconnaissance
tools: Pi-hole, VirtualBox, Ubuntu Server 22.04, Wireshark, Hitron CODA-5512

**LAB** · May 21, 2026 · Pi-hole VM on Ubuntu Server 22.04 · VirtualBox · 8 live clients

Built a live home network DNS monitoring lab with Pi-hole, VirtualBox, Ubuntu Server, Wireshark, and real device traffic.

## Goal

Gain hands-on SOC-relevant skills in DNS analysis, network traffic monitoring, device fingerprinting, and threat detection on a real network - not a simulation.

## Key Findings

- 8 devices monitored across a live home network
- Identified device types, usernames, and apps in use passively
- Blocked 82,208 malicious and tracking domains network-wide
- Built a complete network map from scratch using traffic analysis
- Detected DNS bypass, beaconing, trackers, ARP patterns, and an unknown device mystery

## Outcome

A working home SOC setup that directly mirrors enterprise DNS security tools like Cisco Umbrella and Infoblox.

---

## How It Started

I wanted to learn cybersecurity practically, not just theoretically. Reading about DNS and network monitoring is one thing - actually seeing it happen on a real network is completely different.

The goal was simple: deploy Pi-hole on a virtual machine, point my router at it, and start watching what my network actually does. What I didn't expect was how much I would discover.

## Lab Environment

| Component | Detail |
|-----------|--------|
| Hypervisor | Oracle VirtualBox on Windows 11 |
| VM OS | Ubuntu Server 22.04 LTS |
| Pi-hole IP | 192.168.0.200 (static) |
| Router | Hitron CODA-5512 (192.168.0.1) |
| Active Clients | 8 devices |
| Packet Capture | Wireshark on Windows host |

```
Internet
    |
Hitron CODA-5512 (192.168.0.1)
    |
Pi-hole VM (192.168.0.200)  <-- all DNS intercepted here
    |                           |
Main WiFi devices        TP-Link RE220 Extender (192.168.0.193)
```

---

## Deployment

**Installation**

```bash
curl -sSL https://install.pi-hole.net | bash
```

- Upstream DNS: Google (8.8.8.8)
- Query logging: Enabled (Privacy Mode 0 - full visibility)
- Blocklist: 82,208 domains loaded

**Router Configuration**

- Changed Hitron DHCP end IP from .200 to .199 to reserve .200 for Pi-hole
- Set router Primary DNS to 192.168.0.200
- All 8 devices automatically routed through Pi-hole without individual configuration

---

## The Moment It Clicked

When I opened the Pi-hole dashboard for the first time and saw 8 active clients already logging traffic - before I had even done anything - that was the moment it clicked. The network was already talking. It had always been talking. I just couldn't see it before.

---

## Finding 1 - Device Fingerprinting via DNS

Identified all device types purely from DNS behavioral patterns:

| IP | Device | Key Evidence |
|----|--------|-------------|
| 192.168.0.21 | Pixel 9 (Android) | T-Mobile RCS, Google domains |
| 192.168.0.23 | iPhone (T-Mobile) | iphone-ld.apple.com, carrier domain |
| 192.168.0.193 | TP-Link Extender | ARP sweep pattern, MAC confirmed |
| 192.168.0.198 | Windows laptop | grafana.com, office.com, theepan.local |
| 192.168.0.11 | Amazon Fire TV | acs.ntp-fireos.com |

## Finding 2 - Passive Reconnaissance

Without any admin access or active scanning, I identified the device owner name Theepan, Windows username theep, apps in use including Spotify, Twitter/X, and DoorDash - purely from passive traffic observation. Completely silent. No alerts on their end.

## Finding 3 - Background App Tracking

| Domain | App | Behavior |
|--------|-----|---------|
| `edge-mqtt.facebook.com` | Facebook | Beaconing every 30 seconds |
| `test-gateway.instagram.com` | Instagram | Silent check-in |
| `otel-mobile.doordash.com` | DoorDash | Telemetry when idle |
| `sdk.iad-06.braze.com` | Marketing SDK | User tracking |
| `api.segment.io` | Analytics | Blocked by Pi-hole |

## Finding 4 - DNS Bypass Detection

- Laptop: Hardcoded Cloudflare DNS (1.1.1.1) - identified via nslookup
- Pixel 9: Android Private DNS enabled - identified via phone settings
- SOC relevance: Same technique used by malware to bypass corporate DNS controls

## Finding 5 - Network Topology via ARP

The most interesting discovery came from a device showing as 192.168.0.23. I thought it was the WiFi extender. Then it appeared as 192.168.0.193. Two IPs, same network.

I filtered Wireshark by ARP traffic and traced the MAC address `da:62:79:3c:60:a3` across both IPs - identical. Same device, two IPs. The extender had rebooted and received a new DHCP address. One investigation taught me more about ARP, DHCP, and MAC addresses than any textbook could.

---

## MITRE ATT&CK Mapping

| Finding | Technique ID | Tactic |
|---------|-------------|--------|
| Passive device fingerprinting | T1040 | Discovery |
| Device names leaked via NBNS | T1016 | Discovery |
| DNS bypass via 1.1.1.1 | T1071.004 | Defense Evasion |
| Tracker SDKs beaconing | T1020 | Exfiltration |
| Beaconing traffic detected | T1071.004 | Command and Control |

## Enterprise Tool Mapping

| This Lab | Enterprise Equivalent |
|----------|-----------------------|
| Pi-hole | Cisco Umbrella, Infoblox, Windows DNS |
| Wireshark | Network TAP, SPAN port capture |
| Pi-hole Query Log | SIEM DNS logs (Splunk, ELK) |
| ARP monitoring | Dynamic ARP Inspection (DAI) |

---

## What I Took Away

- The network is always talking - you just need the right tools to listen
- DNS is not just for ad blocking - it's your first line of security visibility
- Passive monitoring reveals more than active scanning
- Version numbers matter - always double check before downloading

## Next Steps

- Nmap network mapping
- ELK Stack integration for log aggregation
- Suricata IDS deployment
- DNS tunneling simulation and detection
- ARP spoofing simulation and detection

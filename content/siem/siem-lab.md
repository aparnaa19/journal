# SIEM Threat Detection Lab

skills: SIEM Configuration, SPL Querying, Threat Detection, MITRE ATT&CK Mapping, Cross-Platform Forensics
tools: Splunk, Sysmon, Windows Event Logs, rsyslog, VirtualBox, Splunk Universal Forwarder, auditpol

**LAB** · May 21, 2026 · Windows Host + Splunk SIEM · Ubuntu VM · VirtualBox

Built a multi-host SOC environment ingesting Windows and Linux logs into Splunk, simulated 7 real-world attacks, and built live detection alerts and a monitoring dashboard.

## Goal

Build a working SOC lab that detects real attack patterns across Windows and Linux hosts using Splunk as the SIEM.

## Key Findings

- 25,000+ events ingested across Windows Security, Sysmon, Linux auth
- Sysmon captured encoded PowerShell command character by character
- Windows Defender flagged encoded payload as Mimikatz - demonstrating endpoint + SIEM layered detection
- Full attack chain detected using behavioral SPL queries
- Cross-platform visibility achieved over bridged LAN via rsyslog UDP 514

## Outcome

7 detection alerts built and firing. SOC dashboard live with 7 panels. Full Windows and Linux log visibility achieved end-to-end.

---

## The Idea

I wanted to build something that worked like a real SOC - not just follow a tutorial and call it done. The goal was simple: set up a SIEM, throw real attacks at it, and see if I could catch them.

I had two laptops. One became the Windows host and Splunk server. The other ran an Ubuntu VM in VirtualBox as the Linux log source.

## Infrastructure

| Component | Detail |
|-----------|--------|
| Laptop 1 | Windows 11, 16GB RAM - SIEM + logs |
| Linux VM | Ubuntu 25.10, VirtualBox |
| SIEM | Splunk Enterprise 10.2 |
| Forwarder | Splunk Universal Forwarder |
| Linux Forwarding | rsyslog UDP 514 |
| Network | Bridged adapter, same LAN |

---

## Log Ingestion - Windows

Installing Splunk was straightforward. Installing Sysmon was straightforward. The first real problem came when I checked Splunk and saw nothing. Sysmon was running. Event Viewer showed hundreds of events. But Splunk was empty.

The issue - I had configured the forwarder to monitor the raw `.evtx` file directly. Splunk was reading it as binary. The fix was switching to WinEventLog input. Then the same thing happened with Sysmon - events showing as unreadable hex. Installed the Splunk Add-on for Sysmon and reconfigured the sourcetype to `xmlwineventlog`. That fixed it.

- Enabled security auditing via `auditpol`
- Installed Sysmon v15 with SwiftOnSecurity community config
- Deployed Splunk Universal Forwarder via `inputs.conf`

## Log Ingestion - Linux

rsyslog was configured, Splunk had the UDP port open, but nothing arrived. The problem was VirtualBox's NAT mode - the VM was completely isolated from the LAN. Switched to Bridged Adapter, the VM got a real IP. Added a Windows Firewall inbound rule for UDP 514 and Linux logs started appearing.

---

## Attacks Simulated

### 1. Brute Force — MITRE T1110

- **Simulation:** PowerShell loop generating 20 failed logons for fakeuser
- **Detection:** EventCode 4625, count > 5 per account
- **Severity:** Medium

### 2. Suspicious PowerShell — MITRE T1059.001

- **Simulation:** Encoded command and hidden window PowerShell execution
- **Detection:** Sysmon Event ID 1, CommandLine contains EncodedCommand or hidden
- **Severity:** High

Windows Defender flagged the encoded command as Mimikatz and killed the session before Sysmon could log it. Disabled Defender temporarily, reran the command - Sysmon captured the full encoded CommandLine. This showed exactly where endpoint protection picks up and where SIEM detection fills the gap.

### 3. New User Creation — MITRE T1136.001

- **Simulation:** `net user hacker Password123! /add`
- **Detection:** EventCode 4720
- **Severity:** High

### 4. Privilege Escalation — MITRE T1078.003

- **Simulation:** `net localgroup administrators hacker /add`
- **Detection:** EventCode 4732
- **Severity:** Critical

### 5. CMD Reconnaissance — MITRE T1059.003

- **Simulation:** `cmd.exe /c whoami, ipconfig, net user`
- **Detection:** Sysmon Event ID 1, Image contains cmd.exe
- **Severity:** Medium

### 6. Linux Failed Authentication — MITRE T1110

- **Simulation:** `su - fakeuser` repeated attempts
- **Detection:** syslog keywords `failed`, `authentication failure`
- **Severity:** High

### 7. Linux Sudo Abuse — MITRE T1548.003

- **Simulation:** `sudo cat /etc/shadow`
- **Detection:** syslog keyword `sudo` from Linux host
- **Severity:** Medium

---

## SOC Dashboard

![SOC Monitoring Dashboard - 7 live panels across Windows and Linux detection alerts](/images/soc-dashboard.png)

![Brute Force Detection - EventCode 4625, 20 failed logons for fakeuser](/images/bruteforce.png)

![Suspicious PowerShell Detection - Sysmon Event ID 1, encoded CommandLine captured](/images/suspowershell.png)

![Privilege Escalation - EventCode 4732, account added to Administrators group](/images/privescalation.png)

![Linux Failed Authentication - 61 events via rsyslog UDP 514](/images/linuxfailed.png)

---

## NIST SP 800-61 Mapping

| Phase | Actions Taken |
|-------|---------------|
| Preparation | Enabled auditpol, installed Sysmon, configured Splunk forwarder |
| Detection & Analysis | Built SPL queries, hunted by EventCode, verified log sources |
| Containment | Alerts configured to fire on detection |
| Eradication | Cleaned up test users and registry entries |
| Post-Incident | Documented IOCs, wrote investigation report |

---

## Challenges Resolved

| Challenge | Solution |
|-----------|---------|
| Sysmon logs appeared as raw binary | Installed Sysmon add-on, reconfigured sourcetype |
| Linux VM isolated from Windows host | Switched VirtualBox from NAT to Bridged |
| Windows Firewall blocking UDP 514 | Added inbound rule |
| Splunk admin password lost | Recovered via user-seed.conf |

## What I Took Away

Behavioral detection works where signature detection doesn't. Windows Defender missed the encoded PowerShell until it matched a known signature. Splunk caught it behaviorally - parent process, command flags, execution pattern. That gap is real and bigger than I expected.

The troubleshooting was 70% of the work. Every error was a real problem that real analysts face.

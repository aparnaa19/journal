# Phishing Simulation, Detection & Incident Response

skills: Threat Hunting, Behavioral Analysis, Email Security, Incident Response, AV Evasion Awareness
tools: Splunk, Windows Event Logs, VirusTotal, netcat, MXToolbox, PowerShell, Outlook

**LAB**: Attacker: Ubuntu VM · Victim: Windows 11 · SIEM: Splunk Enterprise

Built and investigated a controlled phishing kill chain from delivery through payload execution, persistence, C2 callback, Splunk detection, and SOC-style reporting.

## Goal

Simulate a realistic phishing attack in a controlled home lab and detect it the way a SOC analyst would - using behavioral log analysis in Splunk, without prior knowledge of the payload.

## Key Findings

- Phishing email bypassed Outlook filters using a password-protected zip
- Custom payload had zero antivirus detections on VirusTotal
- Full kill chain detected using a single Splunk behavioral query on Event ID 4688
- Registry persistence disguised as WindowsUpdater among legitimate startup entries
- Entire kill chain completed in under 5 seconds from execution to exfiltration

## Outcome

Attack fully detected, contained, and documented as a SOC-style incident report with timeline, IOCs, and remediation recommendations.

---

## The Setup

I wanted to do more than just follow a tutorial. I wanted to understand what a phishing attack actually looks like from both sides - build it, deliver it, then switch seats and find it the way a SOC analyst would. No hints. No knowing what to look for. Just logs.

I set up a simple home lab - my Windows laptop as the victim, an Ubuntu VM as the attacker, both on the same network. Nothing fancy. Just enough to simulate a real scenario.

## Lab Environment

| Component | Detail |
|-----------|--------|
| Attacker Machine | Ubuntu 24 (VirtualBox - Bridged Network) |
| Victim Machine | Windows 11 Home - Lenovo - Build 26200 |
| SIEM | Splunk Enterprise |
| Network | Both machines on same LAN via bridged adapter |
| Attacker IP | 192.168.0.24 |
| Victim IP | 192.168.0.14 |

---

## Phase 1 - Delivery

A phishing email was crafted impersonating an IT security notice with the subject "April invoice report." The payload was a Windows batch script renamed to .txt and compressed into a password-protected zip archive. The password was included in the email body - simulating a real attacker technique used to bypass email content scanners that cannot inspect encrypted archives.

The email was sent from a university Outlook account to another. Despite DKIM, DMARC, and SPF all failing authentication, the email was delivered successfully with a low spam confidence score (SCL: 1).

| Check | Result |
|-------|--------|
| DKIM | Failed - not signed |
| DMARC | Failed - no policy on subdomain |
| SPF | Failed - not authenticated |
| SCL Score | 1 - bypassed spam filter |
| Originating Server | Blacklisted |

The first thing I learned was that delivering a malicious file is harder than it sounds. I tried sending a .bat file directly - Gmail blocked it. I zipped it - still blocked. Eventually I figured out what real attackers do - rename the payload to .txt, compress it into a password-protected zip, and put the password in the email body. The email scanner can't open an encrypted archive. That was my first real learning moment.

## Phase 2 - Execution

The victim extracted the zip archive and executed the batch file. Windows Event ID 4688 logged `explorer.exe` spawning `cmd.exe` - the anomalous parent-child relationship that served as the primary detection trigger. Under normal circumstances, opening a file does not result in a command prompt being launched as a child process.

## Phase 3 - Reconnaissance

Immediately after execution, the payload ran five native Windows recon commands in automated sequence:

| Command | Purpose |
|---------|---------|
| `whoami` | Identify current user and domain |
| `systeminfo` | Profile OS, hardware, and installed patches |
| `ipconfig` | Map network configuration and IP addresses |
| `net user` | Enumerate all local user accounts |
| `net localgroup administrators` | Identify accounts with admin privileges |

All output was written to `%USERPROFILE%\incident_log.txt` for exfiltration. The exclusive use of native Windows binaries - no foreign executables introduced - is consistent with Living off the Land (LotL) tradecraft.

## Phase 4 - Persistence

The payload added a registry Run key to ensure execution on every subsequent user login. The entry name `WindowsUpdater` was deliberately chosen to blend in alongside legitimate startup entries such as OneDrive, Spotify, and Discord.

| Field | Value |
|-------|-------|
| Key | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` |
| Name | `WindowsUpdater` |
| Value | `C:\Users\theep\invoice_report.bat` |

Looking at it sitting there among OneDrive and Spotify - I understood immediately why masquerading works. If you're not specifically looking for it, you scroll right past it.

## Phase 5 - Command and Control (C2)

PowerShell was launched by `cmd.exe` and initiated an outbound TCP connection to the attacker machine at 192.168.0.24 on port 4444. A netcat listener on the attacker machine received the connection. Port 4444 is not associated with any approved business application and is commonly associated with reverse shell frameworks.

## Phase 6 - Exfiltration

The collected reconnaissance data was transmitted over the established C2 channel. The exfiltrated data included hostname, OS version, victim IP, installed hotfixes, registered email, and a full list of local administrator accounts.

---

## Detection - Splunk Analysis

Detection was performed using behavioral hunting in Splunk - no prior knowledge of the payload name, file hash, or attacker IP was used during the investigation.

**Detection approach:** Hunt for anomalous parent-child process relationships in Event ID 4688.

```spl
index=* EventCode=4688
| where Creator_Process_Name="C:\\Windows\\System32\\cmd.exe"
OR Creator_Process_Name="C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
OR Creator_Process_Name="C:\\Windows\\explorer.exe"
| where NOT New_Process_Name LIKE "%splunk%"
| table _time, user, New_Process_Name, Creator_Process_Name
| sort _time
```

That's when I saw it. `explorer.exe` had spawned `cmd.exe` at 18:40:04. A user opening a normal file doesn't launch a command prompt.

## Complete Attack Chain Recovered in Splunk

| Time | New Process | Parent Process | Phase |
|------|-------------|----------------|-------|
| 18:40:04.186 | `cmd.exe` | `explorer.exe` | Execution |
| 18:40:04.888 | `whoami.exe` | `cmd.exe` | Recon |
| 18:40:04.923 | `systeminfo.exe` | `cmd.exe` | Recon |
| 18:40:08.421 | `ipconfig.exe` | `cmd.exe` | Recon |
| 18:40:08.476 | `net.exe` | `cmd.exe` | Recon |
| 18:40:08.560 | `net.exe` | `cmd.exe` | Recon |
| 18:40:08.612 | `reg.exe` | `cmd.exe` | Persistence |
| 18:40:08.651 | `powershell.exe` | `cmd.exe` | C2 |

---

## Payload Analysis

| Field | Value |
|-------|-------|
| Filename | `invoice_report.bat` |
| SHA256 | `d8d89dba02219e4d3014a0fa4bdf9e671e2891b95cbf0d4381d595f9c02d06d8` |
| VirusTotal Detections | 0 / Not Found |

Zero detections confirmed the payload was custom-built with no prior signatures. Signature-based antivirus provided no protection. Behavioral detection via Splunk was the only effective control.

## Indicators of Compromise

| Type | Value |
|------|-------|
| Malicious File | `invoice_report.bat` |
| SHA256 | `d8d89dba02219e4d3014a0fa4bdf9e671e2891b95cbf0d4381d595f9c02d06d8` |
| Attacker IP | `192.168.0.24` |
| C2 Port | `4444 TCP` |
| Registry Key | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\WindowsUpdater` |

## NIST SP 800-61 Mapping

| Phase | Actions Taken |
|-------|---------------|
| Preparation | Enabled audit policy, configured Splunk, set up process creation logging |
| Detection & Analysis | Hunted process chains in Splunk, analyzed email headers, hashed payload, built timeline |
| Containment | Isolated endpoint, terminated C2 connection |
| Eradication | Removed registry key, deleted payload and staging file |
| Recovery | Reconnected endpoint, reset compromised credentials |
| Post-Incident Activity | Wrote SOC incident report, documented IOCs, identified detection gaps |

---

## What I Took Away

- Password-protected zip attachments bypass email content scanners
- A custom payload with no prior signatures is invisible to signature-based antivirus
- Behavioral detection via SIEM was the only effective control in this scenario
- The full kill chain was recovered using a single Splunk query with no prior knowledge

## What I Would Do Next

- Enable command line argument logging so Event 4688 captures full process parameters
- Capture network traffic (PCAP) during the C2 phase
- Deploy Sysmon for richer endpoint telemetry
- Build a Splunk alert to fire when `explorer.exe` spawns `cmd.exe` or `powershell.exe`

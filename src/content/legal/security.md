---
title: "Security Policy"
description: "Factor42 Security Policy — how we protect your data and campaign information with enterprise-grade security practices."
lastUpdated: "April 12, 2026"
---

Legal

At Factor42, security is foundational to how we operate. We handle sensitive campaign data, advertising account credentials, and performance metrics on behalf of hundreds of media companies and agencies. This Security Policy describes the technical and organizational measures we maintain to protect that information.

GDPR Compliant CCPA Compliant SOC 2 Type II (In Progress)

## 1. Security Program Overview

Factor42 maintains a formal information security program aligned with industry best practices, including the NIST Cybersecurity Framework and ISO/IEC 27001 principles. Key elements of our program include:

-   A dedicated security function responsible for policy, monitoring, and incident response
-   Annual third-party security audits and penetration tests conducted by accredited firms
-   A Risk Management Framework that identifies, assesses, and mitigates security risks on an ongoing basis
-   Regular review and updating of security policies as the threat landscape evolves

## 2. Data Encryption

### 2.1 Data in Transit

All data transmitted between clients, our systems, and third-party platforms is encrypted using **TLS 1.2 or higher**. We enforce HTTPS across all Factor42 web properties and reject connections using deprecated protocols (TLS 1.0, TLS 1.1, SSL).

### 2.2 Data at Rest

All client data stored within Factor42 systems is encrypted at rest using **AES-256 encryption**. Encryption keys are managed using a dedicated key management service with strict access controls and rotation policies.

## 3. Access Controls

### 3.1 Role-Based Access

Access to client data and internal systems is governed by a strict role-based access control (RBAC) model. Employees are granted access only to the systems and data required for their specific job functions (principle of least privilege).

### 3.2 Multi-Factor Authentication

Multi-factor authentication (MFA) is mandatory for all Factor42 employees accessing internal systems, client advertising accounts, and cloud infrastructure. Single-factor authentication is not permitted for any privileged access.

### 3.3 Access Reviews

Access rights are reviewed on a quarterly basis. Terminated employee access is revoked within one (1) business day of offboarding.

### 3.4 Client Account Access

Factor42 accesses client advertising platform accounts (e.g., Google Ads, Meta Business Manager) strictly through official platform APIs or delegated access mechanisms. We never request or store client platform master passwords. Access is limited to personnel directly assigned to the client account.

## 4. Network Security

-   **Firewalls:** All production systems are protected by network firewalls with default-deny rules and allowlist-based traffic policies
-   **Intrusion Detection and Prevention:** IDS/IPS systems monitor network traffic for anomalous activity and known attack signatures in real time
-   **DDoS Mitigation:** Our infrastructure includes distributed denial-of-service (DDoS) mitigation services to maintain availability under attack conditions
-   **VPN:** All internal administrative access to production systems is conducted exclusively over encrypted VPN connections
-   **Network Segmentation:** Client data environments are logically segmented from one another and from internal corporate systems

## 5. Vulnerability Management

-   **Automated Scanning:** Vulnerability scans are performed monthly across all production systems and web applications
-   **Penetration Testing:** Annual penetration tests are conducted by independent, accredited security firms
-   **Patch Management:** Critical and high severity patches are applied within 30 days of release (critical patches are prioritized for remediation within 7 days)
-   **Dependency Management:** Open-source and third-party software dependencies are continuously monitored for known vulnerabilities

## 6. Incident Response

Factor42 maintains a formal Incident Response Plan (IRP) covering detection, containment, eradication, recovery, and post-incident review. Key commitments:

-   **Detection:** Security events are monitored 24/7 via automated alerting and SIEM (Security Information and Event Management) tooling
-   **Containment:** Upon confirmation of a security incident, affected systems are isolated within the shortest feasible timeframe
-   **Client Notification:** In the event of a confirmed data breach affecting client data, Factor42 will notify affected clients within **72 hours** of confirmation, in compliance with GDPR Article 33 requirements and applicable breach notification laws
-   **Post-Incident Review:** All P1 security incidents are subject to a formal root cause analysis and remediation plan shared with affected clients upon request

## 7. Employee Security

-   **Background Checks:** All employees and contractors with access to client data undergo background screening prior to engagement
-   **Security Training:** All employees complete mandatory security awareness training annually, covering phishing, social engineering, data handling, and incident reporting
-   **Confidentiality:** All employees and contractors sign Non-Disclosure Agreements (NDAs) covering client data and proprietary information
-   **Clean Desk Policy:** Employees are required to secure workstations and physical documents when not in use

## 8. Third-Party Vendor Security

Factor42 requires all third-party service providers who access or process client data to meet our security standards:

-   Security and data protection review conducted prior to vendor onboarding
-   Vendors processing personal data are required to execute a Data Processing Agreement (DPA)
-   Annual security reassessment of critical vendors
-   Vendors must report any security incidents affecting Factor42 client data within 24 hours of discovery

## 9. Data Handling and Segregation

-   **Client Data Segregation:** Campaign data, performance data, and account credentials are logically segregated per client. No client's data is accessible to or commingled with another client's environment
-   **No Data Monetization:** Factor42 does not sell, license, or share client campaign data or performance data with third parties for any purpose beyond service delivery
-   **Data Deletion:** Upon contract termination, client data is securely deleted from Factor42 systems within 30 days, with written confirmation provided upon request. Backups are purged within 90 days
-   **Data Minimization:** Factor42 collects and retains only the data necessary to deliver contracted services

## 10. Physical Security

Factor42 operates on cloud infrastructure hosted by SOC 2 Type II and ISO 27001-certified cloud providers. Physical security of data center facilities — including access controls, surveillance, and environmental controls — is maintained by our cloud infrastructure partners in accordance with their respective security certifications.

## 11. Compliance and Certifications

-   **GDPR:** Factor42 is compliant with the EU General Data Protection Regulation for all processing of personal data relating to EU/EEA individuals
-   **CCPA:** Factor42 is compliant with the California Consumer Privacy Act for California residents
-   **SOC 2 Type II:** Factor42 is actively pursuing SOC 2 Type II certification (Trust Service Criteria: Security, Availability, Confidentiality). Certification expected by Q4 2026

## 12. Responsible Disclosure

If you believe you have discovered a security vulnerability in Factor42's systems or services, we encourage responsible disclosure. Please report your findings to [security@factor42media.com](mailto:security@factor42media.com) with a detailed description of the vulnerability, steps to reproduce, and potential impact. We commit to:

-   Acknowledging receipt of your report within 48 hours
-   Investigating and providing an initial assessment within 5 business days
-   Working to remediate confirmed vulnerabilities in a timely manner
-   Not pursuing legal action against researchers who disclose in good faith and follow responsible disclosure practices

We ask that you not publicly disclose the vulnerability until we have had a reasonable opportunity to investigate and remediate.

## 13. Contact

For security-related inquiries, incident reports, or responsible disclosure:

-   **Security Team:** [security@factor42media.com](mailto:security@factor42media.com)
-   **General Privacy:** [privacy@factor42media.com](mailto:privacy@factor42media.com)

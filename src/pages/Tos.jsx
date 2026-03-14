import styles from './Tos.module.css';

const LAST_UPDATED = 'March 2025';

export default function Tos() {
  return (
    <div className={styles.page}>
      <div className={styles.inner + ' animate-fade'}>
        <div className={styles.header}>
          <h1>Terms of Service</h1>
          <p className="text-muted">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className={styles.content}>
          <Section title="1. Acceptance">
            <p>By accessing or using RXScripts, you agree to be bound by these Terms. If you disagree with any part, you may not use the platform. We reserve the right to modify these Terms at any time — continued use after changes constitutes acceptance.</p>
          </Section>

          <Section title="2. Eligibility">
            <p>You must be at least 13 years of age to use RXScripts. By registering, you confirm that you meet this requirement and that the information you provide is accurate and complete.</p>
          </Section>

          <Section title="3. User Accounts">
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately of any unauthorized access. We reserve the right to suspend or terminate accounts that violate these Terms.</p>
            <ul>
              <li>One account per person — ban evasion via alternate accounts is prohibited</li>
              <li>Impersonating other users, staff, or public figures is prohibited</li>
              <li>Account sharing is not permitted</li>
            </ul>
          </Section>

          <Section title="4. Content Policy">
            <p>Scripts and content submitted to RXScripts must comply with the following rules:</p>
            <ul>
              <li>No malware, spyware, keyloggers, or content designed to cause harm to other users</li>
              <li>No content that violates applicable laws or regulations</li>
              <li>No scripts that target or exploit specific individuals</li>
              <li>No deceptive scripts that misrepresent their function</li>
              <li>Scripts must be accurately described — misleading titles or descriptions may result in removal</li>
            </ul>
            <p>We reserve the right to remove any content at our discretion without notice.</p>
          </Section>

          <Section title="5. Intellectual Property">
            <p>You retain ownership of scripts you submit. By uploading, you grant RXScripts a non-exclusive, worldwide license to display, distribute, and reproduce your content on the platform. You represent that you have the right to grant this license.</p>
            <p>Do not upload content you do not own or have permission to distribute.</p>
          </Section>

          <Section title="6. Prohibited Conduct">
            <p>The following behaviors will result in immediate account termination:</p>
            <ul>
              <li>Attempting to gain unauthorized access to the platform, other accounts, or server infrastructure</li>
              <li>Distributing content that facilitates account theft or credential harvesting</li>
              <li>Spamming, flooding, or otherwise disrupting the community</li>
              <li>Harassment, threats, or hate speech directed at any user</li>
              <li>Circumventing rate limits, bans, or other security measures</li>
            </ul>
          </Section>

          <Section title="7. Third-Party Services">
            <p>RXScripts is not affiliated with, endorsed by, or connected to Roblox Corporation. Scripts are provided by community members and we make no guarantees regarding their safety, accuracy, or continued functionality. Use scripts at your own risk.</p>
          </Section>

          <Section title="8. Disclaimers">
            <p>RXScripts is provided "as is" without warranties of any kind. We do not guarantee that the platform will be available, error-free, or secure at all times. We are not responsible for any damages arising from your use of the platform or scripts found on it.</p>
          </Section>

          <Section title="9. Termination">
            <p>We may suspend or terminate your access to RXScripts at any time, for any reason, with or without notice. You may also delete your account at any time. Upon termination, your scripts may remain on the platform unless you request removal prior to termination.</p>
          </Section>

          <Section title="10. Contact">
            <p>Questions about these Terms? Reach out through our community channels or contact the site owner directly.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="RXScripts" className={styles.logoImg} />
          <span className={styles.logoName}>RXScripts</span>
        </div>
        <nav className={styles.links}>
          <Link to="/scripts">Scripts</Link>
          <Link to="/executors">Executors</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/docs">API</Link>
          <Link to="/tos">Terms</Link>
        </nav>
        <p className={styles.copy}>Not affiliated with Roblox Corporation.</p>
      </div>
    </footer>
  );
}

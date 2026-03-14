import { Link } from 'react-router-dom';
import { Download, Eye, Star, Key, ShieldCheck } from 'lucide-react';
import styles from './ScriptCard.module.css';

function fmt(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return n || 0;
}

export default function ScriptCard({ script }) {
  const { slug, title, description, game, thumbnail, tags = [], rating, views, downloads, is_keyless, is_verified, author } = script;

  return (
    <Link to={`/scripts/${slug}`} className={styles.card}>
      <div className={styles.thumb}>
        {thumbnail
          ? <img src={thumbnail} alt={title} className={styles.thumbImg} loading="lazy" onError={e => { e.target.style.display='none'; }} />
          : <div className={styles.thumbFallback}>{title?.[0]?.toUpperCase()}</div>
        }
        {is_verified && (
          <div className={styles.verifiedBadge} title="Verified script">
            <ShieldCheck size={12} /> Verified
          </div>
        )}
        {!is_keyless && (
          <div className={styles.keyBadge} title="Key required">
            <Key size={11} />
          </div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{title}</span>
        </div>
        {game && <span className={styles.game}>{game}</span>}
        {description && <p className={styles.desc}>{description}</p>}

        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.slice(0, 3).map(t => (
              <span key={t.id} className={styles.tag} style={{ borderColor: t.color + '55', color: t.color }}>
                {t.name}
              </span>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.stats}>
            <span><Eye size={12} />{fmt(views)}</span>
            <span><Download size={12} />{fmt(downloads)}</span>
            {rating?.avg > 0 && <span><Star size={12} />{rating.avg}</span>}
          </div>
          {author && (
            <div className={styles.author}>
              <div className={styles.authorAvatar}>
                {author.avatar_url
                  ? <img src={author.avatar_url} alt="" />
                  : author.username?.[0]?.toUpperCase()
                }
              </div>
              <span>{author.username}</span>
              {author.is_verified && <span className="verified-icon" title="Verified" style={{ width: 13, height: 13, fontSize: 7 }}>✓</span>}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

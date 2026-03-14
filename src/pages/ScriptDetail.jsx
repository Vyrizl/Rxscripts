import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Download, Eye, Star, Key, Globe, Clock, Copy, Check, Heart,
  MessageSquare, ChevronDown, ChevronUp, ArrowLeft, Loader2, User
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import styles from './ScriptDetail.module.css';

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className="mono text-xs text-muted">Lua</span>
        <button className="btn btn-ghost btn-sm" onClick={copy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={styles.code}><code>{code}</code></pre>
    </div>
  );
}

function RatingStars({ current, onRate, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div className={styles.stars}>
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate(n)}
          className={styles.starBtn}
        >
          <Star
            size={18}
            style={{
              color: n <= (hover || current) ? 'var(--yellow)' : 'var(--border-2)',
              fill: n <= (hover || current) ? 'var(--yellow)' : 'none',
              transition: 'all 0.1s'
            }}
          />
        </button>
      ))}
    </div>
  );
}

export default function ScriptDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [script, setScript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/scripts/${slug}`)
      .then(r => setScript(r.data))
      .catch(() => setScript(null))
      .finally(() => setLoading(false));
    api.get(`/scripts/${slug}/comments`).then(r => setComments(r.data)).catch(() => {});
  }, [slug]);

  const handleDownload = async () => {
    await api.post(`/scripts/${slug}/download`).catch(() => {});
    setScript(s => ({ ...s, downloads: s.downloads + 1 }));
    const blob = new Blob([script.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${script.title}.lua`; a.click();
    URL.revokeObjectURL(url);
    toast('Script downloaded', 'success');
  };

  const handleRate = async (score) => {
    if (!user) return toast('Sign in to rate', 'error');
    try {
      const r = await api.post(`/scripts/${slug}/rate`, { score });
      setScript(s => ({ ...s, rating: r.data, userRating: score }));
      toast('Rating saved', 'success');
    } catch { toast('Failed to rate', 'error'); }
  };

  const handleFavorite = async () => {
    if (!user) return toast('Sign in to favorite', 'error');
    try {
      const r = await api.post(`/scripts/${slug}/favorite`);
      setScript(s => ({ ...s, isFavorited: r.data.favorited }));
      toast(r.data.favorited ? 'Added to favorites' : 'Removed from favorites', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    if (!user) return toast('Sign in to comment', 'error');
    setPosting(true);
    try {
      const r = await api.post(`/scripts/${slug}/comments`, { content: comment });
      setComments(c => ({ ...c, comments: [...(c.comments || []), r.data] }));
      setComment('');
      toast('Comment posted', 'success');
    } catch { toast('Failed to post', 'error'); }
    finally { setPosting(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
      <Loader2 size={32} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (!script) return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-2)' }}>
      <h2>Script not found</h2>
      <Link to="/scripts" className="btn btn-primary" style={{ marginTop: 16 }}>Back to scripts</Link>
    </div>
  );

  const codePreview = showFull ? script.content : script.content.slice(0, 1200);
  const truncated = script.content.length > 1200;

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <Link to="/scripts" className={styles.back}>
        <ArrowLeft size={15} /> Back to scripts
      </Link>

      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={styles.titleRow}>
            <div>
              <div className={styles.badges}>
                {script.is_keyless ? <span className="badge badge-green"><Key size={10} /> Keyless</span> : <span className="badge badge-yellow"><Key size={10} /> Key Required</span>}
                {script.is_universal && <span className="badge badge-purple"><Globe size={10} /> Universal</span>}
                {script.is_paid && <span className="badge badge-red">Paid</span>}
                <span className={`badge ${script.status === 'active' ? 'badge-green' : script.status === 'patched' ? 'badge-red' : 'badge-yellow'}`}>
                  {script.status}
                </span>
              </div>
              <h1 className={styles.title}>{script.title}</h1>
              {script.game && <p className={styles.game}>{script.game}</p>}
            </div>
          </div>

          {script.description && (
            <p className={styles.desc}>{script.description}</p>
          )}

          {script.tags?.length > 0 && (
            <div className={styles.tags}>
              {script.tags.map(t => (
                <Link key={t.id} to={`/scripts?tag=${t.name}`} className="tag" style={{ '--tag-color': t.color }}>
                  {t.name}
                </Link>
              ))}
            </div>
          )}

          <div className={styles.codeSection}>
            <CodeBlock code={codePreview} />
            {truncated && (
              <button className={styles.showMore} onClick={() => setShowFull(f => !f)}>
                {showFull ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show full script</>}
              </button>
            )}
          </div>

          {script.executor_notes && (
            <div className={styles.notes}>
              <h3>Executor Notes</h3>
              <p>{script.executor_notes}</p>
            </div>
          )}

          {/* Comments */}
          <div className={styles.comments}>
            <h3 className={styles.commentsTitle}>
              <MessageSquare size={18} />
              Comments ({(comments.comments || []).length})
            </h3>

            {user && (
              <div className={styles.commentForm}>
                <div className={styles.commentAvatar}>{user.username[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <textarea
                    className={`input ${styles.commentInput}`}
                    placeholder="Write a comment..."
                    rows={3}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={postComment} disabled={posting} style={{ marginTop: 8 }}>
                    {posting ? <Loader2 size={13} className={styles.spin} /> : null}
                    Post Comment
                  </button>
                </div>
              </div>
            )}

            {(comments.comments || []).length === 0 ? (
              <p className="text-muted text-sm">No comments yet.</p>
            ) : (
              <div className={styles.commentList}>
                {(comments.comments || []).map(c => (
                  <div key={c.id} className={styles.comment}>
                    <div className={styles.commentAvatar}>{c.username[0].toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.commentHead}>
                        <strong>{c.username}</strong>
                        <span className="text-xs text-muted mono">{(() => {
  const s = Math.floor((Date.now() / 1000) - (c.created_at ));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  if (s < 2592000) return Math.floor(s/86400) + 'd ago';
  return new Date(c.created_at  * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
})()}</span>
                      </div>
                      <p className={styles.commentBody}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={`card ${styles.sideCard}`}>
            <button className="btn btn-primary w-full" onClick={handleDownload}>
              <Download size={16} />
              Download Script
            </button>
            <button
              className={`btn w-full ${script.isFavorited ? 'btn-danger' : 'btn-ghost'}`}
              onClick={handleFavorite}
            >
              <Heart size={15} style={{ fill: script.isFavorited ? 'currentColor' : 'none' }} />
              {script.isFavorited ? 'Favorited' : 'Add to Favorites'}
            </button>

            <hr className="divider" style={{ margin: '4px 0' }} />

            <div className={styles.statRow}><Eye size={14} /><span>{script.views} views</span></div>
            <div className={styles.statRow}><Download size={14} /><span>{script.downloads} downloads</span></div>
            <div className={styles.statRow}><Clock size={14} /><span>{new Date(script.created_at  * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
            <div className={styles.statRow}><User size={14} /><Link to={`/u/${script.author?.username}`} style={{ color: 'var(--accent)' }}>{script.author?.username}</Link></div>

            <hr className="divider" style={{ margin: '4px 0' }} />

            <div className={styles.ratingSection}>
              <div className={styles.ratingBig}>
                <span className="mono">{script.rating?.avg?.toFixed(1) || '—'}</span>
                <Star size={16} style={{ color: 'var(--yellow)', fill: 'var(--yellow)' }} />
                <span className="text-xs text-muted">({script.rating?.count})</span>
              </div>
              <RatingStars current={script.userRating || 0} onRate={handleRate} disabled={!user} />
              {!user && <p className="text-xs text-muted" style={{ textAlign: 'center' }}>Sign in to rate</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

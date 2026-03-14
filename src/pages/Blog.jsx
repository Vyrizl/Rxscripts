import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Edit2, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import api from '../lib/api';
import styles from './Blog.module.css';

function timeAgo(ts) {
  const s = Math.floor((Date.now() / 1000) - ts);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// ── Blog List ────────────────────────────────────────────────────────────────
export function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const isOwner = user?.is_owner || user?.role === 'admin';

  useEffect(() => {
    api.get('/blog').then(r => setPosts(r.data.posts)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const del = async (slug) => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.delete(`/blog/${slug}`);
      setPosts(p => p.filter(x => x.slug !== slug));
      toast('Post deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  if (loading) return <div className={styles.loading}><Loader2 size={28} className="spin" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Blog</h1>
            <p className="text-muted">Updates, guides, and announcements from the team.</p>
          </div>
          {isOwner && (
            <button className="btn btn-primary" onClick={() => nav('/blog/new')}>
              <Plus size={15} /> New Post
            </button>
          )}
        </div>

        {posts.length === 0 ? (
          <div className={styles.empty}>No posts yet.</div>
        ) : (
          <div className={styles.grid + ' stagger'}>
            {posts.map(post => (
              <article key={post.id} className={styles.card}>
                {post.cover_url && <img src={post.cover_url} alt="" className={styles.cover} />}
                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}>
                    {!post.published && <span className="badge badge-warning">Draft</span>}
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>{timeAgo(post.created_at)}</span>
                  </div>
                  <Link to={`/blog/${post.slug}`} className={styles.cardTitle}>{post.title}</Link>
                  {post.excerpt && <p className={styles.cardExcerpt}>{post.excerpt}</p>}
                  <div className={styles.cardFooter}>
                    <div className={styles.cardAuthor}>
                      <div className={styles.miniAvatar}>{post.author_name?.[0]?.toUpperCase()}</div>
                      <span>{post.author_name}</span>
                    </div>
                    {isOwner && (
                      <div className={styles.cardActions}>
                        <button className="btn btn-ghost btn-sm" onClick={() => nav(`/blog/${post.slug}/edit`)}><Edit2 size={13} /></button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(post.slug)}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Blog Post ────────────────────────────────────────────────────────────────
export function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const isOwner = user?.is_owner || user?.role === 'admin';

  useEffect(() => {
    api.get(`/blog/${slug}`).then(r => setPost(r.data.post)).catch(() => nav('/blog')).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className={styles.loading}><Loader2 size={28} className="spin" /></div>;
  if (!post) return null;

  return (
    <div className={styles.page}>
      <div className={styles.postInner + ' animate-fade'}>
        <div className={styles.backRow}>
          <Link to="/blog" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> All posts</Link>
          {isOwner && <button className="btn btn-ghost btn-sm" onClick={() => nav(`/blog/${slug}/edit`)}><Edit2 size={13} /> Edit</button>}
        </div>

        {post.cover_url && <img src={post.cover_url} alt="" className={styles.postCover} />}

        <div className={styles.postMeta}>
          {!post.published && <span className="badge badge-warning">Draft</span>}
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>{timeAgo(post.created_at)}</span>
          {post.author_name && (
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>by <strong style={{ color: 'var(--text-2)' }}>{post.author_name}</strong></span>
          )}
        </div>

        <h1 className={styles.postTitle}>{post.title}</h1>
        {post.excerpt && <p className={styles.postExcerpt}>{post.excerpt}</p>}
        <div className={styles.postContent} dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br>') }} />
      </div>
    </div>
  );
}

// ── Blog Editor ──────────────────────────────────────────────────────────────
export function BlogEditor() {
  const { slug } = useParams();
  const isEdit = !!slug && slug !== 'new';
  const [form, setForm] = useState({ title: '', excerpt: '', content: '', cover_url: '', published: false });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  useEffect(() => {
    if (!isEdit) return;
    const s = slug.replace('/edit', '');
    api.get(`/blog/${s}`).then(r => setForm(r.data.post)).catch(() => nav('/blog')).finally(() => setLoading(false));
  }, [slug]);

  if (!user?.is_owner && user?.role !== 'admin') { nav('/blog'); return null; }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title || !form.content) { toast('Title and content required', 'error'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const s = slug.replace('/edit', '');
        await api.patch(`/blog/${s}`, form);
        toast('Post updated', 'success');
        nav(`/blog/${s}`);
      } else {
        const r = await api.post('/blog', form);
        toast('Post created', 'success');
        nav(`/blog/${r.data.post.slug}`);
      }
    } catch (e) { toast(e.response?.data?.error || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className={styles.loading}><Loader2 size={28} className="spin" /></div>;

  return (
    <div className={styles.page}>
      <div className={styles.editorInner + ' animate-fade'}>
        <div className={styles.editorHeader}>
          <h2>{isEdit ? 'Edit Post' : 'New Post'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => nav('/blog')}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving && <Loader2 size={14} className="spin" />}
              {form.published ? 'Save' : 'Save Draft'}
            </button>
          </div>
        </div>
        <div className={styles.editorForm}>
          <input className="input" placeholder="Post title" value={form.title} onChange={e => set('title', e.target.value)} style={{ fontSize: '1.1rem', fontWeight: 700 }} />
          <input className="input" placeholder="Short excerpt (optional)" value={form.excerpt || ''} onChange={e => set('excerpt', e.target.value)} />
          <input className="input" placeholder="Cover image URL (optional)" value={form.cover_url || ''} onChange={e => set('cover_url', e.target.value)} />
          <textarea className="input" placeholder="Content (plain text or basic HTML)" value={form.content} onChange={e => set('content', e.target.value)} rows={16} style={{ resize: 'vertical', fontFamily: 'var(--mono)' }} />
          <label className={styles.publishRow}>
            <input type="checkbox" checked={form.published} onChange={e => set('published', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            <span>Publish immediately</span>
          </label>
        </div>
      </div>
    </div>
  );
}

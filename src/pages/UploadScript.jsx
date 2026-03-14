import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Loader2, Key, Image } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import api from '../lib/api';
import styles from './UploadScript.module.css';

const ALL_TAGS = ['aimbot','esp','autofarm','gui','trolling','universal','combat','movement','keyless','paid','fps','rpg','simulator','hub','crash'];

export default function UploadScript() {
  const [form, setForm] = useState({
    title: '', description: '', content: '', game: '', game_id: '',
    version: '1.0.0', is_keyless: true, is_universal: false, is_paid: false,
    tags: [], key_link: '', thumbnail_url: '', executor_notes: ''
  });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  if (!user) { nav('/login'); return null; }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleTag = t => set('tags', form.tags.includes(t) ? form.tags.filter(x => x !== t) : [...form.tags, t]);

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast('Title and script content are required', 'error'); return; }
    setLoading(true);
    try {
      const r = await api.post('/scripts', form);
      toast('Script uploaded!', 'success');
      nav(`/scripts/${r.data.slug}`);
    } catch (e) {
      toast(e.response?.data?.error || 'Upload failed', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner + ' animate-fade'}>
        <div className={styles.header}>
          <h1>Upload Script</h1>
          <p className="text-muted">Share your script with the community.</p>
        </div>

        <div className={styles.form}>
          {/* Title */}
          <div className={styles.field}>
            <label>Title <span className={styles.req}>*</span></label>
            <input className="input" placeholder="My Awesome Script" value={form.title} onChange={e => set('title', e.target.value)} maxLength={80} />
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label>Description</label>
            <textarea className="input" rows={3} placeholder="What does this script do?" value={form.description} onChange={e => set('description', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {/* Script content */}
          <div className={styles.field}>
            <label>Script Content <span className={styles.req}>*</span></label>
            <textarea className="input" rows={10} placeholder="-- paste your script here" value={form.content} onChange={e => set('content', e.target.value)} style={{ resize: 'vertical', fontFamily: 'var(--mono)', fontSize: '0.85rem' }} />
          </div>

          {/* Game + Game ID */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Game Name</label>
              <input className="input" placeholder="Blox Fruits" value={form.game} onChange={e => set('game', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Roblox Game ID <span className={styles.hint}>(for auto-thumbnail)</span></label>
              <input className="input" placeholder="2753915549" value={form.game_id} onChange={e => set('game_id', e.target.value)} />
            </div>
          </div>

          {/* Thumbnail — only for verified users */}
          {user.is_verified && (
            <div className={styles.field}>
              <label><Image size={13} style={{ display: 'inline', marginRight: 4 }} />Custom Thumbnail URL <span className={styles.hint}>(verified users only)</span></label>
              <input className="input" placeholder="https://i.imgur.com/..." value={form.thumbnail_url} onChange={e => set('thumbnail_url', e.target.value)} />
              {form.thumbnail_url && <img src={form.thumbnail_url} alt="preview" className={styles.thumbPreview} onError={e => e.target.style.display='none'} />}
            </div>
          )}

          {/* Key link */}
          {!form.is_keyless && (
            <div className={styles.field}>
              <label><Key size={13} style={{ display: 'inline', marginRight: 4 }} />Key Link</label>
              <input className="input" placeholder="https://linkvertise.com/..." value={form.key_link} onChange={e => set('key_link', e.target.value)} />
            </div>
          )}

          {/* Version */}
          <div className={styles.field} style={{ maxWidth: 180 }}>
            <label>Version</label>
            <input className="input" placeholder="1.0.0" value={form.version} onChange={e => set('version', e.target.value)} />
          </div>

          {/* Executor notes */}
          <div className={styles.field}>
            <label>Executor Notes <span className={styles.hint}>(compatibility info)</span></label>
            <input className="input" placeholder="Works on Synapse X, KRNL..." value={form.executor_notes} onChange={e => set('executor_notes', e.target.value)} />
          </div>

          {/* Checkboxes */}
          <div className={styles.checks}>
            <label className={styles.check}>
              <input type="checkbox" checked={form.is_keyless} onChange={e => set('is_keyless', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              <span>Keyless</span>
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={form.is_universal} onChange={e => set('is_universal', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              <span>Universal</span>
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={form.is_paid} onChange={e => set('is_paid', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              <span>Paid</span>
            </label>
          </div>

          {/* Tags */}
          <div className={styles.field}>
            <label>Tags</label>
            <div className={styles.tagGrid}>
              {ALL_TAGS.map(t => (
                <button key={t} type="button" className={`${styles.tagBtn} ${form.tags.includes(t) ? styles.tagActive : ''}`} onClick={() => toggleTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary w-full" onClick={submit} disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
            Upload Script
          </button>
        </div>
      </div>
    </div>
  );
}

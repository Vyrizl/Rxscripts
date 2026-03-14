import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, Search, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import api from '../lib/api';
import ScriptCard from '../components/ScriptCard';
import styles from './Scripts.module.css';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'downloads', label: 'Most Downloaded' },
  { value: 'views', label: 'Most Viewed' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'oldest', label: 'Oldest' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'patched', label: 'Patched' },
  { value: 'outdated', label: 'Outdated' },
];

export default function Scripts() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ scripts: [], total: 0, pages: 0 });
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const q = params.get('q') || '';
  const sort = params.get('sort') || 'newest';
  const tag = params.get('tag') || '';
  const status = params.get('status') || '';
  const page = parseInt(params.get('page') || '1');

  const setParam = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  useEffect(() => {
    api.get('/data/tags').then(r => setTags(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/scripts', { params: { q, sort, tag, status, page, limit: 24 } })
      .then(r => setData(r.data))
      .catch(() => setData({ scripts: [], total: 0, pages: 0 }))
      .finally(() => setLoading(false));
  }, [q, sort, tag, status, page]);

  const clearFilters = () => setParams(new URLSearchParams());

  const hasFilters = q || tag || status || sort !== 'newest';

  return (
    <div className="page" style={{ paddingTop: 32 }}>
      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sideSection}>
            <h3 className={styles.sideTitle}><SlidersHorizontal size={15} /> Sort</h3>
            {SORT_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`${styles.sideBtn} ${sort === o.value ? styles.active : ''}`}
                onClick={() => setParam('sort', o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className={styles.sideSection}>
            <h3 className={styles.sideTitle}>Status</h3>
            {STATUS_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`${styles.sideBtn} ${status === o.value ? styles.active : ''}`}
                onClick={() => setParam('status', o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>

          {tags.length > 0 && (
            <div className={styles.sideSection}>
              <h3 className={styles.sideTitle}>Tags</h3>
              <div className={styles.tagCloud}>
                {tags.map(t => (
                  <button
                    key={t.id}
                    className={`tag ${tag === t.name ? 'active' : ''}`}
                    onClick={() => setParam('tag', tag === t.name ? '' : t.name)}
                    style={{ '--tag-color': t.color }}
                  >
                    {t.name}
                    <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>{t.script_count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasFilters && (
            <button className="btn btn-ghost btn-sm w-full" onClick={clearFilters}>
              <X size={14} /> Clear filters
            </button>
          )}
        </aside>

        {/* Main */}
        <main className={styles.main}>
          <div className={styles.topBar}>
            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} />
              <input
                className={`input ${styles.searchInput}`}
                placeholder="Search by title, game, description..."
                defaultValue={q}
                onKeyDown={e => { if (e.key === 'Enter') setParam('q', e.target.value); }}
              />
            </div>
            <div className={styles.resultCount}>
              {loading ? <Loader2 size={14} className={styles.spin} /> : <span className="mono">{data.total}</span>}
              &nbsp;scripts
            </div>
          </div>

          {loading ? (
            <div className="grid-scripts">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 200, borderRadius: 12 }} />
              ))}
            </div>
          ) : data.scripts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-2)' }}>
              <Search size={40} style={{ margin: '0 auto 16px', color: 'var(--text-3)' }} />
              <p>No scripts found. Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid-scripts fade-up">
              {data.scripts.map(s => <ScriptCard key={s.id} script={s} />)}
            </div>
          )}

          {data.pages > 1 && (
            <div className={styles.pagination}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setParam('page', page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="mono text-sm text-muted">
                {page} / {data.pages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= data.pages}
                onClick={() => setParam('page', page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

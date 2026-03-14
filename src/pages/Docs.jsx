import { Code2, Book } from 'lucide-react';
import styles from './Docs.module.css';

const ENDPOINTS = [
  {
    method: 'GET', path: '/api/scripts',
    desc: 'List scripts with filtering, sorting, pagination.',
    params: [
      { name: 'q', type: 'string', desc: 'Search query' },
      { name: 'tag', type: 'string', desc: 'Filter by tag name' },
      { name: 'sort', type: 'string', desc: 'newest | downloads | views | rating | oldest' },
      { name: 'status', type: 'string', desc: 'active | patched | outdated' },
      { name: 'page', type: 'number', desc: 'Page number (default 1)' },
      { name: 'limit', type: 'number', desc: 'Results per page (default 20, max 50)' },
    ],
    response: `{
  "scripts": [ /* Script objects */ ],
  "total": 143,
  "page": 1,
  "pages": 8
}`
  },
  {
    method: 'GET', path: '/api/scripts/:slug',
    desc: 'Get a single script by slug.',
    response: `{
  "id": 1,
  "slug": "my-script-k3f2a",
  "title": "My Script",
  "content": "-- lua code",
  "author": { "username": "user" },
  "rating": { "avg": 4.2, "count": 15 },
  "tags": [{ "name": "aimbot", "color": "#e74c3c" }],
  "downloads": 42,
  "views": 300
}`
  },
  {
    method: 'POST', path: '/api/scripts',
    desc: 'Upload a new script. Requires auth.',
    auth: true,
    body: `{
  "title": "My Script",        // required
  "content": "-- lua code",   // required
  "description": "...",
  "game": "Da Hood",
  "game_id": "2788229376",
  "is_keyless": true,
  "is_universal": false,
  "is_paid": false,
  "tags": ["aimbot", "esp"],
  "version": "1.0.0"
}`,
  },
  {
    method: 'POST', path: '/api/scripts/:slug/rate',
    desc: 'Rate a script 1-5. Requires auth.',
    auth: true,
    body: `{ "score": 5 }`,
    response: `{ "avg": 4.5, "count": 22 }`
  },
  {
    method: 'GET', path: '/api/tags',
    desc: 'List all tags with script counts.',
    response: `[{ "id": 1, "name": "aimbot", "color": "#e74c3c", "script_count": 12 }]`
  },
  {
    method: 'GET', path: '/api/stats',
    desc: 'Site-wide statistics and featured scripts.',
    response: `{
  "total_scripts": 143,
  "total_users": 89,
  "total_downloads": 4210,
  "total_views": 18900,
  "recent": [ /* Script objects */ ],
  "popular": [ /* Script objects */ ]
}`
  },
];

const methodColors = { GET: 'var(--green)', POST: 'var(--accent)', PATCH: 'var(--yellow)', DELETE: 'var(--red)' };

export default function Docs() {
  return (
    <div className="page-sm" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ marginBottom: 8 }}>API Reference</h1>
        <p className="text-muted">Base URL: <code style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>https://your-domain.com/api</code></p>
        <p className="text-muted text-sm" style={{ marginTop: 8 }}>
          Authenticated endpoints require <code style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>Authorization: Bearer &lt;token&gt;</code> header.
        </p>
      </div>

      <div className={styles.endpoints}>
        {ENDPOINTS.map((e, i) => (
          <div key={i} className={`card ${styles.endpoint}`}>
            <div className={styles.endpointHead}>
              <div className={styles.method} style={{ color: methodColors[e.method] }}>{e.method}</div>
              <code className={styles.path}>{e.path}</code>
              {e.auth && <span className="badge badge-purple">Auth required</span>}
            </div>
            <p className={styles.desc}>{e.desc}</p>

            {e.params && (
              <div className={styles.params}>
                <div className={styles.paramsTitle}>Query Parameters</div>
                <table className={styles.table}>
                  <thead><tr><th>Param</th><th>Type</th><th>Description</th></tr></thead>
                  <tbody>
                    {e.params.map(p => (
                      <tr key={p.name}>
                        <td><code className={styles.paramName}>{p.name}</code></td>
                        <td><span className={styles.type}>{p.type}</span></td>
                        <td className="text-muted text-sm">{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {e.body && (
              <div className={styles.codeWrap}>
                <div className={styles.codeLabel}>Request Body</div>
                <pre className={styles.code}>{e.body}</pre>
              </div>
            )}

            {e.response && (
              <div className={styles.codeWrap}>
                <div className={styles.codeLabel}>Response</div>
                <pre className={styles.code}>{e.response}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/axiosClient';

export default function Browse() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = query ? { q: query } : {};
    api
      .get('/content', { params })
      .then((res) => {
        if (!cancelled) setItems(res.data.items);
      })
      .catch(() => {
        if (!cancelled) setError('Couldn\u2019t load titles right now.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="browse-screen">
      <header className="browse-header">
        <h1>Streamline</h1>
        <input
          type="search"
          placeholder="Search titles\u2026"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search titles"
        />
      </header>

      {isLoading ? <p className="page-loading">Loading\u2026</p> : null}
      {error ? <p className="page-error">{error}</p> : null}
      {!isLoading && !error && items.length === 0 ? <p className="empty-state">No titles match your search.</p> : null}

      <div className="content-grid">
        {items.map((item) => (
          <Link key={item._id} to={`/watch/${item._id}`} className="content-tile">
            <div className="content-poster">{item.title.charAt(0)}</div>
            <div className="content-title">{item.title}</div>
            <div className="content-meta">{item.releaseYear} \u00b7 {item.requiredPlan}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

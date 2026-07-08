import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="not-found-screen">
      <h1>404</h1>
      <p>This page doesn\u2019t exist.</p>
      <Link to="/">Back home</Link>
    </div>
  );
}

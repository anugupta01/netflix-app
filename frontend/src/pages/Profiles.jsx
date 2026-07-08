import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/axiosClient';

export default function Profiles() {
  const [profiles, setProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .get('/profiles')
      .then((res) => {
        if (!cancelled) setProfiles(res.data.profiles);
      })
      .catch(() => {
        if (!cancelled) setError('Couldn\u2019t load profiles. Please refresh.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectProfile(profile) {
    sessionStorage.setItem('activeProfileId', profile._id);
    navigate('/browse');
  }

  if (isLoading) return <div className="page-loading">Loading profiles\u2026</div>;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="profiles-screen">
      <h1>Who\u2019s watching?</h1>
      <div className="profiles-grid">
        {profiles.map((profile) => (
          <button key={profile._id} className="profile-tile" onClick={() => selectProfile(profile)}>
            <div className="profile-avatar" aria-hidden="true">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <span>{profile.name}</span>
            {profile.isKids ? <span className="profile-badge">Kids</span> : null}
          </button>
        ))}
        {profiles.length === 0 ? <p>No profiles yet \u2014 add one to get started.</p> : null}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/axiosClient';

function messageFor(error) {
  const code = error?.response?.data?.error?.code;
  const serverMessage = error?.response?.data?.error?.message;
  switch (code) {
    case 'PLAN_REQUIRED':
      return serverMessage; // e.g. "This title requires the STANDARD plan or higher."
    case 'REGION_BLOCKED':
      return 'This title isn\u2019t available in your region.';
    case 'FORBIDDEN':
      return serverMessage; // e.g. maturity-rating block
    case 'NOT_FOUND':
      return 'This title couldn\u2019t be found \u2014 it may have been removed.';
    default:
      return 'Couldn\u2019t start playback right now.';
  }
}

export default function Watch() {
  const { contentId } = useParams();
  const [streamUrl, setStreamUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef(null);
  const profileId = sessionStorage.getItem('activeProfileId');

  useEffect(() => {
    let cancelled = false;

    if (!profileId) {
      setError('No profile selected.');
      setIsLoading(false);
      return;
    }

    api
      .post(`/watch/${contentId}/stream-url`, { profileId })
      .then((res) => {
        if (!cancelled) setStreamUrl(res.data.streamUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(messageFor(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contentId, profileId]);

  // Periodically report progress so "continue watching" stays accurate even
  // if the tab is closed abruptly rather than only saving on unmount.
  useEffect(() => {
    if (!streamUrl) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.duration) return;
      api
        .put('/watch/progress', {
          profileId,
          contentId,
          positionSeconds: Math.floor(video.currentTime),
          durationSeconds: Math.floor(video.duration)
        })
        .catch(() => {
          // Non-fatal: a missed progress ping shouldn't interrupt playback.
        });
    }, 10000);
    return () => clearInterval(interval);
  }, [streamUrl, profileId, contentId]);

  if (isLoading) return <div className="page-loading">Loading player\u2026</div>;

  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
        <Link to="/browse">Back to browse</Link>
      </div>
    );
  }

  return (
    <div className="watch-screen">
      <Link to="/browse" className="watch-back">\u2190 Back</Link>
      <video ref={videoRef} controls className="video-player" src={streamUrl} />
    </div>
  );
}

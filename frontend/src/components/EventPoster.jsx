import React, { useEffect, useState } from 'react';

const DEFAULT_EVENT_POSTER = '/event-poster-default.svg';

const EventPoster = ({ event, className = '' }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = event?.image_url;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  if (String(event?.event_type || '').toLowerCase() === 'exam') {
    return null;
  }

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={`${event.title || 'Event'} poster`}
        onError={() => setImageFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <img
      src={DEFAULT_EVENT_POSTER}
      alt="Default event poster"
      className={`h-full w-full object-cover ${className}`}
    />
  );
};

export default EventPoster;

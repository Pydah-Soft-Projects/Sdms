import React, { useEffect, useState } from 'react';

const DEFAULT_EVENT_POSTER = '/event-poster-default.svg';

const EventPoster = ({ event, className = '' }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = event?.image_url;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={`${event?.title || 'Event'} poster`}
        onError={() => setImageFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  if (String(event?.event_type || '').toLowerCase() === 'exam') {
    return (
      <div className={`h-full w-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 flex flex-col items-center justify-center text-white p-4 select-none ${className}`}>
        <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-1.5 shadow-inner">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest text-amber-100">Examination</span>
        <span className="text-xs font-semibold text-white/95 text-center line-clamp-1 mt-0.5 max-w-full px-2">
          {event?.title || 'Exam Schedule'}
        </span>
      </div>
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

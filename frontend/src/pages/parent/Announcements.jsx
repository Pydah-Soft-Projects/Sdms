import React from 'react';
import StudentAnnouncements from '../student/StudentAnnouncements';

const ParentAnnouncements = () => {
  return (
    <div className="w-full max-w-7xl mx-auto min-h-full p-4 sm:p-6 lg:p-8">
      <StudentAnnouncements />
    </div>
  );
};

export default ParentAnnouncements;

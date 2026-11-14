import React from 'react';
import StudentTransport from '../student/Transport';

const ParentTransport = () => {
  return (
    <div className="w-full max-w-7xl mx-auto h-full p-2 sm:p-4 lg:p-6">
      <StudentTransport />
    </div>
  );
};

export default ParentTransport;

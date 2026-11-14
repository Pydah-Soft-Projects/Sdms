import React from 'react';
import StudentCalendar from '../student/StudentCalendar';

const ParentCalendar = () => {
  return (
    <div className="w-full max-w-7xl mx-auto min-h-full p-4 sm:p-6 lg:p-8">
      <StudentCalendar />
    </div>
  );
};

export default ParentCalendar;

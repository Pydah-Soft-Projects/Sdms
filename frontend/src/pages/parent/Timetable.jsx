import React from 'react';
import StudentTimetable from '../student/StudentTimetable';

const ParentTimetable = () => {
  return (
    <div className="w-full max-w-7xl mx-auto min-h-full p-4 sm:p-6 lg:p-8">
      <StudentTimetable />
    </div>
  );
};

export default ParentTimetable;

import React from 'react';
import StudentAttendance from '../student/Attendance';

const ParentAttendance = () => (
  <div className="w-full max-w-7xl mx-auto min-h-full p-4 sm:p-6 lg:p-8">
    <StudentAttendance apiPath="/parent/attendance" logParentView />
  </div>
);

export default ParentAttendance;

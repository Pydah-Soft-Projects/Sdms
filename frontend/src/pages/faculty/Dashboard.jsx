/**
 * Faculty Dashboard (Pydah v2.0)
 * Placeholder dashboard for faculty – quick links and summary.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, FileText, Megaphone, Users, MessageSquare, Clock } from 'lucide-react';

const cards = [
  { path: '/faculty/attendance', icon: CalendarCheck, label: 'Post Attendance', desc: 'Mark hourly attendance for your classes' },
  { path: '/faculty/timetable', icon: Clock, label: 'My Timetable', desc: 'View your weekly teaching schedule' },
  { path: '/faculty/content', icon: FileText, label: 'My Content', desc: 'Notes, assignments & tests' },
  { path: '/faculty/announcements', icon: Megaphone, label: 'Announcements', desc: 'Post and manage announcements' },
  { path: '/faculty/students', icon: Users, label: 'Students', desc: 'View students in your scope' },
  { path: '/faculty/chats', icon: MessageSquare, label: 'Chats', desc: 'Subject & group chats' },
];

const Dashboard = () => {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-main mb-2">Faculty Dashboard</h1>
      <p className="text-sub mb-6">Manage attendance, content, and communication.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="block p-5 bg-surface rounded-xl border border-border hover:border-[var(--primary-light)] hover:shadow-md transition-all"
          >
            <item.icon className="w-10 h-10 text-primary mb-3" />
            <h2 className="font-medium text-main">{item.label}</h2>
            <p className="text-sm text-muted-text mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;

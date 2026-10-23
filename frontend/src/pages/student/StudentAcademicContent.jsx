import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { BookOpen, FileText, ClipboardList, FileQuestion, Download, Calendar, ArrowLeft, Search, Loader2 } from 'lucide-react';

const typeLabels = { note: 'Lecture Note', assignment: 'Assignment', test: 'Class Test' };
const typeColors = {
  note: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  assignment: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  test: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
};

const StudentAcademicContent = () => {
  const navigate = useNavigate();
  const [contentList, setContentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await api.get('/academic-content');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setContentList(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load academic content:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  const filteredContent = contentList.filter((item) => {
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesSearch =
      !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="text-blue-600 w-5 h-5" />
              Academic Content & Notes
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Access lecture notes, assignments, and test study materials.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search subject, title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {[
          { key: 'all', label: 'All Content' },
          { key: 'note', label: 'Lecture Notes' },
          { key: 'assignment', label: 'Assignments' },
          { key: 'test', label: 'Tests' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedType(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedType === tab.key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
          <p className="text-xs font-semibold text-slate-500">Loading academic content...</p>
        </div>
      ) : filteredContent.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <BookOpen size={26} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No content available</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {searchQuery
              ? 'No materials matched your search criteria.'
              : 'Your faculty have not uploaded any study material for this section yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredContent.map((item) => {
            const typeStyle = typeColors[item.type] || typeColors.note;
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                      {typeLabels[item.type] || item.type}
                    </span>
                    {item.due_date && (
                      <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Calendar size={12} />
                        Due: {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h3>
                  {item.subject_name && (
                    <p className="text-xs font-semibold text-blue-600 mt-0.5">{item.subject_name}</p>
                  )}
                  {item.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400">
                    Posted: {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  {item.file_url ? (
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all"
                    >
                      <Download size={13} />
                      Attachment
                    </a>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">No file attached</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentAcademicContent;

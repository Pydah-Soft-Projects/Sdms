import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import {
  BookOpen,
  Search,
  ArrowLeft,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  MapPin,
  Barcode,
  Hash,
  X,
  Filter,
  ArrowUpDown,
  BookMarked,
  Building,
  Library as LibraryIcon,
  HelpCircle
} from 'lucide-react';
import { SkeletonCard, SkeletonBox } from '../../components/SkeletonLoader';

const categoryColorStyles = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
];

const getCategoryColor = (catName = '') => {
  if (!catName) return categoryColorStyles[0];
  let hash = 0;
  for (let i = 0; i < catName.length; i++) {
    hash = catName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % categoryColorStyles.length;
  return categoryColorStyles[index];
};

const Library = () => {
  const navigate = useNavigate();

  // State
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedShelf, setSelectedShelf] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // 'all', 'available', 'issued'
  const [sortBy, setSortBy] = useState('title_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBooks, setTotalBooks] = useState(0);
  const [stats, setStats] = useState({
    totalTitles: 0,
    totalCopies: 0,
    availableCopies: 0,
    categoriesCount: 0
  });

  // Modal
  const [selectedBook, setSelectedBook] = useState(null);

  // Fetch Categories and Shelves
  const fetchFilterMetadata = async () => {
    try {
      const [catRes, shelfRes] = await Promise.allSettled([
        api.get('/library/categories'),
        api.get('/library/shelves')
      ]);

      if (catRes.status === 'fulfilled' && catRes.value.data?.success) {
        setCategories(catRes.value.data.data || []);
      }
      if (shelfRes.status === 'fulfilled' && shelfRes.value.data?.success) {
        setShelves(shelfRes.value.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load library metadata:', err);
    }
  };

  // Fetch Books
  const fetchBooks = async (page = 1, isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const params = {
        page,
        limit: 12,
        search: searchQuery.trim(),
        category: selectedCategory === 'all' ? '' : selectedCategory,
        shelf: selectedShelf === 'all' ? '' : selectedShelf,
        availability: availabilityFilter,
        sort: sortBy
      };

      const res = await api.get('/library/books', { params });
      if (res.data?.success) {
        setBooks(res.data.data?.books || []);
        setTotalPages(res.data.data?.pagination?.totalPages || 1);
        setTotalBooks(res.data.data?.pagination?.total || 0);
        setCurrentPage(res.data.data?.pagination?.page || 1);
        if (res.data.data?.stats) {
          setStats(res.data.data.stats);
        }
        setIsConnected(res.data.isConnected !== false);
      }
    } catch (err) {
      console.error('Failed to fetch library books:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFilterMetadata();
  }, []);

  // Debounced search & filter re-fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBooks(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, selectedShelf, availabilityFilter, sortBy]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchBooks(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedShelf('all');
    setAvailabilityFilter('all');
    setSortBy('title_asc');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <LibraryIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </span>
              Library Catalog
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Browse books, check shelf stack locations, and view real-time copy availability.
            </p>
          </div>
        </div>

        {/* Search & Refresh Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, author, barcode, ISBN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => fetchBooks(currentPage, true)}
            disabled={refreshing || loading}
            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh Catalog"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* Disconnection / Setup Notice if Library DB is not yet set in .env */}
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900">Library Database Setup In Progress</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              The MongoDB connection for the Library catalog (<code className="px-1.5 py-0.5 bg-amber-100 rounded font-mono text-[11px]">LIBRARY_MONGO_URI</code>) is being configured. Once your administrator connects the database, your complete library collection will load automatically here.
            </p>
          </div>
        </div>
      )}

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <BookMarked size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Titles</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : (stats.totalTitles || totalBooks).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Available Copies</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : (stats.availableCopies || 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Physical Copies</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : (stats.totalCopies || 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Bookmark size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Categories</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {loading ? '...' : (stats.categoriesCount || categories.length || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        {/* Category Pills (horizontal scrollable) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === cat.name
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{cat.name}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedCategory === cat.name ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-700'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Filter Dropdowns & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Shelf Filter */}
            {shelves.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <MapPin size={14} className="text-slate-400" />
                <select
                  value={selectedShelf}
                  onChange={(e) => setSelectedShelf(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Shelves / Stacks</option>
                  {shelves.map((sh) => (
                    <option key={sh} value={sh}>{sh}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Availability Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setAvailabilityFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  availabilityFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setAvailabilityFilter('available')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  availabilityFilter === 'available'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                In Stock
              </button>
              <button
                onClick={() => setAvailabilityFilter('issued')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  availabilityFilter === 'issued'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Out of Stock
              </button>
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown size={14} className="text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="title_asc">Title (A → Z)</option>
                <option value="title_desc">Title (Z → A)</option>
                <option value="author_asc">Author (A → Z)</option>
                <option value="available_desc">Highest Available</option>
                <option value="newest">Recently Added</option>
              </select>
            </div>

            {(searchQuery || selectedCategory !== 'all' || selectedShelf !== 'all' || availabilityFilter !== 'all') && (
              <button
                onClick={resetFilters}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Book Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex justify-between items-start">
                <SkeletonBox className="h-6 w-24 rounded-lg" />
                <SkeletonBox className="h-6 w-28 rounded-lg" />
              </div>
              <SkeletonBox className="h-6 w-3/4 rounded-md" />
              <SkeletonBox className="h-4 w-1/2 rounded-md" />
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <SkeletonBox className="h-4 w-full rounded" />
                <SkeletonBox className="h-8 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-3">
          <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl w-fit mx-auto">
            <BookOpen size={36} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Books Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all' || availabilityFilter !== 'all'
              ? 'No books match the specified search or filter criteria. Try clearing some filters.'
              : 'There are currently no books cataloged in the library database.'}
          </p>
          {(searchQuery || selectedCategory !== 'all' || availabilityFilter !== 'all' || selectedShelf !== 'all') && (
            <button
              onClick={resetFilters}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => {
            const catColor = getCategoryColor(book.category);
            const isAvailable = (book.available ?? 0) > 0;
            const percentage = book.total > 0 ? Math.min(100, Math.round(((book.available || 0) / book.total) * 100)) : 0;

            return (
              <div
                key={book._id || book.accession}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3.5">
                  {/* Category & Shelf Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${catColor.bg} ${catColor.text} ${catColor.border}`}>
                      {book.category || 'General'}
                    </span>

                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700">
                      <MapPin size={11} className="text-slate-400" />
                      {book.shelf || 'Central Stack'}
                    </span>
                  </div>

                  {/* Title & Author */}
                  <div>
                    <h2
                      onClick={() => setSelectedBook(book)}
                      className="font-bold text-slate-900 text-base leading-snug line-clamp-2 hover:text-blue-600 transition-colors cursor-pointer"
                      title={book.title}
                    >
                      {book.title}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      by <span className="text-slate-700 font-semibold">{book.author}</span>
                    </p>
                  </div>

                  {/* Metadata Chips: Publisher, Edition, Accession */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate" title={book.publisher || 'Institutional Press'}>
                        {book.publisher || 'Institutional Press'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <Bookmark size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate" title={book.edition || 'Standard'}>
                        {book.edition || 'Standard Edition'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <Hash size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate font-mono" title={`Accession: ${book.accession}`}>
                        Acc: {book.accession}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <Barcode size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate font-mono" title={`Barcode: ${book.barcode}`}>
                        {book.barcode}
                      </span>
                    </div>
                  </div>

                  {/* Stock Availability Indicator */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">Availability</span>
                      <span className={`font-bold flex items-center gap-1.5 ${isAvailable ? 'text-emerald-700' : 'text-rose-700'}`}>
                        <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {isAvailable ? `${book.available} of ${book.total} Available` : 'Out of Stock'}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          percentage > 50 ? 'bg-emerald-500' : percentage > 20 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Footer Button */}
                <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {book.isbn ? `ISBN: ${book.isbn}` : `Code: ${book.category_code || 'GEN'}`}
                  </span>
                  <button
                    onClick={() => setSelectedBook(book)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    View Copies
                    <ArrowLeft size={12} className="rotate-180" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-500">
            Showing Page <span className="font-bold text-slate-800">{currentPage}</span> of{' '}
            <span className="font-bold text-slate-800">{totalPages}</span> ({totalBooks} books)
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Previous
            </button>

            {/* Numeric Page Buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;

              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Book Detail & Copies Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getCategoryColor(selectedBook.category).bg} ${getCategoryColor(selectedBook.category).text} ${getCategoryColor(selectedBook.category).border}`}>
                    {selectedBook.category || 'General'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Acc: {selectedBook.accession}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {selectedBook.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Author: <span className="text-slate-800 font-bold">{selectedBook.author}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedBook(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              {/* Metadata Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Shelf / Stack</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} className="text-blue-500" />
                    {selectedBook.shelf || 'Central Stack'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Publisher</span>
                  <span className="font-bold text-slate-800 mt-0.5 block truncate" title={selectedBook.publisher}>
                    {selectedBook.publisher || 'Institutional Press'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Edition</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">
                    {selectedBook.edition || 'Standard Edition'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">ISBN</span>
                  <span className="font-bold text-slate-800 font-mono mt-0.5 block">
                    {selectedBook.isbn || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Master Barcode</span>
                  <span className="font-bold text-slate-800 font-mono mt-0.5 block">
                    {selectedBook.barcode || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Availability</span>
                  <span className={`font-bold mt-0.5 block ${selectedBook.available > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {selectedBook.available} of {selectedBook.total} Available
                  </span>
                </div>
              </div>

              {/* Sequential Copies Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers size={16} className="text-blue-600" />
                    Copy-by-Copy Status Details
                  </h4>
                  <span className="text-xs text-slate-400 font-medium">
                    {selectedBook.copies_detail?.length || selectedBook.total || 0} Total Copies
                  </span>
                </div>

                {Array.isArray(selectedBook.copies_detail) && selectedBook.copies_detail.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Copy #</th>
                          <th className="py-2.5 px-3">Serial No</th>
                          <th className="py-2.5 px-3">Accession / Barcode</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedBook.copies_detail.map((copy, idx) => {
                          const isCopyAvailable = (copy.status || 'Available').toLowerCase() === 'available';
                          return (
                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                #{copy.copy_number || idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">
                                {copy.serial_no || `SN-${idx + 1}`}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">
                                <div>{copy.accession || selectedBook.accession}</div>
                                {copy.barcode && (
                                  <div className="text-[10px] text-slate-400">{copy.barcode}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  isCopyAvailable
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isCopyAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                  {copy.status || 'Available'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                    No individual copy barcodes have been registered for this title yet.
                    {selectedBook.available > 0 ? (
                      <span className="text-emerald-600 font-bold block mt-1">
                        {selectedBook.available} copies are registered in the main stack.
                      </span>
                    ) : (
                      <span className="text-rose-600 font-bold block mt-1">
                        All copies currently checked out.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <HelpCircle size={14} className="text-slate-400" />
                Visit the central circulation desk to borrow physical copies.
              </span>
              <button
                onClick={() => setSelectedBook(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;


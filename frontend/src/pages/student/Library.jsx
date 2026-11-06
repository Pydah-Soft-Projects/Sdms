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
  { bg: 'bg-[var(--primary-light)]', text: 'text-primary', border: 'border-[var(--primary-light)]' },
  { bg: 'bg-[var(--success-light)]', text: 'text-success', border: 'border-[var(--success-light)]' },
  { bg: 'bg-[var(--primary-light)]', text: 'text-secondary', border: 'border-[var(--primary-light)]' },
  { bg: 'bg-[var(--warning-light)]', text: 'text-warning', border: 'border-[var(--warning-light)]' },
  { bg: 'bg-[var(--danger-light)]', text: 'text-danger', border: 'border-[var(--danger-light)]' },
  { bg: 'bg-[var(--primary-light)]', text: 'text-info', border: 'border-[var(--primary-light)]' },
  { bg: 'bg-[var(--primary-light)]', text: 'text-primary', border: 'border-[var(--primary-light)]' },
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
      <div className="bg-surface p-4 sm:p-6 rounded-2xl border border-border shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="p-2.5 rounded-xl text-muted-text hover:text-main hover:bg-background transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-main tracking-tight flex items-center gap-2.5">
              <span className="p-2 bg-[var(--primary-light)] text-primary rounded-xl">
                <LibraryIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </span>
              Library Catalog
            </h1>
            <p className="text-xs sm:text-sm text-muted-text font-medium mt-0.5">
              Browse books, check shelf stack locations, and view real-time copy availability.
            </p>
          </div>
        </div>

        {/* Search & Refresh Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              placeholder="Search title, author, barcode, ISBN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-border bg-[var(--background)]/70 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-text hover:text-sub p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => fetchBooks(currentPage, true)}
            disabled={refreshing || loading}
            className="p-2 text-sub hover:text-primary hover:bg-[var(--primary-light)] rounded-xl border border-border transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh Catalog"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin text-primary' : ''} />
          </button>
        </div>
      </div>

      {/* Disconnection / Setup Notice if Library DB is not yet set in .env */}
      {!isConnected && (
        <div className="bg-[var(--warning-light)] border border-[var(--warning-light)] rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <div className="p-2 bg-[var(--warning-light)] text-warning rounded-xl shrink-0 mt-0.5">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-warning">Library Database Setup In Progress</h3>
            <p className="text-xs text-warning mt-1 leading-relaxed">
              The MongoDB connection for the Library catalog (<code className="px-1.5 py-0.5 bg-[var(--warning-light)] rounded font-mono text-[11px]">LIBRARY_MONGO_URI</code>) is being configured. Once your administrator connects the database, your complete library collection will load automatically here.
            </p>
          </div>
        </div>
      )}

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-[var(--primary-light)] text-primary rounded-xl shrink-0">
            <BookMarked size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Total Titles</p>
            <p className="text-xl sm:text-2xl font-black text-main mt-0.5">
              {loading ? '...' : (stats.totalTitles || totalBooks).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-2xl border border-border shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-[var(--success-light)] text-success rounded-xl shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Available Copies</p>
            <p className="text-xl sm:text-2xl font-black text-main mt-0.5">
              {loading ? '...' : (stats.availableCopies || 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-2xl border border-border shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-[var(--primary-light)] text-primary rounded-xl shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Total Physical Copies</p>
            <p className="text-xl sm:text-2xl font-black text-main mt-0.5">
              {loading ? '...' : (stats.totalCopies || 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-2xl border border-border shadow-xs flex items-center gap-3.5">
          <div className="p-3 bg-[var(--warning-light)] text-warning rounded-xl shrink-0">
            <Bookmark size={22} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Categories</p>
            <p className="text-xl sm:text-2xl font-black text-main mt-0.5">
              {loading ? '...' : (stats.categoriesCount || categories.length || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-surface p-4 rounded-2xl border border-border shadow-xs space-y-3.5">
        {/* Category Pills (horizontal scrollable) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-background text-sub border border-border hover:bg-background'
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
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-background text-sub border border-border hover:bg-background'
              }`}
            >
              <span>{cat.name}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedCategory === cat.name ? 'bg-primary text-primary' : 'bg-background text-sub'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Filter Dropdowns & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Shelf Filter */}
            {shelves.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-sub">
                <MapPin size={14} className="text-muted-text" />
                <select
                  value={selectedShelf}
                  onChange={(e) => setSelectedShelf(e.target.value)}
                  className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-sub focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Shelves / Stacks</option>
                  {shelves.map((sh) => (
                    <option key={sh} value={sh}>{sh}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Availability Filter */}
            <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setAvailabilityFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  availabilityFilter === 'all'
                    ? 'bg-surface text-main shadow-xs'
                    : 'text-muted-text hover:text-main'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setAvailabilityFilter('available')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  availabilityFilter === 'available'
                    ? 'bg-surface text-success shadow-xs'
                    : 'text-muted-text hover:text-main'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                In Stock
              </button>
              <button
                onClick={() => setAvailabilityFilter('issued')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  availabilityFilter === 'issued'
                    ? 'bg-surface text-danger shadow-xs'
                    : 'text-muted-text hover:text-main'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-danger"></span>
                Out of Stock
              </button>
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-sub">
              <ArrowUpDown size={14} className="text-muted-text" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-sub focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="text-xs text-primary hover:text-primary font-semibold px-2 py-1 rounded hover:bg-[var(--primary-light)] transition-colors"
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
            <div key={i} className="bg-surface p-5 rounded-2xl border border-border shadow-xs space-y-4">
              <div className="flex justify-between items-start">
                <SkeletonBox className="h-6 w-24 rounded-lg" />
                <SkeletonBox className="h-6 w-28 rounded-lg" />
              </div>
              <SkeletonBox className="h-6 w-3/4 rounded-md" />
              <SkeletonBox className="h-4 w-1/2 rounded-md" />
              <div className="pt-3 border-t border-border space-y-2">
                <SkeletonBox className="h-4 w-full rounded" />
                <SkeletonBox className="h-8 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="bg-surface p-12 rounded-2xl border border-border shadow-xs text-center space-y-3">
          <div className="p-4 bg-background text-muted-text rounded-2xl w-fit mx-auto">
            <BookOpen size={36} />
          </div>
          <h3 className="text-base font-bold text-main">No Books Found</h3>
          <p className="text-xs text-muted-text max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all' || availabilityFilter !== 'all'
              ? 'No books match the specified search or filter criteria. Try clearing some filters.'
              : 'There are currently no books cataloged in the library database.'}
          </p>
          {(searchQuery || selectedCategory !== 'all' || availabilityFilter !== 'all' || selectedShelf !== 'all') && (
            <button
              onClick={resetFilters}
              className="mt-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer shadow-xs"
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
                className="bg-surface rounded-2xl border border-border shadow-xs hover:shadow-md hover:border-[var(--primary-light)] transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3.5">
                  {/* Category & Shelf Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${catColor.bg} ${catColor.text} ${catColor.border}`}>
                      {book.category || 'General'}
                    </span>

                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-background text-sub">
                      <MapPin size={11} className="text-muted-text" />
                      {book.shelf || 'Central Stack'}
                    </span>
                  </div>

                  {/* Title & Author */}
                  <div>
                    <h2
                      onClick={() => setSelectedBook(book)}
                      className="font-bold text-main text-base leading-snug line-clamp-2 hover:text-primary transition-colors cursor-pointer"
                      title={book.title}
                    >
                      {book.title}
                    </h2>
                    <p className="text-xs text-muted-text font-medium mt-1">
                      by <span className="text-sub font-semibold">{book.author}</span>
                    </p>
                  </div>

                  {/* Metadata Chips: Publisher, Edition, Accession */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-text pt-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building size={12} className="text-muted-text shrink-0" />
                      <span className="truncate" title={book.publisher || 'Institutional Press'}>
                        {book.publisher || 'Institutional Press'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <Bookmark size={12} className="text-muted-text shrink-0" />
                      <span className="truncate" title={book.edition || 'Standard'}>
                        {book.edition || 'Standard Edition'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <Hash size={12} className="text-muted-text shrink-0" />
                      <span className="truncate font-mono" title={`Accession: ${book.accession}`}>
                        Acc: {book.accession}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <Barcode size={12} className="text-muted-text shrink-0" />
                      <span className="truncate font-mono" title={`Barcode: ${book.barcode}`}>
                        {book.barcode}
                      </span>
                    </div>
                  </div>

                  {/* Stock Availability Indicator */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-text font-medium">Availability</span>
                      <span className={`font-bold flex items-center gap-1.5 ${isAvailable ? 'text-success' : 'text-danger'}`}>
                        <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-success' : 'bg-danger'}`}></span>
                        {isAvailable ? `${book.available} of ${book.total} Available` : 'Out of Stock'}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-background h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          percentage > 50 ? 'bg-success' : percentage > 20 ? 'bg-warning' : 'bg-danger'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Footer Button */}
                <div className="px-5 py-3 bg-[var(--background)]/70 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-text font-mono">
                    {book.isbn ? `ISBN: ${book.isbn}` : `Code: ${book.category_code || 'GEN'}`}
                  </span>
                  <button
                    onClick={() => setSelectedBook(book)}
                    className="text-xs font-bold text-primary hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
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
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-xs flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-muted-text">
            Showing Page <span className="font-bold text-main">{currentPage}</span> of{' '}
            <span className="font-bold text-main">{totalPages}</span> ({totalBooks} books)
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-sub hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
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
                      ? 'bg-primary text-white shadow-xs'
                      : 'border border-border text-sub hover:bg-background'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-sub hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Book Detail & Copies Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--sidebar)]/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-border flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getCategoryColor(selectedBook.category).bg} ${getCategoryColor(selectedBook.category).text} ${getCategoryColor(selectedBook.category).border}`}>
                    {selectedBook.category || 'General'}
                  </span>
                  <span className="text-xs text-muted-text font-mono">
                    Acc: {selectedBook.accession}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-main leading-snug">
                  {selectedBook.title}
                </h3>
                <p className="text-xs text-muted-text font-medium">
                  Author: <span className="text-main font-bold">{selectedBook.author}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedBook(null)}
                className="p-2 text-muted-text hover:text-sub hover:bg-background rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              {/* Metadata Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-background p-4 rounded-2xl border border-border text-xs">
                <div>
                  <span className="text-muted-text block text-[11px] font-medium">Shelf / Stack</span>
                  <span className="font-bold text-main flex items-center gap-1 mt-0.5">
                    <MapPin size={12} className="text-primary" />
                    {selectedBook.shelf || 'Central Stack'}
                  </span>
                </div>

                <div>
                  <span className="text-muted-text block text-[11px] font-medium">Publisher</span>
                  <span className="font-bold text-main mt-0.5 block truncate" title={selectedBook.publisher}>
                    {selectedBook.publisher || 'Institutional Press'}
                  </span>
                </div>

                <div>
                  <span className="text-muted-text block text-[11px] font-medium">Edition</span>
                  <span className="font-bold text-main mt-0.5 block">
                    {selectedBook.edition || 'Standard Edition'}
                  </span>
                </div>

                <div>
                  <span className="text-muted-text block text-[11px] font-medium">ISBN</span>
                  <span className="font-bold text-main font-mono mt-0.5 block">
                    {selectedBook.isbn || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-muted-text block text-[11px] font-medium">Master Barcode</span>
                  <span className="font-bold text-main font-mono mt-0.5 block">
                    {selectedBook.barcode || 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-muted-text block text-[11px] font-medium">Availability</span>
                  <span className={`font-bold mt-0.5 block ${selectedBook.available > 0 ? 'text-success' : 'text-danger'}`}>
                    {selectedBook.available} of {selectedBook.total} Available
                  </span>
                </div>
              </div>

              {/* Sequential Copies Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-main flex items-center gap-2">
                    <Layers size={16} className="text-primary" />
                    Copy-by-Copy Status Details
                  </h4>
                  <span className="text-xs text-muted-text font-medium">
                    {selectedBook.copies_detail?.length || selectedBook.total || 0} Total Copies
                  </span>
                </div>

                {Array.isArray(selectedBook.copies_detail) && selectedBook.copies_detail.length > 0 ? (
                  <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-background text-muted-text font-bold border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3">Copy #</th>
                          <th className="py-2.5 px-3">Serial No</th>
                          <th className="py-2.5 px-3">Accession / Barcode</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedBook.copies_detail.map((copy, idx) => {
                          const isCopyAvailable = (copy.status || 'Available').toLowerCase() === 'available';
                          return (
                            <tr key={idx} className="hover:bg-[var(--background)]/60 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-main">
                                #{copy.copy_number || idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-sub">
                                {copy.serial_no || `SN-${idx + 1}`}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-sub">
                                <div>{copy.accession || selectedBook.accession}</div>
                                {copy.barcode && (
                                  <div className="text-[10px] text-muted-text">{copy.barcode}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  isCopyAvailable
                                    ? 'bg-[var(--success-light)] text-success border border-[var(--success-light)]'
                                    : 'bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isCopyAvailable ? 'bg-success' : 'bg-warning'}`}></span>
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
                  <div className="p-4 bg-background rounded-xl border border-border text-center text-xs text-muted-text">
                    No individual copy barcodes have been registered for this title yet.
                    {selectedBook.available > 0 ? (
                      <span className="text-success font-bold block mt-1">
                        {selectedBook.available} copies are registered in the main stack.
                      </span>
                    ) : (
                      <span className="text-danger font-bold block mt-1">
                        All copies currently checked out.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-background border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-text flex items-center gap-1.5">
                <HelpCircle size={14} className="text-muted-text" />
                Visit the central circulation desk to borrow physical copies.
              </span>
              <button
                onClick={() => setSelectedBook(null)}
                className="px-4 py-2 bg-sidebar text-white rounded-xl text-xs font-bold hover:bg-sidebar transition-colors cursor-pointer"
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


const mongoose = require('mongoose');
const Book = require('../models/Book');
const { getLibraryConnection } = require('../config/mongoConfig');

/**
 * Check if Library connection is established and healthy
 */
const isConnectionReady = () => {
  const conn = getLibraryConnection();
  // If conn exists and readyState is 1 (connected) or 2 (connecting)
  return conn && (conn.readyState === 1 || conn.readyState === 2);
};

/**
 * GET /api/library/books
 * List books with search, filters, pagination, and summary statistics
 */
exports.getBooks = async (req, res) => {
  try {
    const conn = getLibraryConnection();
    if (!conn) {
      return res.json({
        success: true,
        isConnected: false,
        message: 'Library database connection is not configured in .env (LIBRARY_MONGO_URI)',
        data: {
          books: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 12,
            totalPages: 0
          },
          stats: {
            totalTitles: 0,
            totalCopies: 0,
            availableCopies: 0,
            categoriesCount: 0
          }
        }
      });
    }

    const BookModel = Book.getBookModel();
    if (!BookModel) {
      return res.json({
        success: true,
        isConnected: false,
        message: 'Book model is not initialized',
        data: {
          books: [],
          pagination: { total: 0, page: 1, limit: 12, totalPages: 0 },
          stats: { totalTitles: 0, totalCopies: 0, availableCopies: 0, categoriesCount: 0 }
        }
      });
    }

    const {
      search = '',
      category = '',
      shelf = '',
      availability = 'all', // 'all', 'available', 'issued'
      sort = 'title_asc',
      page = 1,
      limit = 12
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const query = {};

    if (search && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      query.$or = [
        { title: searchRegex },
        { author: searchRegex },
        { isbn: searchRegex },
        { accession: searchRegex },
        { barcode: searchRegex },
        { publisher: searchRegex },
        { category: searchRegex },
        { shelf: searchRegex }
      ];
    }

    if (category && category !== 'all' && category.trim() !== '') {
      query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
    }

    if (shelf && shelf !== 'all' && shelf.trim() !== '') {
      query.shelf = { $regex: new RegExp(`^${shelf.trim()}$`, 'i') };
    }

    if (availability === 'available') {
      query.available = { $gt: 0 };
    } else if (availability === 'issued') {
      query.available = { $lte: 0 };
    }

    // Sort mapping
    let sortObj = { title: 1 };
    switch (sort) {
      case 'title_desc':
        sortObj = { title: -1 };
        break;
      case 'author_asc':
        sortObj = { author: 1 };
        break;
      case 'author_desc':
        sortObj = { author: -1 };
        break;
      case 'available_desc':
        sortObj = { available: -1, title: 1 };
        break;
      case 'newest':
        sortObj = { created_at: -1, _id: -1 };
        break;
      case 'oldest':
        sortObj = { created_at: 1, _id: 1 };
        break;
      default:
        sortObj = { title: 1 };
    }

    // Execute queries
    const [books, total, statsAgg] = await Promise.all([
      BookModel.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BookModel.countDocuments(query),
      BookModel.aggregate([
        {
          $group: {
            _id: null,
            totalTitles: { $sum: 1 },
            totalCopies: { $sum: { $ifNull: ['$total', 0] } },
            availableCopies: { $sum: { $ifNull: ['$available', 0] } },
            categories: { $addToSet: '$category' }
          }
        }
      ]).catch(() => [])
    ]);

    const statsData = (statsAgg && statsAgg[0]) ? statsAgg[0] : {
      totalTitles: total,
      totalCopies: 0,
      availableCopies: 0,
      categories: []
    };

    res.json({
      success: true,
      isConnected: true,
      data: {
        books,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        },
        stats: {
          totalTitles: statsData.totalTitles || total,
          totalCopies: statsData.totalCopies || 0,
          availableCopies: statsData.availableCopies || 0,
          categoriesCount: (statsData.categories || []).filter(Boolean).length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching library books:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve books from library',
      error: error.message
    });
  }
};

/**
 * GET /api/library/books/:id
 * Get single book details with copies breakdown
 */
exports.getBookById = async (req, res) => {
  try {
    const conn = getLibraryConnection();
    if (!conn) {
      return res.status(503).json({
        success: false,
        message: 'Library database connection is not configured in .env'
      });
    }

    const BookModel = Book.getBookModel();
    if (!BookModel) {
      return res.status(503).json({
        success: false,
        message: 'Book model unavailable'
      });
    }

    const { id } = req.params;
    let book = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      book = await BookModel.findById(id).lean();
    }

    if (!book) {
      book = await BookModel.findOne({
        $or: [{ accession: id }, { barcode: id }]
      }).lean();
    }

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    res.json({
      success: true,
      data: book
    });
  } catch (error) {
    console.error('Error fetching book detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve book details',
      error: error.message
    });
  }
};

/**
 * GET /api/library/categories
 * List distinct categories with book count
 */
exports.getCategories = async (req, res) => {
  try {
    const conn = getLibraryConnection();
    if (!conn) {
      return res.json({
        success: true,
        data: []
      });
    }

    const BookModel = Book.getBookModel();
    if (!BookModel) {
      return res.json({
        success: true,
        data: []
      });
    }

    const categories = await BookModel.aggregate([
      { $match: { category: { $ne: null, $nin: ['', null] } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, name: '$_id', count: 1 } }
    ]);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching library categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories',
      error: error.message
    });
  }
};

/**
 * GET /api/library/shelves
 * List distinct shelves
 */
exports.getShelves = async (req, res) => {
  try {
    const conn = getLibraryConnection();
    if (!conn) {
      return res.json({
        success: true,
        data: []
      });
    }

    const BookModel = Book.getBookModel();
    if (!BookModel) {
      return res.json({
        success: true,
        data: []
      });
    }

    const shelves = await BookModel.distinct('shelf');

    res.json({
      success: true,
      data: shelves.filter(Boolean).sort()
    });
  } catch (error) {
    console.error('Error fetching library shelves:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve shelves',
      error: error.message
    });
  }
};


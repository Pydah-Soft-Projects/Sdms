const mongoose = require('mongoose');
const { getLibraryConnection } = require('../config/mongoConfig');

const bookSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true, 
      trim: true 
    },
    author: { 
      type: String, 
      required: true, 
      trim: true 
    },
    isbn: { 
      type: String, 
      trim: true, 
      default: '' 
    },
    category: { 
      type: String, 
      default: 'General' 
    },
    accession: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true 
    },
    barcode: { 
      type: String, 
      required: true, 
      trim: true 
    },
    shelf: { 
      type: String, 
      default: 'Central Stack' 
    },
    total: { 
      type: Number, 
      default: 5 
    },
    available: { 
      type: Number, 
      default: 5 
    },
    publisher: { 
      type: String, 
      default: 'Institutional Press' 
    },
    edition: { 
      type: String, 
      default: 'Standard Edition' 
    },
    category_code: {
      type: String,
      default: 'GEN'
    },
    // Sequential copies with unique serial number and barcode for every copy
    copies_detail: [
      {
        copy_number: { type: Number },
        serial_no: { type: String, trim: true },
        barcode: { type: String, trim: true },
        accession: { type: String, trim: true },
        status: { type: String, default: 'Available' }
      }
    ]
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

bookSchema.set('toJSON', { virtuals: true });
bookSchema.set('toObject', { virtuals: true });

const getBookModel = () => {
  const conn = getLibraryConnection();
  if (conn) {
    if (conn.models && conn.models['Book']) {
      return conn.models['Book'];
    }
    return conn.model('Book', bookSchema, 'books');
  }

  // Fallback to default mongoose connection
  if (mongoose.models && mongoose.models['Book']) {
    return mongoose.models['Book'];
  }
  return mongoose.model('Book', bookSchema, 'books');
};

// Proxy allows using `Book.find()`, `Book.countDocuments()`, etc. directly as well as `Book.getBookModel()`
const BookProxy = new Proxy(function() {}, {
  get(target, prop) {
    if (prop === 'getBookModel' || prop === 'getModel') {
      return getBookModel;
    }
    if (prop === 'schema' || prop === 'bookSchema') {
      return bookSchema;
    }
    const model = getBookModel();
    if (!model) return undefined;
    const val = model[prop];
    return typeof val === 'function' ? val.bind(model) : val;
  },
  apply(target, thisArg, args) {
    const model = getBookModel();
    if (!model) throw new Error('Library Database is not connected');
    return model.apply(thisArg, args);
  },
  construct(target, args) {
    const model = getBookModel();
    if (!model) throw new Error('Library Database is not connected');
    return new model(...args);
  }
});

BookProxy.getBookModel = getBookModel;
BookProxy.getModel = getBookModel;
BookProxy.bookSchema = bookSchema;

module.exports = BookProxy;


const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/libraryController');
const verifyToken = require('../middleware/auth');

// Protected Library Routes
router.get('/books', verifyToken, libraryController.getBooks);
router.get('/books/:id', verifyToken, libraryController.getBookById);
router.get('/categories', verifyToken, libraryController.getCategories);
router.get('/shelves', verifyToken, libraryController.getShelves);

module.exports = router;


const { maintenancePool, masterPool } = require('../config/database');

/**
 * Execute a query targeting maintenance_db.categories, falling back to student_database.complaint_categories
 */
const queryCategories = async (queryWithCategories, queryWithComplaintCategories, params = []) => {
  const pool = maintenancePool || masterPool;
  try {
    return await pool.query(queryWithCategories, params);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_DB_ERROR') {
      return await masterPool.query(queryWithComplaintCategories, params);
    }
    throw err;
  }
};

/**
 * Get all complaint categories (with sub-categories)
 */
const getCategories = async (req, res) => {
  try {
    const [categories] = await queryCategories(
      `SELECT id, name, description, parent_id, is_active, display_order, created_at, updated_at
       FROM categories
       ORDER BY display_order ASC, name ASC`,
      `SELECT id, name, description, parent_id, is_active, display_order, created_at, updated_at
       FROM complaint_categories
       ORDER BY display_order ASC, name ASC`
    );

    // Organize categories into hierarchy
    const mainCategories = categories.filter(cat => !cat.parent_id);
    const subCategories = categories.filter(cat => cat.parent_id);

    const organized = mainCategories.map(category => ({
      ...category,
      sub_categories: subCategories
        .filter(sub => sub.parent_id === category.id)
        .map(sub => ({
          id: sub.id,
          name: sub.name,
          description: sub.description,
          is_active: sub.is_active,
          display_order: sub.display_order,
          created_at: sub.created_at,
          updated_at: sub.updated_at
        }))
    }));

    res.json({
      success: true,
      data: organized
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching complaint categories',
      error: error.message
    });
  }
};

/**
 * Get single category with sub-categories
 */
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const [categories] = await queryCategories(
      `SELECT id, name, description, parent_id, is_active, display_order, created_at, updated_at
       FROM categories
       WHERE id = ? OR parent_id = ?
       ORDER BY display_order ASC, name ASC`,
      `SELECT id, name, description, parent_id, is_active, display_order, created_at, updated_at
       FROM complaint_categories
       WHERE id = ? OR parent_id = ?
       ORDER BY display_order ASC, name ASC`,
      [id, id]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const mainCategory = categories.find(cat => cat.id === parseInt(id));
    const subCategories = categories.filter(cat => cat.parent_id === parseInt(id));

    res.json({
      success: true,
      data: {
        ...mainCategory,
        sub_categories: subCategories
      }
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching complaint category',
      error: error.message
    });
  }
};

/**
 * Create a new category (main or sub-category)
 */
const createCategory = async (req, res) => {
  try {
    const { name, description, parent_id, display_order } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    // If parent_id is provided, verify it exists and is a main category
    if (parent_id) {
      const [parent] = await queryCategories(
        'SELECT id, parent_id FROM categories WHERE id = ?',
        'SELECT id, parent_id FROM complaint_categories WHERE id = ?',
        [parent_id]
      );

      if (parent.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }

      if (parent[0].parent_id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot create nested sub-categories (only 2 levels allowed)'
        });
      }
    }

    const pool = maintenancePool || masterPool;
    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO categories (name, description, parent_id, display_order, is_active, requires_approval, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 0, NOW(), NOW())`,
        [name.trim(), description || null, parent_id || null, display_order || 0]
      );
    } catch (e) {
      [result] = await masterPool.query(
        `INSERT INTO complaint_categories (name, description, parent_id, display_order)
         VALUES (?, ?, ?, ?)`,
        [name.trim(), description || null, parent_id || null, display_order || 0]
      );
    }

    const [newCategory] = await queryCategories(
      'SELECT * FROM categories WHERE id = ?',
      'SELECT * FROM complaint_categories WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategory[0]
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating complaint category',
      error: error.message
    });
  }
};

/**
 * Update a category
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parent_id, is_active, display_order } = req.body;

    const [existing] = await queryCategories(
      'SELECT id, parent_id FROM categories WHERE id = ?',
      'SELECT id, parent_id FROM complaint_categories WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    if (parent_id !== undefined && parent_id !== null) {
      if (parseInt(parent_id) === parseInt(id)) {
        return res.status(400).json({
          success: false,
          message: 'Category cannot be its own parent'
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name.trim());
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (parent_id !== undefined) {
      updateFields.push('parent_id = ?');
      updateValues.push(parent_id);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active ? 1 : 0);
    }
    if (display_order !== undefined) {
      updateFields.push('display_order = ?');
      updateValues.push(display_order);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(id);
    const pool = maintenancePool || masterPool;
    try {
      await pool.query(
        `UPDATE categories SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        updateValues
      );
    } catch {
      await masterPool.query(
        `UPDATE complaint_categories SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    const [updated] = await queryCategories(
      'SELECT * FROM categories WHERE id = ?',
      'SELECT * FROM complaint_categories WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating complaint category',
      error: error.message
    });
  }
};

/**
 * Delete a category
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await queryCategories(
      'SELECT id FROM categories WHERE id = ?',
      'SELECT id FROM complaint_categories WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const [subCategories] = await queryCategories(
      'SELECT id FROM categories WHERE parent_id = ?',
      'SELECT id FROM complaint_categories WHERE parent_id = ?',
      [id]
    );

    if (subCategories.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category that has sub-categories. Please delete or reassign sub-categories first.'
      });
    }

    const pool = maintenancePool || masterPool;
    try {
      await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    } catch {
      await masterPool.query('DELETE FROM complaint_categories WHERE id = ?', [id]);
    }

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting complaint category',
      error: error.message
    });
  }
};

/**
 * Get active categories for student portal (with sub-categories)
 * Fetches directly from maintenance_db.categories
 */
const getActiveCategories = async (req, res) => {
  try {
    const [categories] = await queryCategories(
      `SELECT id, name, description, parent_id, is_active, display_order
       FROM categories
       WHERE is_active = 1
       ORDER BY display_order ASC, name ASC`,
      `SELECT id, name, description, parent_id, is_active, display_order
       FROM complaint_categories
       WHERE is_active = 1
       ORDER BY display_order ASC, name ASC`
    );

    // Organize categories into hierarchy
    const mainCategories = categories.filter(cat => !cat.parent_id);
    const subCategories = categories.filter(cat => cat.parent_id);

    const organized = mainCategories.map(category => {
      const subs = subCategories
        .filter(sub => sub.parent_id === category.id)
        .map(sub => ({
          id: sub.id,
          name: sub.name,
          description: sub.description
        }));

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        has_sub_categories: subs.length > 0,
        sub_categories: subs
      };
    });

    res.json({
      success: true,
      data: organized
    });
  } catch (error) {
    console.error('Error fetching active categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active complaint categories',
      error: error.message
    });
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getActiveCategories
};

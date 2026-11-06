import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderTree,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingAnimation from '../components/LoadingAnimation';

const TaskManagement = () => {
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [editingCategory, setEditingCategory] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: null,
    display_order: 0,
    is_active: true
  });
  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ['complaint-categories'],
    queryFn: async () => {
      const response = await api.get('/complaint-categories');
      return response.data?.data || [];
    }
  });

  // Create category mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/complaint-categories', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Category created successfully');
      setShowAddModal(false);
      setFormData({ name: '', description: '', parent_id: null, display_order: 0, is_active: true });
      queryClient.invalidateQueries(['complaint-categories']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create category');
    }
  });

  // Update category mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/complaint-categories/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Category updated successfully');
      setEditingCategory(null);
      queryClient.invalidateQueries(['complaint-categories']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update category');
    }
  });

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/complaint-categories/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Category deleted successfully');
      queryClient.invalidateQueries(['complaint-categories']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete category');
    }
  });

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = (category) => {
    if (!category.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    updateMutation.mutate({
      id: category.id,
      data: {
        name: category.name,
        description: category.description,
        is_active: category.is_active,
        display_order: category.display_order
      }
    });
  };

  const handleDelete = (category) => {
    if (window.confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(category.id);
    }
  };

  const startEdit = (category) => {
    setEditingCategory({ ...category });
  };

  const cancelEdit = () => {
    setEditingCategory(null);
  };

  const openAddModal = (parentId = null) => {
    setFormData({
      name: '',
      description: '',
      parent_id: parentId,
      display_order: 0,
      is_active: true
    });
    setShowAddModal(true);
  };

  if (isLoading) {
    return <LoadingAnimation />;
  }

  const categories = categoriesData || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-main">Task Management</h1>
          <p className="text-sub mt-1">Manage complaint categories and sub-levels</p>
        </div>
        <button
          onClick={() => openAddModal()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-2"
        >
          <Plus size={20} />
          Add Category
        </button>
      </div>

      {/* Categories Tree */}
      <div className="bg-surface rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-main">Complaint Categories</h2>
          <p className="text-sm text-muted-text mt-1">
            Categories define the main complaint types. Sub-categories provide more specific options.
          </p>
        </div>
        <div className="p-4 space-y-2">
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <FolderTree className="mx-auto text-muted-text" size={48} />
              <p className="mt-4 text-muted-text">No categories found</p>
              <button
                onClick={() => openAddModal()}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
              >
                Create First Category
              </button>
            </div>
          ) : (
            categories.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                expanded={expandedCategories.has(category.id)}
                onToggle={() => toggleCategory(category.id)}
                onAddSub={() => openAddModal(category.id)}
                onEdit={startEdit}
                onDelete={handleDelete}
                editingCategory={editingCategory}
                onUpdate={handleUpdate}
                onCancelEdit={cancelEdit}
                updateLoading={updateMutation.isPending}
                deleteLoading={deleteMutation.isPending}
              />
            ))
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <AddCategoryModal
          formData={formData}
          setFormData={setFormData}
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
    </div>
  );
};

// Category Item Component
const CategoryItem = ({
  category,
  expanded,
  onToggle,
  onAddSub,
  onEdit,
  onDelete,
  editingCategory,
  onUpdate,
  onCancelEdit,
  updateLoading,
  deleteLoading
}) => {
  const [editForm, setEditForm] = React.useState(null);
  const isEditing = editingCategory?.id === category.id;
  const hasSubCategories = category.sub_categories && category.sub_categories.length > 0;

  React.useEffect(() => {
    if (isEditing) {
      setEditForm({ ...editingCategory });
    } else {
      setEditForm(null);
    }
  }, [isEditing, editingCategory]);

  if (isEditing && editForm) {
    return (
      <div className="p-4 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-lg">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Description</label>
            <textarea
              value={editForm.description || ''}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id={`active-${category.id}`}
                checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor={`active-${category.id}`} className="text-sm text-sub">
                Active
              </label>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-sub mb-1">Display Order</label>
              <input
                type="number"
                value={editForm.display_order}
                onChange={(e) => setEditForm({ ...editForm, display_order: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdate(editForm)}
              disabled={updateLoading}
              className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={16} />
              {updateLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onCancelEdit}
              className="px-4 py-2 bg-background text-sub rounded-lg hover:bg-background"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <div className="p-4 flex items-center justify-between hover:bg-background">
        <div className="flex items-center gap-3 flex-1">
          {hasSubCategories && (
            <button onClick={onToggle} className="text-muted-text hover:text-sub">
              {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
          )}
          {!hasSubCategories && <div className="w-5" />}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-main">{category.name}</h3>
              {!category.is_active && (
                <span className="px-2 py-1 text-xs bg-background text-sub rounded">Inactive</span>
              )}
            </div>
            {category.description && (
              <p className="text-sm text-muted-text mt-1">{category.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddSub()}
            className="p-2 text-primary hover:bg-[var(--primary-light)] rounded-lg"
            title="Add Sub-category"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => onEdit(category)}
            className="p-2 text-success hover:bg-[var(--success-light)] rounded-lg"
            title="Edit"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => onDelete(category)}
            disabled={deleteLoading}
            className="p-2 text-danger hover:bg-[var(--danger-light)] rounded-lg disabled:opacity-50"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {expanded && hasSubCategories && (
        <div className="pl-8 pr-4 pb-2 space-y-2 border-t bg-background">
          {category.sub_categories.map((subCategory) => (
            <SubCategoryItem
              key={subCategory.id}
              subCategory={subCategory}
              parentCategory={category}
              onEdit={onEdit}
              onDelete={onDelete}
              editingCategory={editingCategory}
              onUpdate={onUpdate}
              onCancelEdit={onCancelEdit}
              updateLoading={updateLoading}
              deleteLoading={deleteLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Sub-Category Item Component
const SubCategoryItem = ({
  subCategory,
  parentCategory,
  onEdit,
  onDelete,
  editingCategory,
  onUpdate,
  onCancelEdit,
  updateLoading,
  deleteLoading
}) => {
  const [editForm, setEditForm] = React.useState(null);
  const isEditing = editingCategory?.id === subCategory.id;

  React.useEffect(() => {
    if (isEditing) {
      setEditForm({ ...editingCategory });
    } else {
      setEditForm(null);
    }
  }, [isEditing, editingCategory]);

  if (isEditing && editForm) {
    return (
      <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-lg">
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-1">Description</label>
            <textarea
              value={editForm.description || ''}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={2}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id={`active-sub-${subCategory.id}`}
                checked={editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor={`active-sub-${subCategory.id}`} className="text-sm text-sub">
                Active
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdate(editForm)}
              disabled={updateLoading}
              className="px-3 py-1.5 bg-success text-white rounded-lg hover:bg-success disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              <Save size={14} />
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-3 py-1.5 bg-background text-sub rounded-lg hover:bg-background text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-surface border rounded-lg flex items-center justify-between hover:bg-background">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-text">└─</span>
          <h4 className="font-medium text-main">{subCategory.name}</h4>
          {!subCategory.is_active && (
            <span className="px-2 py-0.5 text-xs bg-background text-sub rounded">Inactive</span>
          )}
        </div>
        {subCategory.description && (
          <p className="text-xs text-muted-text mt-1 ml-6">{subCategory.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onEdit(subCategory)}
          className="p-1.5 text-success hover:bg-[var(--success-light)] rounded-lg"
          title="Edit"
        >
          <Edit size={16} />
        </button>
        <button
          onClick={() => onDelete(subCategory)}
          disabled={deleteLoading}
          className="p-1.5 text-danger hover:bg-[var(--danger-light)] rounded-lg disabled:opacity-50"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

// Add Category Modal Component
const AddCategoryModal = ({ formData, setFormData, categories, onClose, onSave, loading }) => {
  const mainCategories = categories.filter(cat => !cat.parent_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg max-w-2xl w-full">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-main">
            {formData.parent_id ? 'Add Sub-category' : 'Add Category'}
          </h2>
          <button onClick={onClose} className="text-muted-text hover:text-sub">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {!formData.parent_id && (
            <div>
              <label className="block text-sm font-medium text-sub mb-2">
                Parent Category (Optional - leave empty for main category)
              </label>
              <select
                value={formData.parent_id || ''}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="">Main Category</option>
                {mainCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}
          {formData.parent_id && (
            <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-lg">
              <p className="text-sm text-sub">
                Adding sub-category under: <strong>{mainCategories.find(c => c.id === formData.parent_id)?.name}</strong>
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-sub mb-2">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Enter category name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sub mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
              placeholder="Enter category description"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="is_active" className="text-sm text-sub">
                Active
              </label>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-sub mb-2">Display Order</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-background text-sub rounded-lg hover:bg-background"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={loading || !formData.name.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskManagement;


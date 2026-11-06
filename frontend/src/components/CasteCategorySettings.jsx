import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Tags,
  X,
  AlertTriangle,
  Users,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import { SkeletonList } from './SkeletonLoader';

/**
 * Compact two-panel manager: pick a category, manage its castes.
 * Also shows castes already present on student records for import.
 * API still uses /caste-categories + nested castes.
 */
export default function CasteCategorySettings({ readOnly = false }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCasteName, setNewCasteName] = useState('');
  const [creatingCaste, setCreatingCaste] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [editingCasteId, setEditingCasteId] = useState(null);
  const [casteDraft, setCasteDraft] = useState('');
  const [savingKey, setSavingKey] = useState(null);
  const [existingStudentCastes, setExistingStudentCastes] = useState([]);
  const [existingSummary, setExistingSummary] = useState({ total: 0, inSettings: 0, missing: 0 });
  const [importingExisting, setImportingExisting] = useState(false);
  const [blockedDeleteModal, setBlockedDeleteModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    students: [],
    totalCount: 0,
    hasMore: false
  });

  const selectedCategory = useMemo(
    () => categories.find((cat) => cat.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const missingExistingCastes = useMemo(
    () => existingStudentCastes.filter((item) => !item.inSettings),
    [existingStudentCastes]
  );

  const openBlockedDeleteModal = (payload = {}) => {
    setBlockedDeleteModal({
      isOpen: true,
      title: payload.title || 'Cannot Delete',
      message: payload.message || 'This item is assigned to students.',
      students: payload.students || [],
      totalCount: payload.totalCount || 0,
      hasMore: Boolean(payload.hasMore)
    });
  };

  const closeBlockedDeleteModal = () => {
    setBlockedDeleteModal({
      isOpen: false,
      title: '',
      message: '',
      students: [],
      totalCount: 0,
      hasMore: false
    });
  };

  const handleDeleteBlockedError = (error, fallbackTitle) => {
    const data = error.response?.data || {};
    if (error.response?.status === 409 && Array.isArray(data.students) && data.students.length > 0) {
      openBlockedDeleteModal({
        title: fallbackTitle,
        message: data.message,
        students: data.students,
        totalCount: data.totalCount || data.students.length,
        hasMore: data.hasMore
      });
      return;
    }
    toast.error(data.message || 'Failed to delete');
  };

  const fetchExistingStudentCastes = async () => {
    try {
      const response = await api.get('/caste-categories/existing-from-students');
      setExistingStudentCastes(response.data.data || []);
      setExistingSummary(response.data.summary || { total: 0, inSettings: 0, missing: 0 });
    } catch (error) {
      console.error('Failed to fetch existing student castes', error);
    }
  };

  const fetchCategories = async ({ silent = false, preferCategoryId = null } = {}) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.get('/caste-categories?includeInactive=true');
      const data = response.data.data || [];
      setCategories(data);

      setSelectedCategoryId((prev) => {
        const preferred = preferCategoryId ?? prev;
        if (preferred && data.some((cat) => cat.id === preferred)) return preferred;
        return data[0]?.id ?? null;
      });

      await fetchExistingStudentCastes();
      return data;
    } catch (error) {
      console.error('Failed to fetch caste categories', error);
      if (!silent) {
        toast.error(error.response?.data?.message || 'Failed to fetch castes');
      }
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleImportExisting = async () => {
    if (readOnly) return;
    if (missingExistingCastes.length === 0) {
      toast.success('All existing student castes are already in Settings');
      return;
    }
    if (
      !window.confirm(
        `Add ${missingExistingCastes.length} categor${missingExistingCastes.length === 1 ? 'y' : 'ies'} from student caste values to Settings?\n` +
          'Each value becomes a Category only. Add nested castes under it afterward.'
      )
    ) {
      return;
    }
    try {
      setImportingExisting(true);
      const response = await api.post('/caste-categories/import-from-students');
      toast.success(response.data.message || 'Imported castes from students');
      const data = response.data.data || [];
      setCategories(data);
      if (data[0]?.id) setSelectedCategoryId(data[0].id);
      await fetchExistingStudentCastes();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import castes');
    } finally {
      setImportingExisting(false);
    }
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Caste name is required');
      return;
    }
    try {
      setCreatingCategory(true);
      const response = await api.post('/caste-categories', { name, isActive: true });
      toast.success('Caste created');
      setNewCategoryName('');
      const createdId = response.data?.data?.id;
      await fetchCategories({ silent: true, preferCategoryId: createdId });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create caste');
    } finally {
      setCreatingCategory(false);
    }
  };

  const startEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryDraft(category.name);
  };

  const saveCategory = async (categoryId) => {
    const name = categoryDraft.trim();
    if (!name) {
      toast.error('Caste name is required');
      return;
    }
    try {
      setSavingKey(`cat-${categoryId}`);
      await api.put(`/caste-categories/${categoryId}`, { name });
      toast.success('Caste updated');
      setEditingCategoryId(null);
      await fetchCategories({ silent: true, preferCategoryId: categoryId });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update caste');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleCategoryActive = async (category) => {
    try {
      setSavingKey(`cat-${category.id}`);
      await api.put(`/caste-categories/${category.id}`, { isActive: !category.isActive });
      toast.success(`Caste ${!category.isActive ? 'activated' : 'deactivated'}`);
      await fetchCategories({ silent: true, preferCategoryId: category.id });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update caste');
    } finally {
      setSavingKey(null);
    }
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete category "${category.name}" and all its castes?`)) return;
    try {
      setSavingKey(`cat-${category.id}`);
      await api.delete(`/caste-categories/${category.id}`);
      toast.success('Caste deleted');
      setEditingCategoryId(null);
      await fetchCategories({ silent: true });
    } catch (error) {
      handleDeleteBlockedError(error, `Cannot delete category "${category.name}"`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateCaste = async (event) => {
    event?.preventDefault?.();
    if (!selectedCategory) return;
    const name = newCasteName.trim();
    if (!name) {
      toast.error('Caste name is required');
      return;
    }
    try {
      setCreatingCaste(true);
      await api.post(`/caste-categories/${selectedCategory.id}/castes`, { name, isActive: true });
      toast.success('Caste created');
      setNewCasteName('');
      await fetchCategories({ silent: true, preferCategoryId: selectedCategory.id });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create caste');
    } finally {
      setCreatingCaste(false);
    }
  };

  const startEditCaste = (caste) => {
    setEditingCasteId(caste.id);
    setCasteDraft(caste.name);
  };

  const saveCaste = async (casteId) => {
    if (!selectedCategory) return;
    const name = casteDraft.trim();
    if (!name) {
      toast.error('Caste name is required');
      return;
    }
    try {
      setSavingKey(`caste-${casteId}`);
      await api.put(`/caste-categories/${selectedCategory.id}/castes/${casteId}`, { name });
      toast.success('Caste updated');
      setEditingCasteId(null);
      await fetchCategories({ silent: true, preferCategoryId: selectedCategory.id });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update caste');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleCasteActive = async (caste) => {
    if (!selectedCategory) return;
    try {
      setSavingKey(`caste-${caste.id}`);
      await api.put(`/caste-categories/${selectedCategory.id}/castes/${caste.id}`, {
        isActive: !caste.isActive
      });
      toast.success(`Caste ${!caste.isActive ? 'activated' : 'deactivated'}`);
      await fetchCategories({ silent: true, preferCategoryId: selectedCategory.id });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update caste');
    } finally {
      setSavingKey(null);
    }
  };

  const deleteCaste = async (caste) => {
    if (!selectedCategory) return;
    if (!window.confirm(`Delete caste "${caste.name}"?`)) return;
    try {
      setSavingKey(`caste-${caste.id}`);
      await api.delete(`/caste-categories/${selectedCategory.id}/castes/${caste.id}`);
      toast.success('Caste deleted');
      setEditingCasteId(null);
      await fetchCategories({ silent: true, preferCategoryId: selectedCategory.id });
    } catch (error) {
      handleDeleteBlockedError(error, `Cannot delete caste "${caste.name}"`);
    } finally {
      setSavingKey(null);
    }
  };

  const totalCastes = categories.reduce((sum, cat) => sum + (cat.castes?.length || 0), 0);
  const selectedCastes = selectedCategory?.castes || [];

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      <div className="border-b border-border px-4 py-3 bg-background flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-main flex items-center gap-2">
            <Tags size={18} className="text-warning" />
            Categories & Castes
          </h2>
            <p className="text-xs text-muted-text mt-0.5">
              Categories (BC-A, OC…) come from student caste values. Add nested castes under each category.
            </p>
        </div>
        <span className="rounded-full bg-[var(--warning-light)] px-2.5 py-1 text-[11px] font-bold text-warning">
          {categories.length} · {totalCastes}
        </span>
      </div>

      {!loading && existingStudentCastes.length > 0 && (
        <div className="border-b border-[var(--warning-light)] bg-[var(--warning-light)] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-warning">
                Categories from student caste values ({existingSummary.total})
              </p>
              <p className="text-[11px] text-warning mt-0.5">
                {existingSummary.inSettings} already in Settings
                {existingSummary.missing > 0
                  ? ` · ${existingSummary.missing} not added yet`
                  : ' · all matched'}
              </p>
            </div>
            {!readOnly && existingSummary.missing > 0 && (
              <button
                type="button"
                onClick={handleImportExisting}
                disabled={importingExisting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-warning px-3 py-1.5 text-xs font-semibold text-white hover:bg-warning disabled:opacity-50"
              >
                <Download size={14} />
                {importingExisting ? 'Adding…' : `Add ${existingSummary.missing} missing`}
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {existingStudentCastes.map((item) => (
              <span
                key={item.name}
                title={`${item.studentCount} student(s)`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  item.inSettings
                    ? 'bg-surface text-success border border-[var(--success-light)]'
                    : 'bg-surface text-warning border border-[var(--warning-light)]'
                }`}
              >
                {item.name}
                <span className="text-[10px] font-normal opacity-70">{item.studentCount}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-4">
          <SkeletonList count={4} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[240px,1fr] min-h-[360px]">
          {/* Castes panel (parent) */}
          <div className="border-b md:border-b-0 md:border-r border-border flex flex-col">
            {!readOnly && (
              <form onSubmit={handleCreateCategory} className="p-3 border-b border-border space-y-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category"
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-warning focus:bg-surface focus:outline-none focus:ring-1 focus:ring-warning"
                />
                <button
                  type="submit"
                  disabled={creatingCategory || !newCategoryName.trim()}
                  className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-warning px-3 py-1.5 text-xs font-semibold text-white hover:bg-warning disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add Category
                </button>
              </form>
            )}

            <div className="flex-1 overflow-y-auto max-h-[280px] md:max-h-[420px] p-2 space-y-1">
              {categories.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm font-medium text-sub">No categories yet</p>
                  <p className="mt-1 text-xs text-muted-text">
                    {readOnly
                      ? 'Ask an admin to add categories in Settings.'
                      : 'Add a category above, then add castes under it.'}
                  </p>
                </div>
              ) : (
                categories.map((category) => {
                  const isSelected = category.id === selectedCategoryId;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setEditingCategoryId(null);
                        setEditingCasteId(null);
                      }}
                      className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                        isSelected
                          ? 'bg-[var(--warning-light)] border border-[var(--warning-light)]'
                          : 'hover:bg-background border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold truncate ${isSelected ? 'text-warning' : 'text-main'}`}>
                          {category.name}
                        </span>
                        <span className="text-[10px] text-muted-text shrink-0">
                          {(category.castes || []).length}
                        </span>
                      </div>
                      <span
                        className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          category.isActive ? 'bg-[var(--success-light)] text-success' : 'bg-background text-muted-text'
                        }`}
                      >
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Castes panel */}
          <div className="flex flex-col min-w-0">
            {!selectedCategory ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-1">
                <p className="text-sm font-medium text-sub">
                  {categories.length === 0 ? 'Start by adding a category' : 'Select a category'}
                </p>
                <p className="text-xs text-muted-text">
                  {categories.length === 0
                    ? 'Then add castes under that category — nothing is preloaded.'
                    : 'Manage castes for the selected category.'}
                </p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingCategoryId === selectedCategory.id && !readOnly ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={categoryDraft}
                          onChange={(e) => setCategoryDraft(e.target.value)}
                          className="rounded-md border border-border px-2 py-1 text-sm focus:border-warning focus:outline-none focus:ring-1 focus:ring-warning"
                        />
                        <button
                          type="button"
                          onClick={() => saveCategory(selectedCategory.id)}
                          disabled={savingKey === `cat-${selectedCategory.id}`}
                          className="rounded-md bg-warning px-2.5 py-1 text-xs font-semibold text-white hover:bg-warning disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategoryId(null)}
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-sub hover:bg-background"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-sm font-semibold text-main">
                          {selectedCategory.name}
                          <span className="ml-2 text-xs font-normal text-muted-text">
                            {selectedCastes.length} caste{selectedCastes.length === 1 ? '' : 's'}
                          </span>
                        </h3>
                      </div>
                    )}
                  </div>

                  {!readOnly && editingCategoryId !== selectedCategory.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditCategory(selectedCategory)}
                        className="p-1.5 text-muted-text hover:text-warning"
                        title="Edit category"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCategoryActive(selectedCategory)}
                        disabled={savingKey === `cat-${selectedCategory.id}`}
                        className="p-1.5 text-muted-text hover:text-sub disabled:opacity-50"
                        title={selectedCategory.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {selectedCategory.isActive ? (
                          <ToggleRight size={15} className="text-success" />
                        ) : (
                          <ToggleLeft size={15} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategory(selectedCategory)}
                        disabled={savingKey === `cat-${selectedCategory.id}`}
                        className="p-1.5 text-muted-text hover:text-danger disabled:opacity-50"
                        title="Delete category"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {!readOnly && (
                  <form onSubmit={handleCreateCaste} className="px-4 py-3 border-b border-border flex gap-2">
                    <input
                      type="text"
                      value={newCasteName}
                      onChange={(e) => setNewCasteName(e.target.value)}
                      placeholder={`Add caste under ${selectedCategory.name}`}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-warning focus:bg-surface focus:outline-none focus:ring-1 focus:ring-warning"
                    />
                    <button
                      type="submit"
                      disabled={creatingCaste || !newCasteName.trim()}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--warning-light)] bg-[var(--warning-light)] px-3 py-1.5 text-xs font-semibold text-warning hover:bg-[var(--warning-light)] disabled:opacity-50"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </form>
                )}

                <div className="flex-1 overflow-y-auto max-h-[280px] md:max-h-[340px]">
                  {selectedCastes.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-text">
                      No castes under this category yet
                    </p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-background sticky top-0">
                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-text">
                          <th className="px-4 py-2">Caste</th>
                          <th className="px-4 py-2">Status</th>
                          {!readOnly && <th className="px-4 py-2 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedCastes.map((caste) => {
                          const isEditing = editingCasteId === caste.id;
                          return (
                            <tr key={caste.id} className="hover:bg-[var(--background)]/80">
                              <td className="px-4 py-2">
                                {isEditing && !readOnly ? (
                                  <input
                                    type="text"
                                    value={casteDraft}
                                    onChange={(e) => setCasteDraft(e.target.value)}
                                    className="w-full max-w-xs rounded-md border border-border px-2 py-1 text-sm focus:border-warning focus:outline-none focus:ring-1 focus:ring-warning"
                                  />
                                ) : (
                                  <span className="font-medium text-main">{caste.name}</span>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    caste.isActive
                                      ? 'bg-[var(--success-light)] text-success'
                                      : 'bg-background text-muted-text'
                                  }`}
                                >
                                  {caste.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              {!readOnly && (
                                <td className="px-4 py-2">
                                  <div className="flex items-center justify-end gap-1">
                                    {isEditing ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => saveCaste(caste.id)}
                                          disabled={savingKey === `caste-${caste.id}`}
                                          className="rounded-md bg-warning px-2 py-1 text-[11px] font-semibold text-white hover:bg-warning disabled:opacity-50"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingCasteId(null)}
                                          className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-sub hover:bg-background"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => startEditCaste(caste)}
                                          className="p-1 text-muted-text hover:text-warning"
                                          title="Edit caste"
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleCasteActive(caste)}
                                          disabled={savingKey === `caste-${caste.id}`}
                                          className="p-1 text-muted-text hover:text-sub disabled:opacity-50"
                                          title={caste.isActive ? 'Deactivate' : 'Activate'}
                                        >
                                          {caste.isActive ? (
                                            <ToggleRight size={14} className="text-success" />
                                          ) : (
                                            <ToggleLeft size={14} />
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deleteCaste(caste)}
                                          disabled={savingKey === `caste-${caste.id}`}
                                          className="p-1 text-muted-text hover:text-danger disabled:opacity-50"
                                          title="Delete caste"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {blockedDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeBlockedDeleteModal} />
          <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--danger-light)]">
                  <AlertTriangle size={18} className="text-danger" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-main truncate">
                    {blockedDeleteModal.title}
                  </h3>
                  <p className="text-sm text-sub mt-0.5">{blockedDeleteModal.message}</p>
                  <p className="text-xs text-warning mt-1 inline-flex items-center gap-1">
                    <Users size={12} />
                    {blockedDeleteModal.totalCount} student
                    {blockedDeleteModal.totalCount === 1 ? '' : 's'} using this
                    {blockedDeleteModal.hasMore
                      ? ` (showing first ${blockedDeleteModal.students.length})`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeBlockedDeleteModal}
                className="p-2 text-muted-text hover:text-sub rounded-lg hover:bg-background"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-auto flex-1 px-4 py-3">
              <table className="min-w-full text-sm">
                <thead className="bg-background sticky top-0">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-text">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Admission No</th>
                    <th className="px-3 py-2">PIN</th>
                    <th className="px-3 py-2">College</th>
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2">Caste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {blockedDeleteModal.students.map((student, index) => (
                    <tr
                      key={`${student.admission_number || student.pin_no || index}`}
                      className="hover:bg-[var(--background)]/80"
                    >
                      <td className="px-3 py-2 font-medium text-main whitespace-nowrap">
                        {student.student_name || '-'}
                      </td>
                      <td className="px-3 py-2 text-sub whitespace-nowrap">
                        {student.admission_number || '-'}
                      </td>
                      <td className="px-3 py-2 text-sub whitespace-nowrap">
                        {student.pin_no || '-'}
                      </td>
                      <td className="px-3 py-2 text-sub whitespace-nowrap">
                        {student.college || '-'}
                      </td>
                      <td className="px-3 py-2 text-sub whitespace-nowrap">
                        {student.course || '-'}
                      </td>
                      <td className="px-3 py-2 text-sub whitespace-nowrap">
                        {student.branch || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full bg-[var(--warning-light)] px-2 py-0.5 text-xs font-semibold text-warning">
                          {student.caste || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border px-4 py-3 flex justify-end">
              <button
                type="button"
                onClick={closeBlockedDeleteModal}
                className="rounded-lg bg-sidebar px-4 py-2 text-sm font-semibold text-white hover:bg-sidebar"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

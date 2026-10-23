
import React, { useState } from 'react';
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
    List,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import '../../styles/admin-pages.css';

const ToggleSwitch = ({ checked, onChange, label }) => (
    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`
                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 
                focus:ring-blue-600 focus:ring-offset-2
                ${checked ? 'bg-green-500' : 'bg-gray-300'}
            `}
        >
            <span
                aria-hidden="true"
                className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                    transition duration-200 ease-in-out
                    ${checked ? 'translate-x-5' : 'translate-x-0'}
                `}
            />
        </button>
        {label && (
            <span className={`text-sm font-medium ${checked ? 'text-gray-900' : 'text-gray-500'}`}>
                {label}
            </span>
        )}
    </div>
);

const TicketConfiguration = () => {
    const [expandedHeaders, setExpandedHeaders] = useState(new Set());
    const [editingHeader, setEditingHeader] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        parent_id: null,
        display_order: 0,
        is_active: true
    });
    const queryClient = useQueryClient();

    // Data Fetching
    const { data: categoriesData, isLoading } = useQuery({
        queryKey: ['complaint-categories'],
        queryFn: async () => {
            const response = await api.get('/complaint-categories');
            return response.data?.data || [];
        }
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (data) => {
            const response = await api.post('/complaint-categories', data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Successfully created');
            setShowAddModal(false);
            setFormData({ name: '', description: '', parent_id: null, display_order: 0, is_active: true });
            queryClient.invalidateQueries(['complaint-categories']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to create')
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            const response = await api.put(`/complaint-categories/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Successfully updated');
            setEditingHeader(null);
            queryClient.invalidateQueries(['complaint-categories']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to update')
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const response = await api.delete(`/ complaint - categories / ${id} `);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Successfully deleted');
            queryClient.invalidateQueries(['complaint-categories']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete')
    });

    // Handlers
    const toggleHeader = (id) => {
        setExpandedHeaders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            return newSet;
        });
    };

    const handleCreate = () => {
        if (!formData.name.trim()) return toast.error('Name is required');
        createMutation.mutate(formData);
    };

    const handleDelete = (header) => {
        if (window.confirm(`Delete "${header.name}" ? `)) deleteMutation.mutate(header.id);
    };

    const openAddModal = (parentId = null) => {
        setFormData({ name: '', description: '', parent_id: parentId, display_order: 0, is_active: true });
        setShowAddModal(true);
    };

    if (isLoading) {
        return (
            <div className="admin-page-container animate-pulse">
                <div className="card-base p-0 border rounded-lg bg-white">
                    <div className="card-header p-4 border-b">
                        <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-64"></div>
                    </div>
                    <div className="card-body p-4 space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex flex-col gap-2">
                                <div className="h-14 bg-gray-50 rounded border flex items-center px-4 justify-between">
                                    <div className="flex gap-4 items-center w-full">
                                        <div className="w-5 h-5 bg-gray-200 rounded"></div>
                                        <div className="h-5 bg-gray-200 rounded w-48"></div>
                                        <div className="h-6 w-12 bg-gray-200 rounded-full"></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                                {i === 2 && (
                                    <div className="ml-8 space-y-2 border-l pl-4">
                                        <div className="h-10 bg-gray-50 rounded border w-3/4"></div>
                                        <div className="h-10 bg-gray-50 rounded border w-3/4"></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const headers = categoriesData || [];

    return (
        <div className="admin-page-container">
            <div className="card-base" style={{ padding: 0 }}>
                <div className="card-header flex justify-between items-center gap-4 flex-wrap">
                    <div>
                        <h3 className="card-title">Complaints Hierarchy</h3>
                        <p className="card-subtitle">Define categories and their sub-items</p>
                    </div>
                    <button onClick={() => openAddModal()} className="btn-primary py-2 px-3 text-xs shrink-0">
                        <Plus size={16} /> <span>Create Category</span>
                    </button>
                </div>
                <div className="card-body">
                    {headers.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <List size={32} />
                            </div>
                            <p className="empty-state-text">No headers configured yet</p>
                            <button onClick={() => openAddModal()} className="empty-state-action">
                                Create your first header
                            </button>
                        </div>
                    ) : (
                        headers.map((header) => (
                            <HeaderItem
                                key={header.id}
                                header={header}
                                expanded={expandedHeaders.has(header.id)}
                                onToggle={() => toggleHeader(header.id)}
                                onAddSub={() => openAddModal(header.id)}
                                isEditing={editingHeader?.id === header.id}
                                editingHeader={editingHeader}
                                setEditing={setEditingHeader}
                                onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                                onDelete={() => handleDelete(header)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in modal-md">
                        <div className="modal-header">
                            <h2 className="modal-title">{formData.parent_id ? 'Add Sub-Header' : 'Add Header'}</h2>
                            <button onClick={() => setShowAddModal(false)} className="modal-close-btn"><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            {formData.parent_id && (
                                <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                                    Adding under: <strong>{headers.find(h => h.id === formData.parent_id)?.name}</strong>
                                </div>
                            )}
                            <div>
                                <label className="form-label">Name</label>
                                <input
                                    className="form-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Enter name"
                                />
                            </div>
                            <div>
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-textarea"
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <ToggleSwitch
                                    checked={formData.is_active}
                                    onChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    label="Active"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
                            <button onClick={handleCreate} disabled={createMutation.isPending} className="btn-primary">
                                {createMutation.isPending ? 'Saving...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const HeaderItem = ({ header, expanded, onToggle, onAddSub, isEditing, editingHeader, setEditing, onUpdate, onDelete }) => {
    const [editForm, setEditForm] = useState({ ...header });
    const hasSub = header.sub_categories?.length > 0;

    // Reset edit form when entering edit mode
    React.useEffect(() => {
        if (isEditing) {
            setEditForm({ ...header });
        }
    }, [isEditing, header]);

    // Handle sub-category update
    const handleSubUpdate = (subId, data) => {
        onUpdate(subId, data);
        setEditing(null);
    };

    if (isEditing) {
        return (
            <div className="admin-edit-item">
                <div className="space-y-3">
                    <input
                        className="form-input"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        autoFocus
                    />
                    <div className="edit-actions">
                        <button onClick={() => setEditing(null)} className="btn-secondary py-1 px-3 text-sm">Cancel</button>
                        <button onClick={() => onUpdate(header.id, editForm)} className="btn-primary py-1 px-3 text-sm">Save</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-list-item mb-2 p-0 overflow-hidden">
            <div className="p-4 flex items-center justify-between hover:bg-gray-50/50">
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={hasSub ? onToggle : undefined}>
                    {hasSub ? (expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />) : <div className="w-5" />}

                    <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-900">{header.name}</span>
                        <ToggleSwitch
                            checked={header.is_active}
                            onChange={(checked) => onUpdate(header.id, { is_active: checked })}
                            label={header.is_active ? 'Active' : 'Inactive'}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onAddSub} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Plus size={18} /></button>
                    <button onClick={() => setEditing(header)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"><Edit size={18} /></button>
                    <button onClick={onDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                </div>
            </div>
            {expanded && hasSub && (
                <div className="sub-list-container">
                    {header.sub_categories.map(sub => {
                        const isSubEditing = editingHeader?.id === sub.id;

                        if (isSubEditing) {
                            return (
                                <SubHeaderEdit
                                    key={sub.id}
                                    sub={sub}
                                    onCancel={() => setEditing(null)}
                                    onSave={(data) => handleSubUpdate(sub.id, data)}
                                />
                            );
                        }

                        return (
                            <div key={sub.id} className="sub-list-item">
                                <div className="flex items-center gap-4 flex-1">
                                    <span className={`sub - item - text ${!sub.is_active ? 'text-gray-400' : ''} `}>{sub.name}</span>
                                    <ToggleSwitch
                                        checked={sub.is_active}
                                        onChange={(checked) => onUpdate(sub.id, { is_active: checked })}
                                    />
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => setEditing(sub)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit size={16} /></button>
                                    <button onClick={() => onDelete(sub)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const SubHeaderEdit = ({ sub, onCancel, onSave }) => {
    const [name, setName] = useState(sub.name);

    return (
        <div className="sub-list-item bg-blue-50/50">
            <input
                className="form-input py-1 px-2 text-sm h-8"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                onKeyDown={e => {
                    if (e.key === 'Enter') onSave({ name });
                    if (e.key === 'Escape') onCancel();
                }}
            />
            <div className="flex gap-1 ml-2">
                <button onClick={() => onSave({ name })} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><CheckCircle2 size={16} /></button>
                <button onClick={onCancel} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><XCircle size={16} /></button>
            </div>
        </div>
    );
};

export default TicketConfiguration;

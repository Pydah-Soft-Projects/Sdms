import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Shield,
    Plus,
    Edit,
    Trash2,
    X,
    Check,
    Search,
    Lock
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import {
    TICKET_MODULES,
    TICKET_MODULE_LABELS,
    createDefaultTicketPermissions
} from '../../constants/ticketRbac';
import '../../styles/admin-pages.css';

const SubAdminCreation = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone_number: '',
        password: '',
        permissions: {}
    });

    const queryClient = useQueryClient();

    // Fetch sub-admins
    const { data: usersData, isLoading } = useQuery({
        queryKey: ['rbac-users'],
        queryFn: async () => {
            const response = await api.get('/rbac/users');
            return response.data?.data || [];
        }
    });

    // Mutations
    const mutationConfig = {
        onSuccess: () => {
            toast.success(editingAdmin ? 'Sub-Admin updated' : 'Sub-Admin created');
            closeModal();
            queryClient.invalidateQueries(['rbac-users']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Operation failed')
    };

    const createMutation = useMutation({
        mutationFn: (data) => api.post('/rbac/users', { ...data, role: 'sub_admin' }),
        ...mutationConfig
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => api.put(`/rbac/users/${id}`, data),
        ...mutationConfig
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/rbac/users/${id}`),
        onSuccess: () => {
            toast.success('Sub-Admin removed');
            queryClient.invalidateQueries(['rbac-users']);
        },
        onError: (err) => toast.error('Failed to delete')
    });

    // Filtering
    const users = usersData || [];
    const subAdmins = users.filter(user =>
        user.role === 'sub_admin' &&
        (user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.includes(searchTerm.toLowerCase()))
    );

    // Handlers
    const openModal = (admin = null) => {
        if (admin) {
            setEditingAdmin(admin);
            setFormData({
                name: admin.name,
                email: admin.email,
                phone_number: admin.phone_number || '',
                password: '',
                permissions: admin.permissions || createDefaultTicketPermissions('sub_admin')
            });
        } else {
            setEditingAdmin(null);
            setFormData({
                name: '',
                email: '',
                phone_number: '',
                password: '',
                permissions: createDefaultTicketPermissions('sub_admin') // All false by default for sub_admin
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingAdmin(null);
    };

    const togglePermission = (module, action) => {
        setFormData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [module]: {
                    ...prev.permissions?.[module],
                    [action]: !prev.permissions?.[module]?.[action]
                }
            }
        }));
    };

    const handleSubmit = () => {
        if (!formData.name || !formData.email) return toast.error('Name and Email required');

        if (editingAdmin) {
            const updateData = { ...formData };
            if (!updateData.password) delete updateData.password;
            updateMutation.mutate({ id: editingAdmin.id, data: updateData });
        } else {
            if (!formData.password) return toast.error('Password required');
            createMutation.mutate(formData);
        }
    };

    if (isLoading) {
        return (
            <div className="admin-page-container animate-pulse">
                <div className="card-base p-0">
                    <div className="p-4 border-b">
                        <div className="h-10 bg-gray-200 rounded w-64"></div>
                    </div>
                    <div className="p-6 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="border rounded-lg p-6 flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                                        <div>
                                            <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
                                            <div className="h-4 bg-gray-200 rounded w-64"></div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="h-9 w-24 bg-gray-200 rounded"></div>
                                        <div className="h-9 w-10 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                                <div className="border-t pt-4 mt-2">
                                    <div className="h-4 bg-gray-200 rounded w-32 mb-3"></div>
                                    <div className="flex gap-2">
                                        <div className="h-6 w-24 bg-gray-200 rounded"></div>
                                        <div className="h-6 w-24 bg-gray-200 rounded"></div>
                                        <div className="h-6 w-24 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page-container">
            <div className="card-base" style={{ padding: 0 }}>
                <div className="admin-filters-section flex justify-between items-center gap-4 flex-wrap">
                    <div className="input-group-wrapper" style={{ maxWidth: '400px', flex: 1 }}>
                        <Search className="input-icon" size={18} />
                        <input
                            className="input-with-icon"
                            placeholder="Search sub-admins..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={() => openModal()} className="btn-primary shrink-0">
                        <Shield size={18} /> <span>Create Sub-Admin</span>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {subAdmins.length > 0 ? (
                        subAdmins.map(admin => (
                            <div key={admin.id} className="admin-list-item">
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-gray-200">
                                            {admin.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">{admin.name}</h3>
                                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                                <span>{admin.email}</span>
                                                {admin.phone_number && (
                                                    <span className="flex items-center gap-1 before:content-['•'] before:mr-2">
                                                        {admin.phone_number}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal(admin)} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
                                            <Edit size={14} /> Edit Access
                                        </button>
                                        <button onClick={() => { if (window.confirm('Remove admin access?')) deleteMutation.mutate(admin.id); }} className="p-2 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Permissions Preview */}
                                <div className="mt-6 pt-4 border-t border-gray-100">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Active Permissions</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(admin.permissions || {}).map(([module, perms]) => {
                                            const activeCount = Object.values(perms).filter(Boolean).length;
                                            if (activeCount === 0) return null;
                                            return (
                                                <span key={module} className="px-3 py-1 bg-gray-50 text-gray-700 text-xs rounded-lg font-medium border border-gray-200">
                                                    {TICKET_MODULE_LABELS[module] || module}: <span className="text-blue-600">{activeCount} rights</span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            No Sub-Admins found.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in modal-lg">
                        <div className="modal-header">
                            <h2 className="modal-title">{editingAdmin ? 'Edit Administrator' : 'Create Administrator'}</h2>
                            <button onClick={closeModal} className="modal-close-btn"><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div>
                                    <label className="form-label">Full Name</label>
                                    <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">Email Address</label>
                                    <input className="form-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={formData.phone_number} onChange={e => setFormData({ ...formData, phone_number: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">Password {editingAdmin && '(Optional)'}</label>
                                    <input className="form-input" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="font-bold text-gray-900 border-b pb-2">Module Permissions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                    {Object.values(TICKET_MODULES).map((module) => (
                                        <div key={module} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Lock size={16} className="text-gray-400" />
                                                <span className="font-bold text-gray-700">{TICKET_MODULE_LABELS[module] || module}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                {['read', 'write', 'update', 'delete'].map(action => (
                                                    <label key={action} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer border-2 transition-all ${formData.permissions?.[module]?.[action]
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                        : 'border-transparent bg-white hover:bg-gray-100'
                                                        }`}>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={formData.permissions?.[module]?.[action] || false}
                                                            onChange={() => togglePermission(module, action)}
                                                        />
                                                        <span className="text-[10px] font-bold uppercase mb-1">{action}</span>
                                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.permissions?.[module]?.[action] ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                                            }`}>
                                                            {formData.permissions?.[module]?.[action] && <Check size={10} className="text-white" />}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                        <div className="modal-footer">
                            <button onClick={handleSubmit} className="btn-primary w-full md:w-auto">
                                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Administrator'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubAdminCreation;

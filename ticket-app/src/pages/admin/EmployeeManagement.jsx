import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Users,
    UserPlus,
    Trash2,
    Edit,
    Search,
    Phone,
    Mail,
    Filter,
    TrendingUp
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import EmployeeModal from '../../components/admin/EmployeeModal';
import EmployeeHistoryModal from '../../components/admin/EmployeeHistoryModal';
import '../../styles/admin-pages.css';

const EmployeeManagement = () => {
    const [activeRole, setActiveRole] = useState('all'); // all, staff, worker
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [viewingHistoryUser, setViewingHistoryUser] = useState(null);

    const queryClient = useQueryClient();

    // Fetch employees (from ticket_employees table)
    const { data: employeesData, isLoading } = useQuery({
        queryKey: ['ticket-employees'],
        queryFn: async () => {
            const response = await api.get('/employees');
            return response.data?.data || [];
        }
    });

    // Fetch available RBAC users (not yet assigned as employees)
    const { data: availableUsersData } = useQuery({
        queryKey: ['available-rbac-users'],
        queryFn: async () => {
            const response = await api.get('/employees/available-users');
            return response.data?.data || [];
        }
    });

    // Fetch available roles
    const { data: rolesData } = useQuery({
        queryKey: ['ticket-roles'],
        queryFn: async () => {
            const response = await api.get('/roles');
            return response.data?.data || [];
        }
    });

    // Mutations
    const mutationConfig = {
        onSuccess: () => {
            toast.success(editingUser ? 'Employee updated' : 'Employee assigned');
            closeModal();
            queryClient.invalidateQueries(['ticket-employees']);
            queryClient.invalidateQueries(['available-rbac-users']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Operation failed')
    };

    const createMutation = useMutation({
        mutationFn: (data) => api.post('/employees', data),
        ...mutationConfig
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => api.put(`/employees/${id}`, data),
        ...mutationConfig
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/employees/${id}`),
        onSuccess: () => {
            toast.success('Employee removed');
            queryClient.invalidateQueries(['ticket-employees']);
            queryClient.invalidateQueries(['available-rbac-users']);
        },
        onError: (err) => toast.error('Failed to delete employee')
    });

    // Mutation for creating new RBAC user
    const createRbacUserMutation = useMutation({
        mutationFn: (data) => api.post('/rbac/users', data),
        onSuccess: async (response, variables) => {
            const newUserId = response.data?.data?.id;
            if (newUserId) {
                // After creating RBAC user, assign them as employee
                createMutation.mutate({
                    rbac_user_id: newUserId,
                    role: variables.role,
                    custom_role_id: variables.custom_role_id,
                    assigned_categories: variables.assigned_categories || [],
                    assigned_subcategories: variables.assigned_subcategories || []
                });
            } else {
                toast.success('User created successfully');
                closeModal();
                queryClient.invalidateQueries(['available-rbac-users']);
            }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to create user')
    });

    // Filtering
    const employees = employeesData || [];
    const filteredEmployees = employees.filter(employee => {
        let matchesRole = false;
        if (activeRole === 'all') {
            matchesRole = true;
        } else if (activeRole === 'staff') {
            // Include both staff and manager roles in the Managers tab
            matchesRole = employee.role === 'staff' || employee.role === 'manager';
        } else {
            matchesRole = employee.role === activeRole;
        }

        const name = employee.name?.toLowerCase() || '';
        const email = employee.email?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        const matchesSearch = name.includes(search) || email.includes(search);
        return matchesRole && matchesSearch;
    });

    const handleModalSubmit = (type, payload) => {
        if (type === 'assign') {
            if (!payload.rbac_user_id) return toast.error('Please select a user');
            createMutation.mutate({
                rbac_user_id: payload.rbac_user_id,
                role: payload.role,
                custom_role_id: payload.custom_role_id,
                assigned_categories: payload.assigned_categories,
                assigned_subcategories: payload.assigned_subcategories
            });
        } else if (type === 'update') {
            updateMutation.mutate({
                id: payload.id,
                data: {
                    role: payload.role,
                    custom_role_id: payload.custom_role_id,
                    assigned_categories: payload.assigned_categories,
                    assigned_subcategories: payload.assigned_subcategories
                }
            });
        }
    };

    const handleCreateNewUser = (userData) => {
        const isWorker = userData.role === 'worker';

        // Validate required fields
        // Phone is required for workers in backend
        if (!userData.name || (!isWorker && !userData.email) || !userData.username || !userData.password) {
            return toast.error('All fields are required');
        }

        if (isWorker && !userData.phone) {
            return toast.error('Phone number is required for workers');
        }

        if (isWorker) {
            // Workers are standalone, create directly in employee table
            createMutation.mutate(userData);
        } else {
            // Managers need RBAC user first
            createRbacUserMutation.mutate({
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                username: userData.username,
                password: userData.password,
                role: userData.role,
                custom_role_id: userData.custom_role_id,
                assigned_categories: userData.assigned_categories,
                assigned_subcategories: userData.assigned_subcategories
            });
        }
    };

    const openModal = (user = null) => {
        setEditingUser(user);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingUser(null);
    };

    if (isLoading) {
        return (
            <div className="admin-page-container animate-pulse">
                <div className="mb-6">
                    <div className="flex gap-4 border-b">
                        <div className="h-10 bg-gray-200 rounded-t w-32"></div>
                        <div className="h-10 bg-gray-200 rounded-t w-32"></div>
                        <div className="h-10 bg-gray-200 rounded-t w-32"></div>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="h-10 bg-gray-200 rounded w-full max-w-md"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-white rounded-lg p-6 border h-40 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gray-200"></div>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                                    <div>
                                        <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <div className="w-8 h-8 rounded bg-gray-200"></div>
                                    <div className="w-8 h-8 rounded bg-gray-200"></div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="h-4 bg-gray-200 rounded w-48"></div>
                                <div className="h-4 bg-gray-200 rounded w-32"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page-container">
            <div className="card-base" style={{ padding: 0 }}>
                {/* Tabs & Action */}
                <div className="admin-tabs-container flex justify-between items-center pr-4 flex-wrap gap-2">
                    <div className="admin-tabs-list">
                        <button
                            onClick={() => setActiveRole('all')}
                            className={`admin-tab-btn ${activeRole === 'all' ? 'active-assigned' : ''}`}
                        >
                            All Employees
                        </button>
                        <button
                            onClick={() => setActiveRole('staff')}
                            className={`admin-tab-btn ${activeRole === 'staff' ? 'active-assigned' : ''}`}
                        >
                            Managers
                        </button>
                        <button
                            onClick={() => setActiveRole('worker')}
                            className={`admin-tab-btn ${activeRole === 'worker' ? 'active-resolved' : ''}`}
                        >
                            Workers
                        </button>
                    </div>
                    <button onClick={() => openModal()} className="btn-primary py-2 px-3 text-xs shrink-0">
                        <UserPlus size={16} />
                        <span>{activeRole === 'worker' ? 'Add Worker' : activeRole === 'staff' ? 'Add Manager' : 'Add Employee'}</span>
                    </button>
                </div>

                {/* Filters */}
                <div className="admin-filters-section">
                    <div className="input-group-wrapper" style={{ maxWidth: '100%' }}>
                        <Search className="input-icon" size={16} />
                        <input
                            className="input-with-icon"
                            placeholder="Search employees by name or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="card-body">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredEmployees.length > 0 ? (
                            filteredEmployees.map(employee => (
                                <div key={employee.id} className="admin-list-item relative overflow-hidden group hover:border-blue-200 transition-all">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${employee.role === 'staff' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${employee.role === 'staff' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                                                {employee.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 line-clamp-1">{employee.name}</h3>
                                                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">{employee.role}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setViewingHistoryUser(employee)}
                                                className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors"
                                                title="View Track"
                                            >
                                                <TrendingUp size={16} />
                                            </button>
                                            <button
                                                onClick={() => openModal(employee)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => { if (window.confirm('Remove employee?')) deleteMutation.mutate(employee.id); }}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Mail size={14} className="text-gray-400" />
                                            <span className="truncate">{employee.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone size={14} className="text-gray-400" />
                                            <span>{employee.phone || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full">
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <Search size={32} />
                                    </div>
                                    <p className="empty-state-text">No employees found matching your filters.</p>
                                    <button onClick={() => { setActiveRole('all'); setSearchTerm(''); }} className="empty-state-action">
                                        Clear filters
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <EmployeeModal
                isOpen={showModal}
                onClose={closeModal}
                user={editingUser}
                activeRole={activeRole}
                existingUsers={availableUsersData}
                availableRoles={rolesData || []}
                onSubmit={handleModalSubmit}
                onCreateNewUser={handleCreateNewUser}
                isSubmitting={createMutation.isPending || updateMutation.isPending || createRbacUserMutation.isPending}
            />

            <EmployeeHistoryModal
                isOpen={!!viewingHistoryUser}
                onClose={() => setViewingHistoryUser(null)}
                employee={viewingHistoryUser}
            />
        </div>
    );
};

export default EmployeeManagement;

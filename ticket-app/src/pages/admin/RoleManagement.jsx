import React, { useState, useEffect, useMemo } from 'react';
import {
    FiPlus,
    FiEdit2,
    FiTrash2,
    FiUsers,
    FiShield,
    FiX,
    FiSearch,
    FiLock,
    FiCheckCircle
} from 'react-icons/fi';
import { getRoles, createRole, updateRole, deleteRole } from '../../services/roleService';
import PermissionMatrix from '../../components/admin/PermissionMatrix';
import './RoleManagement.css';

const MODULE_CONFIG = {
    ticket_dashboard: { label: 'Dashboard', chipClass: 'chip-blue' },
    ticket_management: { label: 'Ticket Management', chipClass: 'chip-emerald' },
    employee_management: { label: 'Employee Management', chipClass: 'chip-purple' },
    category_management: { label: 'Category Management', chipClass: 'chip-amber' },
    ticket_reports: { label: 'Reports', chipClass: 'chip-rose' },
    ticket_settings: { label: 'Settings', chipClass: 'chip-slate' }
};

const getActiveModules = (permissions) => {
    if (!permissions || typeof permissions !== 'object') return [];

    return Object.entries(permissions)
        .map(([key, perms]) => {
            if (!perms || typeof perms !== 'object') return null;
            const grantedCount = Object.values(perms).filter(Boolean).length;
            if (grantedCount === 0) return null;
            const config = MODULE_CONFIG[key] || {
                label: key.replace('ticket_', '').replace(/_/g, ' '),
                chipClass: 'chip-slate'
            };
            return {
                key,
                label: config.label,
                chipClass: config.chipClass,
                grantedCount
            };
        })
        .filter(Boolean);
};

const RoleManagement = () => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'system' | 'custom'

    const [formData, setFormData] = useState({
        role_name: '',
        display_name: '',
        description: '',
        permissions: {}
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const response = await getRoles();
            setRoles(response.data || []);
        } catch (err) {
            console.error('Error fetching roles:', err);
            setError('Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setFormData({
                role_name: role.role_name,
                display_name: role.display_name,
                description: role.description || '',
                permissions: role.permissions || {}
            });
        } else {
            setEditingRole(null);
            setFormData({
                role_name: '',
                display_name: '',
                description: '',
                permissions: initializeEmptyPermissions()
            });
        }
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingRole(null);
        setFormData({
            role_name: '',
            display_name: '',
            description: '',
            permissions: {}
        });
        setError('');
    };

    const initializeEmptyPermissions = () => {
        return {
            ticket_dashboard: { read: false },
            ticket_management: { read: false, write: false, update: false, delete: false },
            employee_management: { read: false, write: false, update: false, delete: false },
            category_management: { read: false, write: false, update: false, delete: false },
            ticket_reports: { read: false, write: false, update: false, delete: false },
            ticket_settings: { read: false, write: false, update: false, delete: false }
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingRole) {
                // Update existing role
                await updateRole(editingRole.id, {
                    role_name: formData.role_name,
                    display_name: formData.display_name,
                    description: formData.description,
                    permissions: formData.permissions
                });
                setSuccess('Role updated successfully!');
            } else {
                // Create new role
                await createRole(formData);
                setSuccess('Role created successfully!');
            }

            await fetchRoles();
            setTimeout(() => {
                handleCloseModal();
            }, 1200);
        } catch (err) {
            console.error('Error saving role:', err);
            setError(err.message || 'Failed to save role');
        }
    };

    const handleDelete = async (roleId, roleName) => {
        if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) {
            return;
        }

        try {
            await deleteRole(roleId);
            setSuccess('Role deleted successfully!');
            await fetchRoles();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error deleting role:', err);
            setError(err.message || 'Failed to delete role');
            setTimeout(() => setError(''), 3000);
        }
    };

    // Filtered roles based on search and type filter
    const filteredRoles = useMemo(() => {
        return roles.filter(role => {
            const matchesFilter =
                roleFilter === 'all' ? true :
                roleFilter === 'system' ? Boolean(role.is_system_role) :
                !role.is_system_role;

            if (!matchesFilter) return false;

            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase().trim();
            const displayName = (role.display_name || '').toLowerCase();
            const roleName = (role.role_name || '').toLowerCase();
            const description = (role.description || '').toLowerCase();

            return displayName.includes(q) || roleName.includes(q) || description.includes(q);
        });
    }, [roles, roleFilter, searchQuery]);

    // Statistics
    const stats = useMemo(() => {
        const total = roles.length;
        const system = roles.filter(r => r.is_system_role).length;
        const custom = total - system;
        const totalUsers = roles.reduce((acc, r) => acc + (Number(r.employee_count) || 0), 0);
        return { total, system, custom, totalUsers };
    }, [roles]);

    if (loading) {
        return (
            <div className="role-management-page animate-pulse">
                {/* Stats Skeleton */}
                <div className="role-stats-grid">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="stat-card-compact">
                            <div className="stat-icon-wrapper bg-slate-200"></div>
                            <div className="stat-content">
                                <div className="h-3 bg-slate-200 rounded w-16 mb-2"></div>
                                <div className="h-6 bg-slate-200 rounded w-10"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Table Skeleton */}
                <div className="roles-table-card">
                    <div className="roles-table-toolbar">
                        <div className="h-10 bg-slate-200 rounded-xl w-80"></div>
                        <div className="h-10 bg-slate-200 rounded-xl w-52"></div>
                    </div>
                    <div className="p-4 space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-16 bg-slate-100 rounded-xl w-full"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="role-management-page">
            {/* Notification Alerts */}
            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            {success && (
                <div className="alert alert-success">
                    {success}
                </div>
            )}

            {/* Quick Metrics Header */}
            <div className="role-stats-grid">
                <div className="stat-card-compact">
                    <div className="stat-icon-wrapper bg-blue-50 text-blue-600 border border-blue-100">
                        <FiShield size={18} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Total Roles</span>
                        <span className="stat-value">{stats.total}</span>
                    </div>
                </div>

                <div className="stat-card-compact">
                    <div className="stat-icon-wrapper bg-purple-50 text-purple-600 border border-purple-100">
                        <FiLock size={18} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">System Roles</span>
                        <span className="stat-value">{stats.system}</span>
                    </div>
                </div>

                <div className="stat-card-compact">
                    <div className="stat-icon-wrapper bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <FiCheckCircle size={18} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Custom Roles</span>
                        <span className="stat-value">{stats.custom}</span>
                    </div>
                </div>

                <div className="stat-card-compact">
                    <div className="stat-icon-wrapper bg-amber-50 text-amber-600 border border-amber-100">
                        <FiUsers size={18} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Assigned Users</span>
                        <span className="stat-value">{stats.totalUsers}</span>
                    </div>
                </div>
            </div>

            {/* Roles Table Container */}
            <div className="roles-table-card">
                {/* Search & Filter Controls Toolbar */}
                <div className="roles-table-toolbar">
                    <div className="roles-search-box">
                        <FiSearch className="search-icon" size={17} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search roles by name, slug, or description..."
                            className="roles-search-input"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="search-clear-btn"
                                title="Clear search"
                            >
                                <FiX size={15} />
                            </button>
                        )}
                    </div>

                    <div className="roles-filter-tabs">
                        <button
                            type="button"
                            className={`filter-tab ${roleFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setRoleFilter('all')}
                        >
                            All ({stats.total})
                        </button>
                        <button
                            type="button"
                            className={`filter-tab ${roleFilter === 'system' ? 'active' : ''}`}
                            onClick={() => setRoleFilter('system')}
                        >
                            System ({stats.system})
                        </button>
                        <button
                            type="button"
                            className={`filter-tab ${roleFilter === 'custom' ? 'active' : ''}`}
                            onClick={() => setRoleFilter('custom')}
                        >
                            Custom ({stats.custom})
                        </button>
                    </div>

                    <button
                        type="button"
                        className="btn-primary shrink-0"
                        onClick={() => handleOpenModal()}
                    >
                        <FiPlus size={16} />
                        <span>Create Role</span>
                    </button>
                </div>

                {/* Mobile Scroll Affordance */}
                <div className="table-scroll-hint">
                    Swipe horizontally to view all columns &rarr;
                </div>

                {/* Table Element */}
                <div className="roles-table-scroll-container">
                    <table className="roles-table">
                        <thead>
                            <tr>
                                <th className="th-role">Role</th>
                                <th className="th-desc">Description</th>
                                <th className="th-users">Assigned Users</th>
                                <th className="th-perms">Permissions</th>
                                <th className="th-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRoles.length > 0 ? (
                                filteredRoles.map(role => {
                                    const activeModules = getActiveModules(role.permissions);
                                    const isSystem = Boolean(role.is_system_role);

                                    return (
                                        <tr key={role.id} className="role-table-row">
                                            {/* Role Name & Slug */}
                                            <td>
                                                <div className="role-identity-cell">
                                                    <div className={`role-avatar-icon ${isSystem ? 'system' : 'custom'}`}>
                                                        <FiShield size={18} />
                                                    </div>
                                                    <div className="role-meta">
                                                        <div className="role-title-row">
                                                            <span className="role-display-name">{role.display_name}</span>
                                                            {isSystem ? (
                                                                <span className="badge-pill system">System Role</span>
                                                            ) : (
                                                                <span className="badge-pill custom">Custom</span>
                                                            )}
                                                        </div>
                                                        <span className="role-code-slug">{role.role_name}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Description */}
                                            <td>
                                                <p className="role-desc-text">
                                                    {role.description || (
                                                        <span className="text-slate-400 italic">No description provided</span>
                                                    )}
                                                </p>
                                            </td>

                                            {/* Assigned Users Count */}
                                            <td>
                                                <div className="users-count-badge">
                                                    <FiUsers size={14} />
                                                    <span>
                                                        {role.employee_count || 0} {role.employee_count === 1 ? 'employee' : 'employees'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Granted Module Permissions */}
                                            <td>
                                                <div className="permissions-chips-wrap">
                                                    {activeModules.length === 0 ? (
                                                        <span className="permission-empty-chip">No permissions assigned</span>
                                                    ) : (
                                                        activeModules.map(mod => (
                                                            <span
                                                                key={mod.key}
                                                                className={`permission-chip ${mod.chipClass}`}
                                                                title={`${mod.label} (${mod.grantedCount} actions)`}
                                                            >
                                                                {mod.label}
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                            </td>

                                            {/* Action Buttons */}
                                            <td>
                                                <div className="actions-cell">
                                                    <button
                                                        type="button"
                                                        className="action-btn edit"
                                                        onClick={() => handleOpenModal(role)}
                                                        title="Edit Role"
                                                    >
                                                        <FiEdit2 size={14} />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`action-btn delete ${isSystem ? 'disabled' : ''}`}
                                                        onClick={() => {
                                                            if (isSystem) return;
                                                            handleDelete(role.id, role.display_name);
                                                        }}
                                                        disabled={isSystem}
                                                        title={isSystem ? 'System roles cannot be deleted' : 'Delete Role'}
                                                    >
                                                        <FiTrash2 size={14} />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5">
                                        <div className="roles-empty-state">
                                            <div className="empty-icon-wrap">
                                                <FiShield size={32} />
                                            </div>
                                            <h3>No roles found</h3>
                                            <p>
                                                {searchQuery
                                                    ? `No roles match your search "${searchQuery}". Try a different keyword.`
                                                    : 'No roles found in this category.'}
                                            </p>
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    className="btn-secondary btn-sm mt-3"
                                                    onClick={() => setSearchQuery('')}
                                                >
                                                    Clear Search Filter
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Role Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content role-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>{editingRole ? 'Edit Role' : 'Create New Role'}</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {editingRole ? `Update settings and permissions for ${editingRole.display_name}` : 'Define a new role and customize module permissions'}
                                </p>
                            </div>
                            <button className="close-btn" onClick={handleCloseModal} aria-label="Close">
                                <FiX size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-error mb-4">
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="alert alert-success mb-4">
                                        {success}
                                    </div>
                                )}

                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Role Slug / Key *</label>
                                        <input
                                            type="text"
                                            value={formData.role_name}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                role_name: e.target.value.toLowerCase().replace(/\s+/g, '_')
                                            })}
                                            disabled={Boolean(editingRole?.is_system_role)}
                                            placeholder="e.g., principal, supervisor"
                                            required
                                            className="form-input"
                                        />
                                        <small className="form-hint">
                                            {editingRole?.is_system_role
                                                ? 'System role slugs are locked and cannot be changed.'
                                                : 'Lowercase with underscores only (e.g. branch_admin).'}
                                        </small>
                                    </div>

                                    <div className="form-group">
                                        <label>Display Name *</label>
                                        <input
                                            type="text"
                                            value={formData.display_name}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                display_name: e.target.value
                                            })}
                                            placeholder="e.g., Principal, Supervisor"
                                            required
                                            className="form-input"
                                        />
                                        <small className="form-hint">
                                            Human readable name shown across the system.
                                        </small>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            description: e.target.value
                                        })}
                                        placeholder="Brief description of this role's scope and responsibilities..."
                                        rows="2"
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="mb-2 block">Module Permissions Matrix</label>
                                    <PermissionMatrix
                                        permissions={formData.permissions}
                                        onChange={(newPermissions) => setFormData({
                                            ...formData,
                                            permissions: newPermissions
                                        })}
                                    />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleCloseModal}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingRole ? 'Update Role' : 'Create Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleManagement;

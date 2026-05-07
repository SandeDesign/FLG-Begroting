import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  Users, 
  Plus,
  Edit3,
  Trash2,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import Modal from '../components/ui/Modal';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePageTitle } from '../contexts/PageTitleContext';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'users' | 'companies' | 'employees' | 'timesheets' | 'invoices' | 'reports' | 'system';
  level: 'read' | 'write' | 'delete' | 'admin';
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateRoleData {
  name: string;
  description: string;
  permissions: string[];
}

const SYSTEM_PERMISSIONS: Permission[] = [
  // Users
  { id: 'users.read', name: 'Gebruikers bekijken', description: 'Gebruikerslijst en profielen bekijken', category: 'users', level: 'read' },
  { id: 'users.write', name: 'Gebruikers bewerken', description: 'Gebruikers aanmaken en bewerken', category: 'users', level: 'write' },
  { id: 'users.delete', name: 'Gebruikers verwijderen', description: 'Gebruikers permanent verwijderen', category: 'users', level: 'delete' },
  { id: 'users.roles', name: 'Rollen beheren', description: 'Rollen en rechten beheren', category: 'users', level: 'admin' },

  // Companies
  { id: 'companies.read', name: 'Bedrijven bekijken', description: 'Bedrijfsgegevens bekijken', category: 'companies', level: 'read' },
  { id: 'companies.write', name: 'Bedrijven bewerken', description: 'Bedrijven aanmaken en bewerken', category: 'companies', level: 'write' },
  { id: 'companies.delete', name: 'Bedrijven verwijderen', description: 'Bedrijven permanent verwijderen', category: 'companies', level: 'delete' },

  // Employees
  { id: 'employees.read', name: 'Werknemers bekijken', description: 'Werknemersgegevens bekijken', category: 'employees', level: 'read' },
  { id: 'employees.write', name: 'Werknemers bewerken', description: 'Werknemers aanmaken en bewerken', category: 'employees', level: 'write' },
  { id: 'employees.delete', name: 'Werknemers verwijderen', description: 'Werknemers permanent verwijderen', category: 'employees', level: 'delete' },

  // Timesheets
  { id: 'timesheets.read', name: 'Uren bekijken', description: 'Urenregistraties bekijken', category: 'timesheets', level: 'read' },
  { id: 'timesheets.write', name: 'Uren bewerken', description: 'Urenregistraties aanmaken en bewerken', category: 'timesheets', level: 'write' },
  { id: 'timesheets.approve', name: 'Uren goedkeuren', description: 'Urenregistraties goedkeuren of afwijzen', category: 'timesheets', level: 'admin' },

  // Invoices
  { id: 'invoices.read', name: 'Facturen bekijken', description: 'Facturen bekijken', category: 'invoices', level: 'read' },
  { id: 'invoices.write', name: 'Facturen bewerken', description: 'Facturen aanmaken en bewerken', category: 'invoices', level: 'write' },
  { id: 'invoices.delete', name: 'Facturen verwijderen', description: 'Facturen verwijderen', category: 'invoices', level: 'delete' },

  // Reports
  { id: 'reports.read', name: 'Rapporten bekijken', description: 'Rapporten en exports bekijken', category: 'reports', level: 'read' },
  { id: 'reports.export', name: 'Rapporten exporteren', description: 'Rapporten exporteren en downloaden', category: 'reports', level: 'write' },

  // System
  { id: 'system.audit', name: 'Audit log', description: 'Systeemlogboek bekijken', category: 'system', level: 'read' },
  { id: 'system.settings', name: 'Systeeminstellingen', description: 'Systeeminstellingen wijzigen', category: 'system', level: 'admin' },
  { id: 'system.backup', name: 'Backup beheer', description: 'Backups maken en beheren', category: 'system', level: 'admin' }
];

const AdminRoles: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { success, error: showError } = useToast();
  usePageTitle('Rollen & Rechten');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadRoles = useCallback(async () => {
    if (!user || !adminUserId || !adminUserId) return;

    try {
      setLoading(true);
      
      // Load roles
      const rolesQuery = query(collection(db, 'roles'));
      const rolesSnapshot = await getDocs(rolesQuery);
      
      // Load users to count role usage
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => doc.data());

      const rolesData: Role[] = rolesSnapshot.docs.map(doc => {
        const data = doc.data();
        const userCount = users.filter(u => u.role === data.name?.toLowerCase()).length;
        
        return {
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          permissions: data.permissions || [],
          isSystem: data.isSystem || false,
          userCount,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      });

      // Add system roles if they don't exist
      const systemRoles = ['admin', 'manager', 'employee'];
      const existingRoleNames = rolesData.map(r => r.name.toLowerCase());
      
      for (const systemRole of systemRoles) {
        if (!existingRoleNames.includes(systemRole)) {
          const userCount = users.filter(u => u.role === systemRole).length;
          rolesData.push({
            id: `system_${systemRole}`,
            name: systemRole.charAt(0).toUpperCase() + systemRole.slice(1),
            description: getSystemRoleDescription(systemRole),
            permissions: getSystemRolePermissions(systemRole),
            isSystem: true,
            userCount,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      setRoles(rolesData);
    } catch (error) {
      console.error('Error loading roles:', error);
      showError('Fout bij laden', 'Kon rollen niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, showError]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const getSystemRoleDescription = (role: string): string => {
    switch (role) {
      case 'admin': return 'Volledige toegang tot alle systeemfuncties';
      case 'manager': return 'Beheer van teams en goedkeuringen';
      case 'employee': return 'Basis toegang voor werknemers';
      default: return '';
    }
  };

  const getSystemRolePermissions = (role: string): string[] => {
    switch (role) {
      case 'admin':
        return SYSTEM_PERMISSIONS.map(p => p.id);
      case 'manager':
        return [
          'employees.read', 'employees.write',
          'timesheets.read', 'timesheets.write', 'timesheets.approve',
          'reports.read', 'reports.export'
        ];
      case 'employee':
        return [
          'timesheets.read', 'timesheets.write',
          'reports.read'
        ];
      default:
        return [];
    }
  };

  const handleCreateRole = async (data: CreateRoleData) => {
    if (!user || !adminUserId || !adminUserId) return;

    try {
      await addDoc(collection(db, 'roles'), {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        isSystem: false,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        createdBy: user.uid
      });

      success('Rol aangemaakt', 'De nieuwe rol is succesvol aangemaakt');
      setIsCreateModalOpen(false);
      loadRoles();
    } catch (error) {
      console.error('Error creating role:', error);
      showError('Fout bij aanmaken', 'Kon rol niet aanmaken');
    }
  };

  const handleUpdateRole = async (roleId: string, data: Partial<CreateRoleData>) => {
    if (!user || !adminUserId || !adminUserId) return;

    try {
      await updateDoc(doc(db, 'roles', roleId), {
        ...data,
        updatedAt: Timestamp.fromDate(new Date()),
        updatedBy: user.uid
      });

      success('Rol bijgewerkt', 'De rol is succesvol bijgewerkt');
      setIsEditModalOpen(false);
      setEditingRole(null);
      loadRoles();
    } catch (error) {
      console.error('Error updating role:', error);
      showError('Fout bij bijwerken', 'Kon rol niet bijwerken');
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Weet je zeker dat je de rol "${roleName}" wilt verwijderen?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'roles', roleId));
      success('Rol verwijderd', 'De rol is succesvol verwijderd');
      loadRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      showError('Fout bij verwijderen', 'Kon rol niet verwijderen');
    }
  };

  const getPermissionsByCategory = (category: string) => {
    return SYSTEM_PERMISSIONS.filter(p => category === 'all' || p.category === category);
  };

  const getPermissionName = (permissionId: string): string => {
    const permission = SYSTEM_PERMISSIONS.find(p => p.id === permissionId);
    return permission ? permission.name : permissionId;
  };

  const getCategoryColor = (category: Permission['category']) => {
    switch (category) {
      case 'users': return 'text-primary-600 bg-primary-100';
      case 'companies': return 'text-green-600 bg-green-100';
      case 'employees': return 'text-purple-600 bg-purple-100';
      case 'timesheets': return 'text-orange-600 bg-orange-100';
      case 'invoices': return 'text-cyan-600 bg-cyan-100';
      case 'reports': return 'text-indigo-600 bg-indigo-100';
      case 'system': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800';
    }
  };

  const categories = Array.from(new Set(SYSTEM_PERMISSIONS.map(p => p.category)));

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Rollen & Rechten</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Beheer gebruikersrollen en hun toegangsrechten
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="mt-4 sm:mt-0"
          icon={Plus}
        >
          Nieuwe Rol
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Shield className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Totaal Rollen</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{roles.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Systeem Rollen</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {roles.filter(r => r.isSystem).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Settings className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Aangepaste Rollen</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {roles.filter(r => !r.isSystem).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Roles List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {roles.map((role) => (
          <Card key={role.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{role.name}</h3>
                  {role.isSystem && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-primary-800 bg-primary-100">
                      Systeem
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{role.description}</p>
                
                <div className="mt-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-300">
                    <Users className="h-4 w-4" />
                    <span>{role.userCount} gebruikers</span>
                  </div>
                  
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-300 mb-2">
                      {role.permissions.length} rechten toegekend
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 3).map((permissionId) => (
                        <span
                          key={permissionId}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-gray-600 dark:text-gray-200 bg-gray-100 dark:bg-gray-800"
                        >
                          {getPermissionName(permissionId)}
                        </span>
                      ))}
                      {role.permissions.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-gray-600 dark:text-gray-200 bg-gray-100 dark:bg-gray-800">
                          +{role.permissions.length - 3} meer
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {!role.isSystem && (
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Edit3}
                    onClick={() => {
                      setEditingRole(role);
                      setIsEditModalOpen(true);
                    }}
                  >
                    Bewerken
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={() => handleDeleteRole(role.id, role.name)}
                    disabled={role.userCount > 0}
                  >
                    Verwijderen
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {roles.length === 0 && (
        <EmptyState
          icon={Shield}
          title="Geen rollen gevonden"
          description="Er zijn nog geen rollen aangemaakt"
          actionLabel="Eerste Rol Aanmaken"
          onAction={() => setIsCreateModalOpen(true)}
        />
      )}

      {/* Permissions Overview */}
      <Card title="Beschikbare Rechten">
        <div className="p-6">
          <div className="mb-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">Alle categorieën</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {getPermissionsByCategory(selectedCategory).map((permission) => (
              <div key={permission.id} className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className={`p-2 rounded-lg ${getCategoryColor(permission.category)}`}>
                  <Shield className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{permission.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-300">{permission.description}</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getCategoryColor(permission.category)}`}>
                    {permission.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Create/Edit Role Modal */}
      <RoleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateRole}
        permissions={SYSTEM_PERMISSIONS}
      />

      {editingRole && (
        <RoleModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingRole(null);
          }}
          onSubmit={(data) => handleUpdateRole(editingRole.id, data)}
          permissions={SYSTEM_PERMISSIONS}
          initialData={{
            name: editingRole.name,
            description: editingRole.description,
            permissions: editingRole.permissions
          }}
        />
      )}
    </div>
  );
};

// Role Modal Component
const RoleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateRoleData) => void;
  permissions: Permission[];
  initialData?: CreateRoleData;
}> = ({ isOpen, onClose, onSubmit, permissions, initialData }) => {
  const [formData, setFormData] = useState<CreateRoleData>(
    initialData || {
      name: '',
      description: '',
      permissions: []
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Rol Bewerken' : 'Nieuwe Rol Aanmaken'}
      size="large"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Rolnaam
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Beschrijving
            </label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
            Rechten ({formData.permissions.length} geselecteerd)
          </label>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
              <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 capitalize">
                  {category}
                </h4>
                <div className="space-y-2">
                  {categoryPermissions.map((permission) => (
                    <div key={permission.id} className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id={permission.id}
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                        className="mt-1 h-4 w-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <label htmlFor={permission.id} className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
                          {permission.name}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-300">{permission.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button type="submit">
            {initialData ? 'Rol Bijwerken' : 'Rol Aanmaken'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminRoles;
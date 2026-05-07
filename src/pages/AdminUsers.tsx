import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, CreditCard as Edit, Trash2, Search, Shield, ShieldCheck, Mail, Ban, UserCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ActionMenu from '../components/ui/ActionMenu';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { repairAdminUsers, updateUserProfile } from '../services/firebase';

interface UserRole {
  id: string;
  uid: string;
  role: 'admin' | 'co-admin' | 'manager' | 'boekhouder' | 'employee';
  employeeId?: string | null;
  email?: string;
  displayName?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AdminUsers: React.FC = () => {
  const { user, adminUserId } = useAuth();
  usePageTitle('Gebruikersbeheer');
  const { success, error: showError } = useToast();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<UserRole | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCoAdminLinked, setEditCoAdminLinked] = useState(false);
  const [loadingCoAdminStatus, setLoadingCoAdminStatus] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!user || !adminUserId) return;

    try {
      setLoading(true);
      const usersCol = collection(db, 'users');

      // Stap 1: Haal alle employees op van deze admin
      const employeesQ = query(
        collection(db, 'employees'),
        where('userId', '==', adminUserId)
      );
      const employeesSnapshot = await getDocs(employeesQ);
      const employeeIds = employeesSnapshot.docs.map(d => d.id);

      // Query A: users met adminUserId veld (nieuwe accounts)
      const qByAdmin = query(usersCol, where('adminUserId', '==', adminUserId));
      const byAdminSnapshot = await getDocs(qByAdmin);

      // Query B: users gekoppeld via employeeId (backward compatible)
      const usersByEmployee: typeof byAdminSnapshot.docs = [];
      for (let i = 0; i < employeeIds.length; i += 30) {
        const batch = employeeIds.slice(i, i + 30);
        const qByEmp = query(usersCol, where('employeeId', 'in', batch));
        const snapshot = await getDocs(qByEmp);
        usersByEmployee.push(...snapshot.docs);
      }

      // Query C: admin's eigen user record
      const qSelf = query(usersCol, where('uid', '==', adminUserId));
      const selfSnapshot = await getDocs(qSelf);

      // Dedupliceer op document ID
      const allDocs = new Map<string, typeof byAdminSnapshot.docs[0]>();
      [...byAdminSnapshot.docs, ...usersByEmployee, ...selfSnapshot.docs]
        .forEach(d => allDocs.set(d.id, d));

      const usersData: UserRole[] = Array.from(allDocs.values()).map(userDoc => {
        const data = userDoc.data();
        const name = data.displayName
          || (data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : '');

        const toDate = (val: unknown): Date | undefined => {
          if (!val) return undefined;
          if (typeof (val as any).toDate === 'function') return (val as any).toDate();
          const d = new Date(val as any);
          return isNaN(d.getTime()) ? undefined : d;
        };

        return {
          id: userDoc.id,
          uid: data.uid || '',
          role: data.role || 'employee',
          employeeId: data.employeeId,
          email: data.email || '',
          displayName: name,
          isActive: data.isActive !== false,
          lastLoginAt: toDate(data.lastLoginAt),
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt)
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      showError('Fout bij laden', 'Kon gebruikers niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, showError]);

  useEffect(() => {
    if (!adminUserId) return;

    // Cache repair 24u — was vroeger 2 queries per page-open, nu max 1x/dag.
    const repairKey = `repairAdminUsers_${adminUserId}`;
    const lastRepair = parseInt(localStorage.getItem(repairKey) || '0', 10);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    if (lastRepair > oneDayAgo) {
      loadUsers();
      return;
    }

    repairAdminUsers(adminUserId).then(() => {
      localStorage.setItem(repairKey, String(Date.now()));
      loadUsers();
    });
  }, [loadUsers, adminUserId]);

  const filteredUsers = users.filter(userRole => {
    const email = userRole.email || '';
    const displayName = userRole.displayName || '';
    
    const matchesSearch = 
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userRole.uid.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || userRole.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const handleUpdateUserRole = async (userId: string, newRole: UserRole['role']) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      success('Rol bijgewerkt', 'Gebruikersrol is succesvol gewijzigd');
      loadUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      showError('Fout bij bijwerken', 'Kon gebruikersrol niet wijzigen');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isActive: !currentStatus,
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      const statusText = !currentStatus ? 'geactiveerd' : 'gedeactiveerd';
      success('Status bijgewerkt', `Gebruiker is ${statusText}`);
      loadUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      showError('Fout bij bijwerken', 'Kon gebruikersstatus niet wijzigen');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Weet je zeker dat je gebruiker ${userEmail} wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      success('Gebruiker verwijderd', 'Gebruiker is succesvol verwijderd');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showError('Fout bij verwijderen', 'Kon gebruiker niet verwijderen');
    }
  };

  const handleRepairUsers = async () => {
    if (!adminUserId) return;
    setRepairing(true);
    try {
      await repairAdminUsers(adminUserId);
      await loadUsers();
      success('Gesynchroniseerd', 'Gebruikersboom is bijgewerkt');
    } catch {
      showError('Fout', 'Synchronisatie mislukt');
    } finally {
      setRepairing(false);
    }
  };

  const handleEditUser = async (userRole: UserRole) => {
    const nameParts = (userRole.displayName || '').split(' ');
    setEditFirstName(nameParts[0] || '');
    setEditLastName(nameParts.slice(1).join(' ') || '');
    setEditEmail(userRole.email || '');
    setEditCoAdminLinked(false);
    setEditingUser(userRole);

    // Laad co-admin status voor admin gebruikers
    if ((userRole.role === 'admin' || userRole.role === 'co-admin') && userRole.uid && adminUserId) {
      setLoadingCoAdminStatus(true);
      try {
        const settingsRef = doc(db, 'userSettings', userRole.uid);
        const settingsDoc = await getDoc(settingsRef);
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setEditCoAdminLinked(data.primaryAdminUserId === adminUserId);
        }
      } catch {
        // geen settings = niet gekoppeld
      } finally {
        setLoadingCoAdminStatus(false);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateUserProfile(editingUser.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim(),
      });

      // Koppel of ontkoppel co-admin voor admin gebruikers
      if ((editingUser.role === 'admin' || editingUser.role === 'co-admin') && editingUser.uid && adminUserId) {
        const settingsRef = doc(db, 'userSettings', editingUser.uid);
        if (editCoAdminLinked) {
          await setDoc(settingsRef, { primaryAdminUserId: adminUserId }, { merge: true });
        } else {
          const settingsDoc = await getDoc(settingsRef);
          if (settingsDoc.exists() && settingsDoc.data().primaryAdminUserId) {
            await updateDoc(settingsRef, { primaryAdminUserId: deleteField() });
          }
        }
      }

      success('Opgeslagen', 'Gebruikersprofiel is bijgewerkt');
      setEditingUser(null);
      loadUsers();
    } catch {
      showError('Fout', 'Kon profiel niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const getRoleColor = (role: UserRole['role']) => {
    switch (role) {
      case 'admin': return 'text-red-600 bg-red-100';
      case 'co-admin': return 'text-orange-600 bg-orange-100';
      case 'manager': return 'text-primary-600 bg-primary-100';
      case 'boekhouder': return 'text-indigo-600 bg-indigo-100';
      case 'employee': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800';
    }
  };

  const getRoleLabel = (role: UserRole['role']) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'co-admin': return 'Co-Admin';
      case 'manager': return 'Manager';
      case 'employee': return 'Werknemer';
      default: return role;
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'text-green-600 bg-green-100'
      : 'text-red-600 bg-red-100';
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Onbekend';
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gebruikersbeheer</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Beheer gebruikersrollen en toegang ({users.length} gebruikers gevonden)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleRepairUsers}
            disabled={repairing}
          >
            {repairing ? 'Synchroniseren...' : 'Gebruikers synchroniseren'}
          </Button>
          <Button icon={Plus}>
            Nieuwe Gebruiker
          </Button>
        </div>
      </div>

      {/* Debug Info */}
      {users.length === 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-yellow-800">
              <strong>Debug Info:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Geen gebruikers gevonden in de 'users' collectie</li>
                <li>• Controleer of Firebase verbinding werkt</li>
                <li>• Controleer of er documenten in de 'users' collectie staan</li>
                <li>• Check de browser console voor errors</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Zoek op naam, email of UID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            
            <div className="flex space-x-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">Alle rollen</option>
                <option value="admin">Administrator</option>
                <option value="manager">Manager</option>
                <option value="boekhouder">Boekhouder</option>
                <option value="employee">Werknemer</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-primary-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Totaal</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{users.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <UserCheck className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Actief</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {users.filter(u => u.isActive !== false).length}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Admins</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {users.filter(u => u.role === 'admin').length}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <Ban className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">Inactief</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {users.filter(u => u.isActive === false).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Geen gebruikers gevonden"
          description={users.length === 0 
            ? "Er zijn nog geen gebruikers in de database"
            : "Pas je filters aan om meer resultaten te zien"
          }
        />
      ) : (
        <>
          <Card className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Gebruiker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Aangemaakt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Laatste Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((systemUser) => (
                  <tr key={systemUser.id} className="hover:bg-gray-50 dark:bg-gray-900">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Users className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {systemUser.displayName || 'Geen naam'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-300 flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {systemUser.email || 'Geen email'}
                          </div>
                          {systemUser.uid && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              UID: {systemUser.uid.substring(0, 8)}...
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={systemUser.role}
                        onChange={(e) => handleUpdateUserRole(systemUser.id, e.target.value as UserRole['role'])}
                        className={`text-sm px-2 py-1 rounded-full border-none cursor-pointer ${getRoleColor(systemUser.role)}`}
                      >
                        <option value="admin">Administrator</option>
                        <option value="manager">Manager</option>
                        <option value="boekhouder">Boekhouder</option>
                        <option value="employee">Werknemer</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleUserStatus(systemUser.id, systemUser.isActive !== false)}
                        className={`text-sm px-2 py-1 rounded-full border-none cursor-pointer ${getStatusColor(systemUser.isActive !== false)}`}
                      >
                        {systemUser.isActive !== false ? 'Actief' : 'Inactief'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatDate(systemUser.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatDate(systemUser.lastLoginAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit}
                          onClick={() => handleEditUser(systemUser)}
                        >
                          Bewerken
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDeleteUser(systemUser.id, systemUser.email || 'Onbekend')}
                        >
                          Verwijderen
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {filteredUsers.map((systemUser) => (
            <Card key={systemUser.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <Users className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {systemUser.displayName || 'Geen naam'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-300 flex items-center">
                      <Mail className="h-3 w-3 mr-1" />
                      {systemUser.email || 'Geen email'}
                    </div>
                  </div>
                </div>
                <ActionMenu
                  actions={[
                    { label: 'Bewerken', icon: Edit, onClick: () => handleEditUser(systemUser) },
                    {
                      label: systemUser.isActive !== false ? 'Deactiveren' : 'Activeren',
                      icon: systemUser.isActive !== false ? Ban : UserCheck,
                      onClick: () => handleToggleUserStatus(systemUser.id, systemUser.isActive !== false),
                    },
                    {
                      label: 'Verwijderen',
                      icon: Trash2,
                      onClick: () => handleDeleteUser(systemUser.id, systemUser.email || 'Onbekend'),
                      variant: 'danger',
                    },
                  ]}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={systemUser.role}
                  onChange={(e) => handleUpdateUserRole(systemUser.id, e.target.value as UserRole['role'])}
                  className={`text-xs px-2 py-1 rounded-full border-none cursor-pointer ${getRoleColor(systemUser.role)}`}
                >
                  <option value="admin">Administrator</option>
                  <option value="manager">Manager</option>
                  <option value="boekhouder">Boekhouder</option>
                  <option value="employee">Werknemer</option>
                </select>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(systemUser.isActive !== false)}`}>
                  {systemUser.isActive !== false ? 'Actief' : 'Inactief'}
                </span>
              </div>
            </Card>
          ))}
        </div>
        </>
      )}

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Gebruiker bewerken"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Voornaam"
            value={editFirstName}
            onChange={e => setEditFirstName(e.target.value)}
            placeholder="Voornaam"
          />
          <Input
            label="Achternaam"
            value={editLastName}
            onChange={e => setEditLastName(e.target.value)}
            placeholder="Achternaam"
          />
          <Input
            label="E-mailadres"
            type="email"
            value={editEmail}
            onChange={e => setEditEmail(e.target.value)}
            placeholder="email@voorbeeld.nl"
          />

          {/* Co-Admin koppeling — alleen voor admin gebruikers */}
          {editingUser && (editingUser.role === 'admin' || editingUser.role === 'co-admin') && editingUser.uid !== user?.uid && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Co-Admin toegang</p>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                    Geeft deze gebruiker toegang tot dezelfde bedrijfsdata als jij
                  </p>
                </div>
                {loadingCoAdminStatus ? (
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mt-0.5" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditCoAdminLinked(!editCoAdminLinked)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${editCoAdminLinked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${editCoAdminLinked ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                )}
              </div>
              {editCoAdminLinked && (
                <p className="mt-2 text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Gekoppeld — ziet dezelfde bedrijven, medewerkers en facturen
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditingUser(null)}>
              Annuleren
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminUsers;
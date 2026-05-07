import React, { useState, useEffect, useCallback } from 'react';
import { FolderKanban, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';
import { InternalProject } from '../types/internalProject';
import {
  getInternalProjects,
  createInternalProject,
  updateInternalProject,
  deleteInternalProject,
} from '../services/internalProjectService';

const PROJECT_COLORS = [
  { value: 'blue', label: 'Blauw', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  { value: 'green', label: 'Groen', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  { value: 'amber', label: 'Geel', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  { value: 'purple', label: 'Paars', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  { value: 'rose', label: 'Rood', bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  { value: 'cyan', label: 'Cyaan', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
];

export const getProjectColorMeta = (color?: string) =>
  PROJECT_COLORS.find(c => c.value === color) || PROJECT_COLORS[0];

interface ProjectFormState {
  name: string;
  description: string;
  color: string;
}

const emptyForm: ProjectFormState = { name: '', description: '', color: 'blue' };

export default function InternalProjects() {
  usePageTitle('Interne Projecten');
  const { userRole } = useAuth();
  const { selectedCompany, queryUserId } = useApp();
  const { success, error: showError } = useToast();

  const [projects, setProjects] = useState<InternalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const canManage = userRole === 'admin' || userRole === 'co-admin';

  const load = useCallback(async () => {
    if (!queryUserId || !selectedCompany) { setLoading(false); return; }
    try {
      setLoading(true);
      const data = await getInternalProjects(queryUserId, selectedCompany.id, showInactive);
      setProjects(data);
    } catch {
      showError('Fout', 'Projecten konden niet worden geladen.');
    } finally {
      setLoading(false);
    }
  }, [queryUserId, selectedCompany, showInactive]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (project: InternalProject) => {
    setEditingId(project.id!);
    setForm({ name: project.name, description: project.description || '', color: project.color || 'blue' });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const handleSave = async () => {
    if (!form.name.trim()) { showError('Validatie', 'Naam is verplicht.'); return; }
    if (!queryUserId || !selectedCompany) return;
    try {
      setSaving(true);
      if (editingId) {
        await updateInternalProject(editingId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          color: form.color,
        });
        success('Opgeslagen', 'Project bijgewerkt.');
      } else {
        await createInternalProject({
          userId: queryUserId,
          companyId: selectedCompany.id,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          color: form.color,
          isActive: true,
        });
        success('Aangemaakt', 'Project toegevoegd.');
      }
      cancelForm();
      await load();
    } catch {
      showError('Fout', 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (project: InternalProject) => {
    if (!project.id) return;
    try {
      await updateInternalProject(project.id, { isActive: !project.isActive });
      await load();
    } catch {
      showError('Fout', 'Status wijzigen mislukt.');
    }
  };

  const handleDelete = async (project: InternalProject) => {
    if (!project.id) return;
    try {
      setDeletingId(project.id);
      await deleteInternalProject(project.id);
      success('Verwijderd', `"${project.name}" verwijderd.`);
      await load();
    } catch {
      showError('Fout', 'Verwijderen mislukt.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!canManage) {
    return (
      <EmptyState icon={FolderKanban} title="Geen toegang" description="Alleen admins kunnen interne projecten beheren." />
    );
  }

  if (!selectedCompany) {
    return (
      <EmptyState icon={FolderKanban} title="Geen bedrijf geselecteerd" description="Selecteer eerst een bedrijf." />
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <FolderKanban className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Interne Projecten</h1>
            <p className="text-sm text-gray-500 dark:text-gray-300">{selectedCompany.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactive(v => !v)}
            className="text-xs text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
          >
            {showInactive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {showInactive ? 'Alle tonen' : 'Alleen actief'}
          </button>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nieuw project
          </Button>
        </div>
      </div>

      {/* Uitleg */}
      <Card className="bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Interne projecten zijn niet factureerbaar via Riset. Medewerkers kunnen deze selecteren bij het toevoegen van werkzaamheden in hun urenregistratie.
        </p>
      </Card>

      {/* Formulier */}
      {showForm && (
        <Card className="border-2 border-primary-200 dark:border-primary-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {editingId ? 'Project bewerken' : 'Nieuw project'}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Naam <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="bijv. Kantoorwerk, Vergadering, Holding werkzaamheden"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Omschrijving (optioneel)
              </label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Korte toelichting..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Kleur</label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${c.bg} ${c.text} ${form.color === c.value ? 'border-gray-800 dark:border-gray-200 scale-105' : 'border-transparent'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    {c.label}
                    {form.color === c.value && <Check className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Opslaan...' : editingId ? 'Bijwerken' : 'Aanmaken'}
              </Button>
              <Button variant="secondary" onClick={cancelForm} disabled={saving}>
                Annuleren
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Lijst */}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nog geen projecten"
          description="Maak interne projecten aan zodat medewerkers ze kunnen selecteren bij hun urenregistratie."
          action={{ label: 'Eerste project aanmaken', onClick: openAdd }}
        />
      ) : (
        <div className="space-y-2">
          {projects.map(project => {
            const colorMeta = getProjectColorMeta(project.color);
            return (
              <Card key={project.id} className={`flex items-center gap-4 ${!project.isActive ? 'opacity-50' : ''}`}>
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${colorMeta.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{project.name}</span>
                    {!project.isActive && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300">Inactief</span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-300 truncate">{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(project)}
                    title={project.isActive ? 'Deactiveren' : 'Activeren'}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                  >
                    {project.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(project)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(project)}
                    disabled={deletingId === project.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded disabled:opacity-50"
                  >
                    {deletingId === project.id ? <X className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

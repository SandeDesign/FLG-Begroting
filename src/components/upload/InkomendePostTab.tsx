import React, { useState, useEffect } from 'react';
import {
  Upload,
  Mail,
  Calendar,
  DollarSign,
  CheckCircle,
  Trash2,
  Eye,
  Plus,
  Filter,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { EmptyState } from '../ui/EmptyState';
import Modal from '../ui/Modal';
import {
  getIncomingPost,
  createIncomingPost,
  updateIncomingPost,
  deleteIncomingPost,
  uploadPostFile,
  markPostAsProcessed,
  createTask,
  getCompanyUsers,
} from '../../services/firebase';
import { IncomingPost, PostStatus, PostActionType, Company } from '../../types';

interface Props {
  selectedCompany: Company;
}

const InkomendePostTab: React.FC<Props> = ({ selectedCompany }) => {
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [posts, setPosts] = useState<IncomingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<IncomingPost | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
  const [formData, setFormData] = useState({
    sender: '',
    subject: '',
    receivedDate: new Date().toISOString().split('T')[0],
    amount: '',
    dueDate: '',
    requiresAction: false,
    actionType: '' as PostActionType | '',
    actionDescription: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });

  const [filterStatus, setFilterStatus] = useState<PostStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [companyUsers, setCompanyUsers] = useState<Array<{ uid: string; email: string; displayName?: string }>>([]);

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    dueDate: '',
    assignedTo: [] as string[],
  });

  useEffect(() => {
    if (user && selectedCompany) {
      loadPosts();
      loadCompanyUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedCompany]);

  const loadCompanyUsers = async () => {
    if (!selectedCompany) return;
    try {
      const users = await getCompanyUsers(selectedCompany.id);
      setCompanyUsers(users);
    } catch (err) {
      console.error('Error loading company users:', err);
    }
  };

  const loadPosts = async () => {
    if (!selectedCompany) return;

    try {
      setLoading(true);
      const data = await getIncomingPost(selectedCompany.id, user?.uid);
      setPosts(data);
    } catch (err) {
      console.error('Error loading posts:', err);
      showError('Fout bij laden van post');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      showError('Ongeldig bestandstype', 'Alleen afbeeldingen en PDF zijn toegestaan');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('Bestand te groot', 'Maximaal 10MB per bestand');
      return;
    }

    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setUploadedFileUrl(url);
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    const file = files[0];
    await handleFileSelect(file);
    setShowUploadModal(true);
  };

  const handleSubmitPost = async () => {
    if (!uploadedFile || !selectedCompany || !user) {
      showError('Validatie fout', 'Vul alle verplichte velden in');
      return;
    }

    if (!formData.sender || !formData.subject) {
      showError('Validatie fout', 'Afzender en onderwerp zijn verplicht');
      return;
    }

    try {
      setUploading(true);

      const uploadResult = await uploadPostFile(uploadedFile, selectedCompany.name, {
        companyId: selectedCompany.id,
        receivedDate: formData.receivedDate ? new Date(formData.receivedDate) : new Date(),
        subject: formData.subject,
      });

      const postData = {
        companyId: selectedCompany.id,
        sender: formData.sender,
        subject: formData.subject,
        receivedDate: new Date(formData.receivedDate),
        fileUrl: uploadResult.url,
        fileName: uploadedFile.name,
        filePath: uploadResult.path,
        amount: formData.amount ? parseFloat(formData.amount) : undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        status: 'new' as PostStatus,
        requiresAction: formData.requiresAction,
        actionType: formData.actionType || undefined,
        actionDescription: formData.actionDescription || undefined,
        priority: formData.priority,
      };

      await createIncomingPost(user.uid, postData);

      success('Post geüpload', 'De post is succesvol toegevoegd');
      setShowUploadModal(false);
      resetForm();
      loadPosts();
    } catch (err) {
      console.error('Error uploading post:', err);
      showError('Upload fout', 'Kon post niet uploaden');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sender: '',
      subject: '',
      receivedDate: new Date().toISOString().split('T')[0],
      amount: '',
      dueDate: '',
      requiresAction: false,
      actionType: '',
      actionDescription: '',
      priority: 'medium',
    });
    setUploadedFile(null);
    setUploadedFileUrl('');
  };

  const handleMarkAsProcessed = async (post: IncomingPost) => {
    if (!user) return;

    try {
      await markPostAsProcessed(post.id, user.uid);
      success('Post verwerkt', 'De post is gemarkeerd als verwerkt');
      loadPosts();
    } catch (err) {
      console.error('Error marking as processed:', err);
      showError('Fout', 'Kon post niet markeren als verwerkt');
    }
  };

  const handleDeletePost = async (post: IncomingPost) => {
    if (!user || !selectedCompany) return;
    if (!confirm('Weet je zeker dat je deze post wilt verwijderen?')) return;

    try {
      await deleteIncomingPost(post.id, user.uid, selectedCompany.id);
      success('Post verwijderd');
      loadPosts();
    } catch (err) {
      console.error('Error deleting post:', err);
      showError('Fout', 'Kon post niet verwijderen');
    }
  };

  const handleCreateTaskFromPost = async (post: IncomingPost) => {
    setSelectedPost(post);
    setTaskForm({
      title: `Post: ${post.subject}`,
      description: `Afzender: ${post.sender}\n\n${post.actionDescription || ''}`,
      priority: post.priority || 'medium',
      dueDate: post.dueDate ? new Date(post.dueDate).toISOString().split('T')[0] : '',
      assignedTo: [],
    });
    setShowTaskModal(true);
  };

  const handleSubmitTask = async () => {
    if (!user || !selectedCompany || !selectedPost) return;

    if (!taskForm.title) {
      showError('Validatie fout', 'Titel is verplicht');
      return;
    }

    try {
      const taskData = {
        companyId: selectedCompany.id,
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        category: 'operational' as const,
        dueDate: taskForm.dueDate ? new Date(taskForm.dueDate) : null,
        status: 'pending' as const,
        assignedTo: taskForm.assignedTo,
        relatedPostId: selectedPost.id,
      };

      const taskId = await createTask(user.uid, taskData);

      await updateIncomingPost(selectedPost.id, user.uid, {
        relatedTaskId: taskId,
        companyId: selectedCompany.id,
      });

      success('Taak aangemaakt', 'De taak is succesvol aangemaakt');
      setShowTaskModal(false);
      setTaskForm({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        assignedTo: [],
      });
      loadPosts();
    } catch (err) {
      console.error('Error creating task:', err);
      showError('Fout', 'Kon taak niet aanmaken');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const filteredPosts = posts.filter(post => {
    if (filterStatus !== 'all' && post.status !== filterStatus) return false;
    return true;
  });

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusColor = (status: PostStatus) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-700';
      case 'processed':
        return 'bg-green-100 text-green-700';
      case 'requires_action':
        return 'bg-orange-100 text-orange-700';
      case 'archived':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: PostStatus) => {
    switch (status) {
      case 'new':
        return 'Nieuw';
      case 'processed':
        return 'Verwerkt';
      case 'requires_action':
        return 'Actie vereist';
      case 'archived':
        return 'Gearchiveerd';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {posts.length} document{posts.length !== 1 ? 'en' : ''}
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="secondary"
            icon={Filter}
          >
            Filters
          </Button>
          <input
            type="file"
            ref={(input) => {
              if (input) {
                (window as any).postFileInput = input;
              }
            }}
            className="hidden"
            accept="image/*,application/pdf,image/heic,image/heif"
            capture="environment"
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
          <Button
            onClick={() => (window as any).postFileInput?.click()}
            icon={Upload}
          >
            Upload Post
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as PostStatus | 'all')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle statussen</option>
                <option value="new">Nieuw</option>
                <option value="processed">Verwerkt</option>
                <option value="requires_action">Actie vereist</option>
                <option value="archived">Gearchiveerd</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10' : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          Sleep een foto of PDF hierheen of klik op "Upload Post"
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Maximaal 10MB - Afbeeldingen en PDF bestanden
        </p>
      </div>

      {filteredPosts.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Geen post gevonden"
          description="Upload een foto van een brief om te beginnen"
        />
      ) : (
        <div className="grid gap-4">
          {filteredPosts.map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {post.fileUrl && (
                    <a
                      href={post.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                    >
                      {post.fileName.endsWith('.pdf') ? (
                        <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
                          <FileText className="h-8 w-8 text-red-600" />
                        </div>
                      ) : (
                        <img
                          src={post.fileUrl}
                          alt={post.subject}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </a>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {post.subject}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Van: {post.sender}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(post.status)}`}>
                      {getStatusLabel(post.status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(post.receivedDate)}
                    </div>
                    {post.amount && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(post.amount)}
                      </div>
                    )}
                    {post.requiresAction && (
                      <div className="flex items-center gap-1 text-orange-600">
                        <AlertCircle className="h-4 w-4" />
                        Actie vereist
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    {post.status !== 'processed' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={CheckCircle}
                        onClick={() => handleMarkAsProcessed(post)}
                      >
                        Markeer als verwerkt
                      </Button>
                    )}
                    {!post.relatedTaskId && post.requiresAction && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Plus}
                        onClick={() => handleCreateTaskFromPost(post)}
                      >
                        Maak taak aan
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Eye}
                      onClick={() => {
                        setSelectedPost(post);
                        setShowDetailModal(true);
                      }}
                    >
                      Details
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Trash2}
                      onClick={() => handleDeletePost(post)}
                    >
                      Verwijder
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          resetForm();
        }}
        title="Post Uploaden"
      >
        <div className="space-y-4">
          {uploadedFileUrl && (
            <div className="border rounded-lg p-4">
              {uploadedFile?.type === 'application/pdf' ? (
                <div className="flex items-center gap-3">
                  <FileText className="h-12 w-12 text-red-600" />
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">PDF Document</p>
                  </div>
                </div>
              ) : (
                <img src={uploadedFileUrl} alt="Preview" className="max-h-64 mx-auto rounded" />
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Afzender *
            </label>
            <input
              type="text"
              value={formData.sender}
              onChange={(e) => setFormData({ ...formData, sender: e.target.value })}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              placeholder="Bijv. Belastingdienst"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Onderwerp/Beschrijving *
            </label>
            <textarea
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              rows={3}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              placeholder="Waar gaat de brief over?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Ontvangstdatum *
              </label>
              <input
                type="date"
                value={formData.receivedDate}
                onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Prioriteit
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="low">Laag</option>
                <option value="medium">Normaal</option>
                <option value="high">Hoog</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Te betalen bedrag (optioneel)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Vervaldatum (optioneel)
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiresAction}
                onChange={(e) => setFormData({ ...formData, requiresAction: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Deze post vereist een handeling
              </span>
            </label>

            {formData.requiresAction && (
              <div className="mt-4 space-y-3 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Type handeling
                  </label>
                  <select
                    value={formData.actionType}
                    onChange={(e) => setFormData({ ...formData, actionType: e.target.value as PostActionType })}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">Selecteer type...</option>
                    <option value="payment_required">Betaling vereist</option>
                    <option value="create_task">Taak aanmaken</option>
                    <option value="file_document">Document archiveren</option>
                    <option value="respond">Reactie vereist</option>
                    <option value="forward">Doorsturen</option>
                    <option value="other">Anders</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Beschrijving handeling
                  </label>
                  <textarea
                    value={formData.actionDescription}
                    onChange={(e) => setFormData({ ...formData, actionDescription: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                    placeholder="Wat moet er gebeuren?"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowUploadModal(false);
                resetForm();
              }}
            >
              Annuleren
            </Button>
            <Button onClick={handleSubmitPost} disabled={uploading}>
              {uploading ? 'Uploaden...' : 'Opslaan'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Post Details"
        size="lg"
      >
        {selectedPost && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-300">Afzender</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{selectedPost.sender}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-300">Status</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(selectedPost.status)}`}>
                    {getStatusLabel(selectedPost.status)}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-300">Onderwerp</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{selectedPost.subject}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-300">Ontvangstdatum</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(selectedPost.receivedDate)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-300">Upload datum</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(selectedPost.uploadDate)}</p>
              </div>
            </div>

            {selectedPost.amount && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-300">Bedrag</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{formatCurrency(selectedPost.amount)}</p>
                </div>
                {selectedPost.dueDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-300">Vervaldatum</label>
                    <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(selectedPost.dueDate)}</p>
                  </div>
                )}
              </div>
            )}

            {selectedPost.actionDescription && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-300">Benodigde handeling</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{selectedPost.actionDescription}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">Document</label>
              <a
                href={selectedPost.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"
              >
                <Eye className="h-4 w-4" />
                Bekijk document
              </a>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskForm({
            title: '',
            description: '',
            priority: 'medium',
            dueDate: '',
            assignedTo: [],
          });
        }}
        title="Taak aanmaken"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Titel *
            </label>
            <input
              type="text"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              placeholder="Taak titel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Beschrijving
            </label>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              rows={4}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              placeholder="Taak beschrijving..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Prioriteit
              </label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="low">Laag</option>
                <option value="medium">Normaal</option>
                <option value="high">Hoog</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Vervaldatum
              </label>
              <input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Toewijzen aan
            </label>
            <select
              multiple
              value={taskForm.assignedTo}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setTaskForm({ ...taskForm, assignedTo: selected });
              }}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              size={4}
            >
              {companyUsers.map(u => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName || u.email}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
              Houd Ctrl/Cmd ingedrukt om meerdere gebruikers te selecteren
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowTaskModal(false);
                setTaskForm({
                  title: '',
                  description: '',
                  priority: 'medium',
                  dueDate: '',
                  assignedTo: [],
                });
              }}
            >
              Annuleren
            </Button>
            <Button onClick={handleSubmitTask}>
              Taak aanmaken
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InkomendePostTab;

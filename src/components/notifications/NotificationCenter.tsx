import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Archive, X, AlertCircle, Info, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationService } from '../../services/notificationService';
import { Notification, NotificationPriority } from '../../types';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (user) {
      loadNotifications();
      loadUnreadCount();
    }
  }, [user, filter]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await NotificationService.getNotifications(user.uid, {
        unreadOnly: filter === 'unread',
        limit: 50,
      });
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!user) return;

    try {
      const count = await NotificationService.getUnreadCount(user.uid);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      await NotificationService.markAsRead(notificationId, user.uid);
      await loadNotifications();
      await loadUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      await NotificationService.markAllAsRead(user.uid);
      await loadNotifications();
      await loadUnreadCount();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleArchive = async (notificationId: string) => {
    if (!user) return;

    try {
      await NotificationService.archiveNotification(notificationId, user.uid);
      await loadNotifications();
      await loadUnreadCount();
    } catch (error) {
      console.error('Error archiving notification:', error);
    }
  };

  const getPriorityIcon = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'high':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'medium':
        return <Info className="h-5 w-5 text-primary-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500 dark:text-gray-300" />;
    }
  };

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-4 border-red-500';
      case 'high':
        return 'border-l-4 border-orange-500';
      case 'medium':
        return 'border-l-4 border-primary-500';
      default:
        return 'border-l-4 border-gray-300 dark:border-gray-600';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Nu';
    if (diffMins < 60) return `${diffMins} min geleden`;
    if (diffHours < 24) return `${diffHours} uur geleden`;
    if (diffDays < 7) return `${diffDays} dagen geleden`;
    return date.toLocaleDateString('nl-NL');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Meldingen"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${ filter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700' }`}
              >
                Alle
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${ filter === 'unread' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700' }`}
              >
                Ongelezen ({unreadCount})
              </button>
            </div>

            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Alles markeren als gelezen
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-600 dark:text-gray-300">
                {filter === 'unread' ? 'Geen ongelezen meldingen' : 'Geen meldingen'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg ${getPriorityColor(notification.priority)} ${ notification.status === 'read' || notification.status === 'archived' ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800' } hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getPriorityIcon(notification.priority)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {notification.title}
                          </h4>
                          {(notification.status === 'pending' || notification.status === 'sent') && (
                            <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-300">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {notification.createdAt ? formatDate(notification.createdAt) : 'Onbekend'}
                          </span>
                          {notification.actionUrl && (
                            <a
                              href={notification.actionUrl}
                              className="text-primary-600 hover:text-primary-700 font-medium"
                              onClick={() => setIsOpen(false)}
                            >
                              {notification.actionLabel || 'Bekijk'}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {(notification.status === 'pending' || notification.status === 'sent') && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-green-600 transition-colors"
                          title="Markeer als gelezen"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleArchive(notification.id)}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                        title="Archiveer"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
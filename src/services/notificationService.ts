import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import {
  Notification,
  NotificationPreferences,
  EmailTemplate,
  NotificationSchedule,
  NotificationCategory,
  NotificationPriority,
} from '../types';

const convertTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.createdAt && typeof converted.createdAt.toDate === 'function') {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.updatedAt && typeof converted.updatedAt.toDate === 'function') {
    converted.updatedAt = converted.updatedAt.toDate();
  }
  if (converted.sentAt && typeof converted.sentAt.toDate === 'function') {
    converted.sentAt = converted.sentAt.toDate();
  }
  if (converted.readAt && typeof converted.readAt.toDate === 'function') {
    converted.readAt = converted.readAt.toDate();
  }
  if (converted.archivedAt && typeof converted.archivedAt.toDate === 'function') {
    converted.archivedAt = converted.archivedAt.toDate();
  }
  if (converted.emailSentAt && typeof converted.emailSentAt.toDate === 'function') {
    converted.emailSentAt = converted.emailSentAt.toDate();
  }
  if (converted.metadata?.deadline && typeof converted.metadata.deadline.toDate === 'function') {
    converted.metadata.deadline = converted.metadata.deadline.toDate();
  }

  return converted;
};

const convertToTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.createdAt instanceof Date) {
    converted.createdAt = Timestamp.fromDate(converted.createdAt);
  }
  if (converted.updatedAt instanceof Date) {
    converted.updatedAt = Timestamp.fromDate(converted.updatedAt);
  }
  if (converted.sentAt instanceof Date) {
    converted.sentAt = Timestamp.fromDate(converted.sentAt);
  }
  if (converted.readAt instanceof Date) {
    converted.readAt = Timestamp.fromDate(converted.readAt);
  }
  if (converted.archivedAt instanceof Date) {
    converted.archivedAt = Timestamp.fromDate(converted.archivedAt);
  }
  if (converted.emailSentAt instanceof Date) {
    converted.emailSentAt = Timestamp.fromDate(converted.emailSentAt);
  }
  if (converted.metadata?.deadline instanceof Date) {
    converted.metadata.deadline = Timestamp.fromDate(converted.metadata.deadline);
  }

  return converted;
};

export class NotificationService {

  static async createNotification(
    userId: string,
    notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    // Verrijk channels op basis van device-tokens. Als er tokens zijn voor
    // deze user, voeg 'push' toe als het nog niet inzit.
    const finalChannels = Array.from(new Set(notification.channels));
    try {
      if (!finalChannels.includes('push')) {
        const hasTokens = await this.userHasFcmTokens(userId);
        if (hasTokens) finalChannels.push('push');
      }
    } catch {
      // stilletjes doorgaan — push is een nice-to-have bovenop in_app/email
    }

    const notificationData = convertToTimestamps({
      ...notification,
      channels: finalChannels,
      userId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);

    if (finalChannels.includes('in_app')) {
      await this.sendInAppNotification(docRef.id);
    }

    if (finalChannels.includes('email')) {
      await this.sendEmailNotification(docRef.id);
    }

    if (finalChannels.includes('push')) {
      await this.sendPushNotification(userId, {
        title: notification.title,
        body: notification.message,
        url: notification.actionUrl,
        taskId: notification.metadata?.entityId,
        category: notification.category,
      }).catch(err => console.warn('[Notifications] push mislukt:', err));
    }

    return docRef.id;
  }

  /**
   * Check of er minimaal 1 FCM token staat voor deze user.
   */
  private static async userHasFcmTokens(userId: string): Promise<boolean> {
    const snap = await getDocs(
      query(collection(db, 'users', userId, 'fcmTokens'), firestoreLimit(1))
    );
    return !snap.empty;
  }

  /**
   * Roep de Netlify send-push function aan. Vereist een ingelogde user
   * (voor ID token auth). Faalt stil als fetch niet beschikbaar of error.
   */
  private static async sendPushNotification(
    targetUserId: string,
    payload: {
      title: string;
      body: string;
      url?: string;
      taskId?: string;
      category?: string;
    }
  ): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Push gaat via onze eigen PHP proxy op internedata.nl. Die heeft de
    // Firebase service account JSON lokaal (buiten webroot, afgeschermd via
    // .htaccess) en authenticeert richting FCM met JWT.
    const response = await fetch('https://internedata.nl/fcm-send.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIds: [targetUserId],
        title: payload.title,
        body: payload.body,
        url: payload.url,
        taskId: payload.taskId,
        category: payload.category,
      }),
    });

    if (!response.ok) {
      // 503 = server niet geconfigureerd, 401 = token issue → beide graceful:
      // push is nice-to-have bovenop in_app. Niet als error loggen.
      if (response.status === 503 || response.status === 401) return;
      const text = await response.text().catch(() => '');
      console.warn(`[Notifications] send-push ${response.status}: ${text}`);
    }
  }

  static async getNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      category?: NotificationCategory;
    }
  ): Promise<Notification[]> {
    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    if (options?.unreadOnly) {
      q = query(q, where('status', 'in', ['pending', 'sent']));
    }

    if (options?.category) {
      q = query(q, where('category', '==', options.category));
    }

    if (options?.limit) {
      q = query(q, firestoreLimit(options.limit));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data()),
    } as Notification));
  }

  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('Unauthorized');
    }

    await updateDoc(docRef, {
      status: 'read',
      readAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  static async markAllAsRead(userId: string): Promise<void> {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('status', 'in', ['pending', 'sent'])
    );

    const querySnapshot = await getDocs(q);
    const updatePromises = querySnapshot.docs.map(document =>
      updateDoc(doc(db, 'notifications', document.id), {
        status: 'read',
        readAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      })
    );

    await Promise.all(updatePromises);
  }

  static async archiveNotification(notificationId: string, userId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('Unauthorized');
    }

    await updateDoc(docRef, {
      status: 'archived',
      archivedAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('status', 'in', ['pending', 'sent'])
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  }

  private static async sendInAppNotification(notificationId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, {
      status: 'sent',
      sentAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  private static async sendEmailNotification(notificationId: string): Promise<void> {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Notification not found');
      }

      await updateDoc(docRef, {
        emailSent: true,
        emailSentAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, {
        emailSent: false,
        emailError: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: Timestamp.fromDate(new Date()),
      });
    }
  }

  static async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    const q = query(
      collection(db, 'notificationPreferences'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return this.createDefaultPreferences(userId);
    }

    const doc = querySnapshot.docs; // Get the first document
    return {
      id: doc.id,
      ...convertTimestamps(doc.data()),
    } as NotificationPreferences;
  }

  static async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    const q = query(
      collection(db, 'notificationPreferences'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);

    const updateData = convertToTimestamps({
      ...preferences,
      updatedAt: new Date(),
    });

    if (querySnapshot.empty) {
      await addDoc(collection(db, 'notificationPreferences'), {
        userId,
        ...updateData,
      });
    } else {
      const docRef = doc(db, 'notificationPreferences', querySnapshot.docs.id); // Use the ID of the existing document
      await updateDoc(docRef, updateData);
    }
  }

  private static async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const defaultPreferences: NotificationPreferences = {
      userId,
      email: {
        enabled: true,
        payrollNotifications: true,
        taxReturnNotifications: true,
        contractNotifications: true,
        leaveNotifications: true,
        expenseNotifications: true,
        complianceAlerts: true,
        systemUpdates: false,
      },
      inApp: {
        enabled: true,
        showBadge: true,
        playSound: true,
      },
      push: {
        enabled: false,
      },
      digestFrequency: 'immediate',
      updatedAt: new Date(),
    };

    await addDoc(collection(db, 'notificationPreferences'), convertToTimestamps(defaultPreferences));
    return defaultPreferences;
  }

  static async notifyPayrollApproval(
    userId: string,
    employeeName: string,
    amount: number,
    payrollId: string
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'payroll',
      category: 'payroll_approval',
      priority: 'high',
      title: 'Loonverwerking Gereed',
      message: `Loonverwerking voor ${employeeName} (€${amount.toFixed(2)}) is gereed voor goedkeuring.`,
      actionUrl: `/payroll/${payrollId}`,
      actionLabel: 'Bekijk',
      channels: ['in_app', 'email'],
      metadata: {
        entityId: payrollId,
        entityType: 'payroll',
        amount,
      },
    });
  }

  static async notifyTaxDeadline(
    userId: string,
    year: number,
    period: number,
    deadline: Date
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'tax_return',
      category: 'tax_deadline',
      priority: 'urgent',
      title: 'Belastingaangifte Deadline',
      message: `De deadline voor de loonaangifte ${period}/${year} is ${deadline.toLocaleDateString('nl-NL')}.`,
      actionUrl: '/tax-returns',
      actionLabel: 'Indienen',
      channels: ['in_app', 'email'],
      metadata: {
        deadline,
      },
    });
  }

  static async notifyContractExpiring(
    userId: string,
    employeeName: string,
    endDate: Date,
    employeeId: string
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'contract',
      category: 'contract_expiring',
      priority: 'high',
      title: 'Contract Loopt Af',
      message: `Het contract van ${employeeName} loopt af op ${endDate.toLocaleDateString('nl-NL')}.`,
      actionUrl: `/employees/${employeeId}`,
      actionLabel: 'Bekijk',
      channels: ['in_app', 'email'],
      metadata: {
        entityId: employeeId,
        entityType: 'employee',
        deadline: endDate,
      },
    });
  }

  static async notifyLeaveRequest(
    userId: string,
    employeeName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    leaveRequestId: string
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'leave',
      category: 'leave_request',
      priority: 'medium',
      title: 'Nieuwe Verlofaanvraag',
      message: `${employeeName} heeft ${leaveType} aangevraagd van ${startDate.toLocaleDateString('nl-NL')} tot ${endDate.toLocaleDateString('nl-NL')}.`,
      actionUrl: `/admin/leave-approvals`,
      actionLabel: 'Beoordelen',
      channels: ['in_app', 'email'],
      metadata: {
        entityId: leaveRequestId,
        entityType: 'leave_request',
      },
    });
  }

  static async notifyExpenseSubmitted(
    userId: string,
    employeeName: string,
    amount: number,
    expenseType: string,
    expenseId: string
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'expense',
      category: 'expense_submitted',
      priority: 'medium',
      title: 'Nieuwe Declaratie',
      message: `${employeeName} heeft een ${expenseType} declaratie ingediend van €${amount.toFixed(2)}.`,
      actionUrl: `/admin/expenses`,
      actionLabel: 'Beoordelen',
      channels: ['in_app', 'email'],
      metadata: {
        entityId: expenseId,
        entityType: 'expense',
        amount,
      },
    });
  }

  static async notifyTaskAssigned(
    userId: string,
    taskTitle: string,
    assignedBy: string,
    taskId: string
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'task',
      category: 'task_assigned',
      priority: 'medium',
      title: 'Nieuwe taak toegewezen',
      message: `Je hebt een nieuwe taak ontvangen: "${taskTitle}". Plan deze in via je agenda.`,
      actionUrl: '/employee-dashboard/agenda',
      actionLabel: 'Naar agenda',
      channels: ['in_app'],
      metadata: {
        entityId: taskId,
        entityType: 'task',
        assignedBy,
      },
    });
  }

  /**
   * Stuur naar meerdere users tegelijk. Faalt per user niet — logt wel.
   */
  static async notifyTaskAssignedBulk(
    userIds: string[],
    taskTitle: string,
    assignedBy: string,
    taskId: string
  ): Promise<void> {
    await Promise.all(
      userIds.map(uid =>
        this.notifyTaskAssigned(uid, taskTitle, assignedBy, taskId).catch(err =>
          console.error(`[Notifications] task_assigned naar ${uid} mislukt:`, err)
        )
      )
    );
  }

  /**
   * Melding voor manager/admin dat een auto APK/onderhoud nodig heeft.
   * Voor elke ontvanger faalt het niet hard.
   */
  static async notifyVehicleMaintenance(
    userIds: string[],
    kind: 'APK' | 'Onderhoud',
    kenteken: string,
    driverName: string,
    dateStr: string,
    vehicleId?: string
  ): Promise<void> {
    await Promise.all(
      Array.from(new Set(userIds)).map(uid =>
        this.createNotification(uid, {
          userId: uid,
          type: 'system',
          category: 'system_update',
          priority: 'high',
          title: `${kind} actie: ${kenteken}`,
          message: `${kind} voor ${kenteken} (${driverName}) staat gepland rond ${dateStr}. Er is een taak aangemaakt voor de monteur — plan de afspraak met de garage in.`,
          actionUrl: '/auto-beheer',
          actionLabel: 'Open Auto Beheer',
          channels: ['in_app'],
          metadata: { entityId: vehicleId, entityType: 'vehicle' },
        }).catch(err => console.error(`[Notifications] vehicle maintenance naar ${uid} mislukt:`, err))
      )
    );
  }

  /**
   * Stuurt een "taak voltooid" melding naar alle ontvangers (opdrachtgever
   * + mede-toegewezenen). actionUrl leidt naar de taken pagina.
   */
  static async notifyTaskCompleted(
    userIds: string[],
    taskTitle: string,
    completedByName: string,
    taskId: string
  ): Promise<void> {
    await Promise.all(
      userIds.map(uid =>
        this.createNotification(uid, {
          userId: uid,
          type: 'task',
          category: 'task_completed',
          priority: 'low',
          title: 'Taak voltooid',
          message: `${completedByName} heeft "${taskTitle}" afgerond.`,
          actionUrl: '/tasks',
          actionLabel: 'Bekijk taak',
          channels: ['in_app'],
          metadata: {
            entityId: taskId,
            entityType: 'task',
            completedByName,
          },
        }).catch(err =>
          console.error(`[Notifications] task_completed naar ${uid} mislukt:`, err)
        )
      )
    );
  }

  static async notifyTaskScheduleReminder(
    userId: string,
    unscheduledCount: number,
    reminderLevel: 'light' | 'strong'
  ): Promise<void> {
    const isStrong = reminderLevel === 'strong';
    await this.createNotification(userId, {
      userId,
      type: 'task',
      category: 'task_schedule_reminder',
      priority: isStrong ? 'high' : 'medium',
      title: isStrong ? 'Morgen is de deadline!' : 'Taken inplannen',
      message: isStrong
        ? `Plan je ${unscheduledCount} openstaande ${unscheduledCount === 1 ? 'taak' : 'taken'} in voor morgen (vrijdag) 19:00.`
        : `Je hebt ${unscheduledCount} ${unscheduledCount === 1 ? 'taak' : 'taken'} die nog ingepland ${unscheduledCount === 1 ? 'moet' : 'moeten'} worden deze week.`,
      actionUrl: '/employee-dashboard/agenda',
      actionLabel: 'Naar agenda',
      channels: ['in_app'],
      metadata: {
        unscheduledCount,
        reminderLevel,
      },
    });
  }

  static async notifyTaskScheduleOverdue(
    userId: string,
    unscheduledCount: number
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'task',
      category: 'task_schedule_overdue',
      priority: 'urgent',
      title: 'Deadline verstreken!',
      message: `${unscheduledCount} ${unscheduledCount === 1 ? 'taak is' : 'taken zijn'} niet ingepland voor de vrijdag 19:00 deadline. Neem contact op met je leidinggevende.`,
      actionUrl: '/employee-dashboard/agenda',
      actionLabel: 'Naar agenda',
      channels: ['in_app'],
      metadata: {
        unscheduledCount,
      },
    });
  }
}
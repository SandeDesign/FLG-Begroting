import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Company, Branch, Employee, TimeEntry, UserRole, LeaveRequest, LeaveBalance, SickLeave, AbsenceStatistics, Expense, EmployeeWithCompanies, CompanyWithEmployees, UserSettings, BudgetItem, BudgetType } from '../types';
import { generatePoortwachterMilestones, shouldActivatePoortwachter } from '../utils/poortwachterTracking';
import { AuditService } from './auditService';

// Helper function to remove undefined values from objects (Firebase doesn't accept undefined)
const removeUndefinedValues = (obj: any): any => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues);
  }
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedValues(value);
    }
  }
  return cleaned;
};

// Helper function to recursively convert Firestore timestamps to Date objects
const convertTimestamps = (data: any): any => {
  if (data === null || data === undefined) return data;

  // Convert Firestore Timestamp to Date
  if (typeof data.toDate === 'function') {
    return data.toDate();
  }

  // Handle serialized Firestore Timestamps (objects with seconds/nanoseconds)
  if (typeof data === 'object' && !Array.isArray(data) && data.seconds !== undefined && data.nanoseconds !== undefined && Object.keys(data).length === 2) {
    return new Date(data.seconds * 1000 + data.nanoseconds / 1000000);
  }

  // Recursively convert arrays
  if (Array.isArray(data)) {
    return data.map(item => convertTimestamps(item));
  }

  // Recursively convert objects
  if (typeof data === 'object' && !(data instanceof Date)) {
    const converted: any = {};
    for (const key of Object.keys(data)) {
      converted[key] = convertTimestamps(data[key]);
    }
    return converted;
  }

  return data;
};

// Helper function to recursively convert Date objects to Firestore timestamps
const convertToTimestamps = (data: any): any => {
  if (data === null || data === undefined) return data;

  // Convert Date to Firestore Timestamp
  if (data instanceof Date) {
    return Timestamp.fromDate(data);
  }

  // Recursively convert arrays
  if (Array.isArray(data)) {
    return data.map(item => convertToTimestamps(item));
  }

  // Recursively convert objects
  if (typeof data === 'object') {
    const converted: any = {};
    for (const key of Object.keys(data)) {
      converted[key] = convertToTimestamps(data[key]);
    }
    return converted;
  }

  return data;
};

// Companies
export const getCompanies = async (userId: string): Promise<Company[]> => {
  const q = query(
    collection(db, 'companies'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Company));
};

// Get companies with filtering by type
export const getCompaniesByType = async (userId: string, companyType?: 'employer' | 'project'): Promise<Company[]> => {
  let q;
  
  if (companyType) {
    q = query(
      collection(db, 'companies'),
      where('userId', '==', userId),
      where('companyType', '==', companyType),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'companies'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Company));
};

export const getCompany = async (id: string, userId: string): Promise<Company | null> => {
  const docRef = doc(db, 'companies', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  if (data.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return {
    id: docSnap.id,
    ...convertTimestamps(data)
  } as Company;
};

// ✅ NEW: Get company without userId check (for managers loading their assigned company)
export const getCompanyById = async (id: string): Promise<Company | null> => {
  const docRef = doc(db, 'companies', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...convertTimestamps(docSnap.data())
  } as Company;
};

// Updated createCompany with undefined value filtering
export const createCompany = async (userId: string, company: Omit<Company, 'id' | 'userId'>): Promise<string> => {
  // Validate project company has primaryEmployerId
  if (company.companyType === 'project' && !company.primaryEmployerId) {
    throw new Error('Project companies must have a primaryEmployerId');
  }
  
  // Validate primary employer exists and is owned by same user
  if (company.companyType === 'project' && company.primaryEmployerId) {
    const primaryEmployer = await getCompany(company.primaryEmployerId, userId);
    if (!primaryEmployer || primaryEmployer.companyType !== 'employer') {
      throw new Error('Invalid primary employer');
    }
  }
  
  const companyData = convertToTimestamps({
    ...company,
    userId,
    companyType: company.companyType || 'employer', // Default to employer
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Remove undefined values before sending to Firebase
  const cleanedData = removeUndefinedValues(companyData);
  
  const docRef = await addDoc(collection(db, 'companies'), cleanedData);
  return docRef.id;
};

// Updated updateCompany with undefined value filtering
export const updateCompany = async (id: string, userId: string, updates: Partial<Company>): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'companies', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });
  
  // Remove undefined values before sending to Firebase
  const cleanedData = removeUndefinedValues(updateData);
  
  await updateDoc(docRef, cleanedData);
};

export const deleteCompany = async (id: string, userId: string): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'companies', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  await deleteDoc(docRef);
};

// Branches
export const getBranches = async (userId: string, companyId?: string): Promise<Branch[]> => {
  let q;
  if (companyId) {
    q = query(
      collection(db, 'branches'),
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'branches'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Branch));
};

export const createBranch = async (userId: string, branch: Omit<Branch, 'id' | 'userId'>): Promise<string> => {
  const branchData = convertToTimestamps({
    ...branch,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(branchData);
  const docRef = await addDoc(collection(db, 'branches'), cleanedData);
  return docRef.id;
};

export const updateBranch = async (id: string, userId: string, updates: Partial<Branch>): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'branches', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

export const deleteBranch = async (id: string, userId: string): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'branches', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  await deleteDoc(docRef);
};

// Employees
export const getEmployees = async (userId: string, companyId?: string, branchId?: string): Promise<Employee[]> => {
  let q;

  if (companyId && branchId) {
    q = query(
      collection(db, 'employees'),
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      where('branchId', '==', branchId),
      orderBy('createdAt', 'desc')
    );
  } else if (companyId) {
    q = query(
      collection(db, 'employees'),
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'employees'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  const employees = querySnapshot.docs.map(empDoc => ({
    id: empDoc.id,
    ...convertTimestamps(empDoc.data())
  } as Employee));

  // Sync hasAccount: controleer of werknemers zonder hasAccount toch een account hebben
  const employeesWithoutAccount = employees.filter(emp => !emp.hasAccount);
  if (employeesWithoutAccount.length > 0) {
    const empIds = employeesWithoutAccount.map(emp => emp.id);
    const linkedEmpIds = new Set<string>();

    for (let i = 0; i < empIds.length; i += 30) {
      const batch = empIds.slice(i, i + 30);
      const uQ = query(collection(db, 'users'), where('employeeId', 'in', batch));
      const uSnapshot = await getDocs(uQ);
      for (const uDoc of uSnapshot.docs) {
        const empId = uDoc.data().employeeId;
        if (empId) linkedEmpIds.add(empId);
      }
    }

    // Repareer employees die wél een account blijken te hebben
    for (const emp of employeesWithoutAccount) {
      if (linkedEmpIds.has(emp.id)) {
        emp.hasAccount = true;
        const empRef = doc(db, 'employees', emp.id);
        updateDoc(empRef, {
          hasAccount: true,
          updatedAt: Timestamp.fromDate(new Date())
        }).catch(err => console.error('Error syncing hasAccount:', err));
      }
    }
  }

  return employees;
};

// Get employees with their project companies populated
export const getEmployeesWithProjectCompanies = async (userId: string, companyId?: string): Promise<EmployeeWithCompanies[]> => {
  const employees = await getEmployees(userId, companyId);
  const companies = await getCompanies(userId);
  
  return employees.map(employee => ({
    ...employee,
    primaryEmployer: companies.find(c => c.id === employee.companyId),
    projectCompaniesData: employee.projectCompanies?.map(pcId => 
      companies.find(c => c.id === pcId)
    ).filter(Boolean) || []
  }));
};

export const getEmployee = async (id: string, userId: string): Promise<Employee | null> => {
  const docRef = doc(db, 'employees', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  if (data.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return {
    id: docSnap.id,
    ...convertTimestamps(data)
  } as Employee;
};

// Updated createEmployee with project companies support
export const createEmployee = async (userId: string, employee: Omit<Employee, 'id' | 'userId'>): Promise<string> => {
  // Validate primary company exists and is owned by user
  const primaryCompany = await getCompany(employee.companyId, userId);
  if (!primaryCompany) {
    throw new Error('Invalid primary company');
  }
  
  // Validate project companies exist and are owned by user
  if (employee.projectCompanies && employee.projectCompanies.length > 0) {
    const projectCompanies = await Promise.all(
      employee.projectCompanies.map(pcId => getCompany(pcId, userId))
    );
    
    if (projectCompanies.some(pc => !pc)) {
      throw new Error('One or more project companies are invalid');
    }
    
    // Ensure all project companies are actually project type
    if (projectCompanies.some(pc => pc?.companyType !== 'project')) {
      throw new Error('All project companies must be of type "project"');
    }
  }
  
  const employeeData = convertToTimestamps({
    ...employee,
    userId,
    projectCompanies: employee.projectCompanies || [], // Ensure array exists
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(employeeData);
  const docRef = await addDoc(collection(db, 'employees'), cleanedData);
  return docRef.id;
};

// Updated updateEmployee with project companies support
export const updateEmployee = async (id: string, userId: string, updates: Partial<Employee>): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'employees', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  // Validate project companies if they're being updated
  if (updates.projectCompanies) {
    const projectCompanies = await Promise.all(
      updates.projectCompanies.map(pcId => getCompany(pcId, userId))
    );
    
    if (projectCompanies.some(pc => !pc || pc.companyType !== 'project')) {
      throw new Error('All project companies must be valid and of type "project"');
    }
  }
  
  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

export const deleteEmployee = async (id: string, userId: string): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'employees', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Employee not found');
  }
  
  const employeeData = docSnap.data();
  if (!employeeData || !employeeData.userId || typeof employeeData.userId !== 'string' || employeeData.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  await deleteDoc(docRef);
};

// Get employee by ID without userId check (for employee self-access)
export const getEmployeeById = async (employeeId: string): Promise<Employee | null> => {
  const docRef = doc(db, 'employees', employeeId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...convertTimestamps(docSnap.data())
  } as Employee;
};

// Get employees for a specific project company
export const getEmployeesForProjectCompany = async (userId: string, projectCompanyId: string): Promise<Employee[]> => {
  const q = query(
    collection(db, 'employees'),
    where('userId', '==', userId),
    where('projectCompanies', 'array-contains', projectCompanyId)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Employee));
};

// Time Entries
export const getTimeEntries = async (userId: string, employeeId?: string, dateRange?: { start: Date; end: Date }): Promise<TimeEntry[]> => {
  let q;
  
  if (employeeId) {
    q = query(
      collection(db, 'timeEntries'),
      where('userId', '==', userId),
      where('employeeId', '==', employeeId),
      orderBy('date', 'desc')
    );
  } else {
    q = query(
      collection(db, 'timeEntries'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
  }
  
  const querySnapshot = await getDocs(q);
  let entries = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as TimeEntry));
  
  // Filter by date range if provided
  if (dateRange) {
    entries = entries.filter(entry => 
      entry.date >= dateRange.start && entry.date <= dateRange.end
    );
  }
  
  return entries;
};

export const createTimeEntry = async (userId: string, timeEntry: Omit<TimeEntry, 'id' | 'userId'>): Promise<string> => {
  const entryData = convertToTimestamps({
    ...timeEntry,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(entryData);
  const docRef = await addDoc(collection(db, 'timeEntries'), cleanedData);
  return docRef.id;
};

// Create time entry with work company support
export const createTimeEntryWithWorkCompany = async (
  userId: string, 
  timeEntry: Omit<TimeEntry, 'id' | 'userId'>
): Promise<string> => {
  // Validate work company if specified
  if (timeEntry.workCompanyId) {
    const workCompany = await getCompany(timeEntry.workCompanyId, userId);
    if (!workCompany) {
      throw new Error('Invalid work company');
    }
    
    // Verify employee is allowed to work for this company
    const employee = await getEmployee(timeEntry.employeeId, userId);
    if (!employee) {
      throw new Error('Invalid employee');
    }
    
    const allowedCompanies = [employee.companyId, ...(employee.projectCompanies || [])];
    if (!allowedCompanies.includes(timeEntry.workCompanyId)) {
      throw new Error('Employee is not authorized to work for this company');
    }
  }
  
  const timeEntryData = convertToTimestamps({
    ...timeEntry,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(timeEntryData);
  const docRef = await addDoc(collection(db, 'timeEntries'), cleanedData);
  return docRef.id;
};

export const updateTimeEntry = async (id: string, userId: string, updates: Partial<TimeEntry>): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'timeEntries', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

// User Roles
export const createUserRole = async (
  uid: string,
  role: 'admin' | 'manager' | 'employee',
  employeeId?: string,
  userData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    assignedCompanyId?: string;
    adminUserId?: string;
  }
): Promise<void> => {
  const roleData = convertToTimestamps({
    uid,
    role,
    employeeId: employeeId || null,
    adminUserId: userData?.adminUserId || null,
    firstName: userData?.firstName || '',
    lastName: userData?.lastName || '',
    email: userData?.email || '',
    ...(role === 'manager' && { assignedCompanyId: userData?.assignedCompanyId || null }),
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(roleData);
  await addDoc(collection(db, 'users'), cleanedData);
};

export const getUserRole = async (uid: string): Promise<UserRole | null> => {
  const q = query(
    collection(db, 'users'),
    where('uid', '==', uid)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as UserRole;
};

// Employee Account Management
export const createEmployeeAuthAccount = async (
  employeeId: string, 
  userId: string, 
  email: string, 
  password: string
): Promise<string> => {
  try {
    // First verify ownership of the employee record
    const employeeRef = doc(db, 'employees', employeeId);
    const employeeSnap = await getDoc(employeeRef);
    
    if (!employeeSnap.exists() || employeeSnap.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUserId = userCredential.user.uid;
    
    // Update employee record to mark as having account
    const updateData = convertToTimestamps({
      hasAccount: true,
      accountCreatedAt: new Date(),
      updatedAt: new Date()
    });
    
    const cleanedData = removeUndefinedValues(updateData);
    await updateDoc(employeeRef, cleanedData);
    
    // Create user role for the new employee
    const employee = await getEmployee(employeeId, userId);
    await createUserRole(newUserId, 'employee', employeeId, {
      firstName: employee?.personalInfo.firstName,
      lastName: employee?.personalInfo.lastName,
      email: employee?.personalInfo.contactInfo.email,
      adminUserId: userId,
    });

    // Voeg de nieuwe user toe aan allowedUsers van het bedrijf
    const employeeData = employeeSnap.data();
    if (employeeData.companyId) {
      const companyRef = doc(db, 'companies', employeeData.companyId);
      await updateDoc(companyRef, {
        allowedUsers: arrayUnion(newUserId)
      });
    }

    return newUserId;
  } catch (error) {
    console.error('Error creating employee account:', error);
    throw error;
  }
};

// Generate secure password
export const generateSecurePassword = (): string => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// ✅ NIEUW: Save temporary credentials (for employee account creation)
export const saveTemporaryCredentials = async (
  employeeId: string,
  email: string,
  password: string
): Promise<void> => {
  try {
    // Store temporary credentials in a separate collection for later use
    const credentialsData = convertToTimestamps({
      employeeId,
      email,
      password, // Note: In production, encrypt this before storing
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
    });

    const cleanedData = removeUndefinedValues(credentialsData);
    await addDoc(collection(db, 'temporaryCredentials'), cleanedData);
  } catch (error) {
    console.error('Error saving temporary credentials:', error);
    throw error;
  }
};

// Leave Requests
export const getLeaveRequests = async (adminUserId: string, employeeId?: string): Promise<LeaveRequest[]> => {
  let q;

  if (employeeId) {
    q = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', adminUserId),
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', adminUserId),
      orderBy('createdAt', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  const requests = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as LeaveRequest));
  
  return requests;
};

export const createLeaveRequest = async (adminUserId: string, request: Omit<LeaveRequest, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  
  const requestData = convertToTimestamps({
    ...request,
    userId: adminUserId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(requestData);
  const docRef = await addDoc(collection(db, 'leaveRequests'), cleanedData);
  return docRef.id;
};

export const updateLeaveRequest = async (id: string, userId: string, updates: Partial<LeaveRequest>): Promise<void> => {
  const docRef = doc(db, 'leaveRequests', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

export const approveLeaveRequest = async (id: string, userId: string, approvedBy: string): Promise<void> => {
  await updateLeaveRequest(id, userId, {
    status: 'approved',
    approvedBy,
    approvedAt: new Date()
  });
};

export const rejectLeaveRequest = async (id: string, userId: string, approvedBy: string, reason: string): Promise<void> => {
  await updateLeaveRequest(id, userId, {
    status: 'rejected',
    approvedBy,
    rejectedReason: reason
  });
};

export const getPendingLeaveApprovals = async (companyId: string, userId: string): Promise<LeaveRequest[]> => {
  const q = query(
    collection(db, 'leaveRequests'),
    where('userId', '==', userId),
    where('companyId', '==', companyId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as LeaveRequest));
};

// Leave Balance
export const getLeaveBalance = async (employeeId: string, userId: string, year: number): Promise<LeaveBalance | null> => {
  const q = query(
    collection(db, 'leaveBalances'),
    where('employeeId', '==', employeeId),
    where('year', '==', year)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return null;

  const docData = querySnapshot.docs[0];
  return {
    id: docData.id,
    ...convertTimestamps(docData.data())
  } as LeaveBalance;
};

export const updateLeaveBalance = async (employeeId: string, userId: string, year: number, balance: Partial<LeaveBalance>): Promise<void> => {
  const q = query(
    collection(db, 'leaveBalances'),
    where('employeeId', '==', employeeId),
    where('year', '==', year)
  );

  const querySnapshot = await getDocs(q);
  const balanceData = convertToTimestamps({
    ...balance,
    employeeId,
    year,
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(balanceData);

  if (querySnapshot.empty) {
    await addDoc(collection(db, 'leaveBalances'), cleanedData);
  } else {
    const docRef = doc(db, 'leaveBalances', querySnapshot.docs[0].id);
    await updateDoc(docRef, cleanedData);
  }
};

// Sick Leave
export const getSickLeaveRecords = async (adminUserId: string, employeeId?: string): Promise<SickLeave[]> => {
  let q;

  if (employeeId) {
    q = query(
      collection(db, 'sickLeave'),
      where('userId', '==', adminUserId),
      where('employeeId', '==', employeeId),
      orderBy('startDate', 'desc')
    );
  } else {
    q = query(
      collection(db, 'sickLeave'),
      where('userId', '==', adminUserId),
      orderBy('startDate', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  const records = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as SickLeave));
  
  return records;
};

export const createSickLeave = async (adminUserId: string, sickLeave: Omit<SickLeave, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  
  const shouldActivate = shouldActivatePoortwachter(sickLeave.startDate);
  const milestones = shouldActivate ? generatePoortwachterMilestones(sickLeave.startDate) : null;

  const sickLeaveData = convertToTimestamps({
    ...sickLeave,
    userId: adminUserId,
    poortwachterActive: shouldActivate,
    poortwachterMilestones: milestones,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(sickLeaveData);
  const docRef = await addDoc(collection(db, 'sickLeave'), cleanedData);
  return docRef.id;
};

export const updateSickLeave = async (id: string, userId: string, updates: Partial<SickLeave>): Promise<void> => {
  const docRef = doc(db, 'sickLeave', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

export const getActiveSickLeave = async (companyId: string, userId: string): Promise<SickLeave[]> => {
  const q = query(
    collection(db, 'sickLeave'),
    where('userId', '==', userId),
    where('companyId', '==', companyId),
    where('status', 'in', ['active', 'partially_recovered']),
    orderBy('startDate', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as SickLeave));
};

// Absence Statistics
export const getAbsenceStatistics = async (employeeId: string, userId: string, year: number): Promise<AbsenceStatistics | null> => {
  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31);

  const q = query(
    collection(db, 'absenceStatistics'),
    where('employeeId', '==', employeeId),
    where('period', '==', 'year'),
    where('periodStart', '>=', Timestamp.fromDate(periodStart)),
    where('periodEnd', '<=', Timestamp.fromDate(periodEnd))
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return null;

  const docData = querySnapshot.docs[0];
  return {
    id: docData.id,
    ...convertTimestamps(docData.data())
  } as AbsenceStatistics;
};

export const calculateAbsenceStats = async (employeeId: string, companyId: string, userId: string, year: number): Promise<void> => {
  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31);

  const q = query(
    collection(db, 'sickLeave'),
    where('userId', '==', userId),
    where('employeeId', '==', employeeId),
    where('startDate', '>=', Timestamp.fromDate(periodStart)),
    where('startDate', '<=', Timestamp.fromDate(periodEnd))
  );

  const querySnapshot = await getDocs(q);
  const sickLeaves = querySnapshot.docs.map(doc => convertTimestamps(doc.data()) as SickLeave);

  const totalSickDays = sickLeaves.reduce((sum, leave) => {
    const start = leave.startDate;
    const end = leave.endDate || new Date();
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);

  const absenceFrequency = sickLeaves.length;
  const averageDuration = absenceFrequency > 0 ? totalSickDays / absenceFrequency : 0;

  const workingDays = 260; // Approximate working days in a year
  const absencePercentage = (totalSickDays / workingDays) * 100;

  const longTermAbsence = sickLeaves.some(leave => {
    const start = leave.startDate;
    const end = leave.endDate || new Date();
    const weeks = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return weeks > 6;
  });

  const chronicAbsence = absenceFrequency >= 3;

  const statsData = convertToTimestamps({
    employeeId,
    companyId,
    period: 'year',
    periodStart,
    periodEnd,
    totalSickDays,
    totalSickHours: totalSickDays * 8, // Assuming 8 hours per day
    absenceFrequency,
    averageDuration,
    absencePercentage,
    longTermAbsence,
    chronicAbsence,
    calculatedAt: new Date()
  });

  const existingQuery = query(
    collection(db, 'absenceStatistics'),
    where('employeeId', '==', employeeId),
    where('period', '==', 'year'),
    where('periodStart', '>=', Timestamp.fromDate(periodStart)),
    where('periodEnd', '<=', Timestamp.fromDate(periodEnd))
  );

  const existingSnapshot = await getDocs(existingQuery);
  const cleanedData = removeUndefinedValues(statsData);

  if (existingSnapshot.empty) {
    await addDoc(collection(db, 'absenceStatistics'), cleanedData);
  } else {
    const docRef = doc(db, 'absenceStatistics', existingSnapshot.docs[0].id);
    await updateDoc(docRef, cleanedData);
  }
};

// Expenses
export const getExpenses = async (adminUserId: string, employeeId?: string): Promise<Expense[]> => {
  let q;

  if (employeeId) {
    q = query(
      collection(db, 'expenses'),
      where('userId', '==', adminUserId),
      where('employeeId', '==', employeeId),
      orderBy('date', 'desc')
    );
  } else {
    q = query(
      collection(db, 'expenses'),
      where('userId', '==', adminUserId),
      orderBy('date', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  const expenses = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Expense));
  
  return expenses;
};

export const createExpense = async (adminUserId: string, expense: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  
  // Clean up undefined values that Firestore doesn't accept
  const cleanExpense = {
    ...expense,
    travelDetails: expense.travelDetails || null,
    vatAmount: expense.vatAmount || 0,
    project: expense.project || null,
    costCenter: expense.costCenter || null,
    paidInPayroll: expense.paidInPayroll || null,
  };

  const expenseData = convertToTimestamps({
    ...cleanExpense,
    userId: adminUserId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(expenseData);
  const docRef = await addDoc(collection(db, 'expenses'), cleanedData);
  return docRef.id;
};

export const updateExpense = async (id: string, userId: string, updates: Partial<Expense>): Promise<void> => {
  const docRef = doc(db, 'expenses', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

export const approveExpense = async (id: string, userId: string, approverName: string, approverId: string, comment?: string): Promise<void> => {
  const docRef = doc(db, 'expenses', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const expenseData = docSnap.data();
  const approvals = expenseData.approvals || [];

  approvals.push({
    level: approvals.length + 1,
    approverName,
    approverId,
    approvedAt: new Date(),
    comment
  });

  const updateData = convertToTimestamps({
    status: 'approved',
    approvals,
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

export const rejectExpense = async (id: string, userId: string, approverName: string, approverId: string, comment: string): Promise<void> => {
  const docRef = doc(db, 'expenses', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const expenseData = docSnap.data();
  const approvals = expenseData.approvals || [];

  approvals.push({
    level: approvals.length + 1,
    approverName,
    approverId,
    rejectedAt: new Date(),
    comment
  });

  const updateData = convertToTimestamps({
    status: 'rejected',
    approvals,
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

export const getPendingExpenses = async (companyId: string, userId: string): Promise<Expense[]> => {
  const q = query(
    collection(db, 'expenses'),
    where('userId', '==', userId),
    where('companyId', '==', companyId),
    where('status', '==', 'submitted'),
    orderBy('submittedAt', 'asc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Expense));
};

export const calculateTravelExpense = (kilometers: number, ratePerKm: number = 0.23): number => {
  return kilometers * ratePerKm;
};

// Submit expense for approval (change status from draft to submitted)
export const submitExpense = async (id: string, userId: string, submittedBy: string): Promise<void> => {
  const docRef = doc(db, 'expenses', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const updateData = convertToTimestamps({
    status: 'submitted',
    submittedBy,
    submittedAt: new Date(),
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

// ✅ NIEUW: User Settings functies
export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const q = query(
    collection(db, 'userSettings'),
    where('userId', '==', userId)
  );
  
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return null;
  
  const docSnap = querySnapshot.docs[0];
  return {
    id: docSnap.id,
    ...convertTimestamps(docSnap.data())
  } as UserSettings;
};

export const saveUserSettings = async (userId: string, settings: Partial<UserSettings>): Promise<void> => {
  const existingSettings = await getUserSettings(userId);

  // Ensure favoritePages is always an object, never an array
  const ensuredSettings = {
    ...settings,
    favoritePages: settings.favoritePages && typeof settings.favoritePages === 'object' && !Array.isArray(settings.favoritePages)
      ? settings.favoritePages
      : (Array.isArray(settings.favoritePages) ? {} : settings.favoritePages)
  };

  // Merge met bestaande settings om nested objects correct te behouden
  const mergedSettings = existingSettings ? {
    ...existingSettings,
    ...ensuredSettings,
    // Ensure favoritePages from existing settings is also an object
    favoritePages: {
      ...(existingSettings.favoritePages && typeof existingSettings.favoritePages === 'object' && !Array.isArray(existingSettings.favoritePages)
        ? existingSettings.favoritePages
        : {}),
      ...(ensuredSettings.favoritePages || {})
    }
  } : {
    userId,
    ...ensuredSettings,
    favoritePages: ensuredSettings.favoritePages || {}
  };

  const settingsData = convertToTimestamps({
    ...mergedSettings,
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(settingsData);

  if (existingSettings) {
    // Update
    const docRef = doc(db, 'userSettings', existingSettings.id);
    await updateDoc(docRef, cleanedData);
  } else {
    // Create - ensure favoritePages is initialized as empty object
    const createData = convertToTimestamps({
      userId,
      ...ensuredSettings,
      favoritePages: ensuredSettings.favoritePages || {},
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await addDoc(collection(db, 'userSettings'), removeUndefinedValues(createData));
  }
};

// Helper function to check if user can manage a company
export const canUserManageCompany = async (userId: string, companyId: string): Promise<boolean> => {
  try {
    const company = await getCompany(companyId, userId);
    return !!company; // User can manage if they own the company
  } catch {
    return false;
  }
};

/**
 * Boekhouder mechanisme:
 * - Admin houdt lijst `boekhouderEmails` bij in zijn userSettings.
 * - Iedere boekhouder heeft `assignedAdminUserIds` in zijn eigen userSettings
 *   (plus op het users-doc zelf voor queries).
 *
 * `getAssignedAdminsForBoekhouder` leest de admin UID's uit userSettings.
 */
export const getAssignedAdminsForBoekhouder = async (
  boekhouderEmail: string,
  boekhouderUid: string
): Promise<string[]> => {
  try {
    const ids = new Set<string>();

    // 1. Directe lookup: userSettings van boekhouder
    const selfSnap = await getDocs(
      query(collection(db, 'userSettings'), where('userId', '==', boekhouderUid))
    );
    selfSnap.docs.forEach(d => {
      const assigned = d.data().assignedAdminUserIds as string[] | undefined;
      if (Array.isArray(assigned)) assigned.forEach(id => id && ids.add(id));
    });

    // 2. Fallback / sync: zoek alle admins die deze boekhouder-email gelinkt hebben
    if (boekhouderEmail) {
      const linked = await getDocs(
        query(collection(db, 'userSettings'), where('boekhouderEmails', 'array-contains', boekhouderEmail))
      );
      linked.docs.forEach(d => {
        const adminId = d.data().userId as string | undefined;
        if (adminId) ids.add(adminId);
      });
    }

    return Array.from(ids);
  } catch (error) {
    console.error('Error loading assigned admins for boekhouder:', error);
    return [];
  }
};

/**
 * Synchroniseer `assignedAdminUserIds` in userSettings van de boekhouder
 * met de admins die hem daadwerkelijk in `boekhouderEmails` hebben staan.
 * Idempotent: safe to call op iedere login van een boekhouder.
 */
export const syncBoekhouderAssignments = async (
  boekhouderEmail: string,
  boekhouderUid: string
): Promise<string[]> => {
  const adminIds = await getAssignedAdminsForBoekhouder(boekhouderEmail, boekhouderUid);

  try {
    await saveUserSettings(boekhouderUid, { assignedAdminUserIds: adminIds });
  } catch (error) {
    console.error('Error syncing boekhouder userSettings:', error);
  }

  return adminIds;
};

// Get primary admin UID for a co-admin email
export const getPrimaryAdminForCoAdmin = async (coAdminEmail: string): Promise<string | null> => {
  try {
    const q = query(
      collection(db, 'userSettings'),
      where('coAdminEmails', 'array-contains', coAdminEmail)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const primaryAdminSettings = querySnapshot.docs[0].data();
    return primaryAdminSettings.userId || null;
  } catch (error) {
    console.error('Error getting primary admin for co-admin:', error);
    return null;
  }
};

// Get company hierarchy (employer with its project companies)
export const getCompanyHierarchy = async (userId: string): Promise<CompanyWithEmployees[]> => {
  const companies = await getCompanies(userId);
  const employees = await getEmployees(userId);
  
  const employerCompanies = companies.filter(c => c.companyType === 'employer');
  
  return employerCompanies.map(employer => ({
    ...employer,
    employees: employees.filter(emp => emp.companyId === employer.id),
    projectCompanies: companies.filter(c => 
      c.companyType === 'project' && c.primaryEmployerId === employer.id
    )
  }));
};

// Smart company selector data voor forms
export interface CompanySelectData {
  employerCompanies: Company[];
  projectCompanies: Company[];
  employeeCanWorkFor: Company[]; // Voor specifieke employee
}

export const getCompanySelectData = async (
  userId: string,
  employeeId?: string
): Promise<CompanySelectData> => {
  const companies = await getCompanies(userId);
  const employerCompanies = companies.filter(c => c.companyType === 'employer');
  const projectCompanies = companies.filter(c => c.companyType === 'project');

  let employeeCanWorkFor: Company[] = employerCompanies; // Default to all employers

  if (employeeId) {
    const employee = await getEmployee(employeeId, userId);
    if (employee) {
      const allowedCompanyIds = [employee.companyId, ...(employee.projectCompanies || [])];
      employeeCanWorkFor = companies.filter(c => allowedCompanyIds.includes(c.id));
    }
  }

  return {
    employerCompanies,
    projectCompanies,
    employeeCanWorkFor
  };
};

// =============================================================================
// BUDGET ITEMS (Begroting - Terugkerende kosten)
// =============================================================================

export const getBudgetItems = async (userId: string, companyId?: string): Promise<BudgetItem[]> => {
  try {
    let q;
    if (companyId) {
      q = query(
        collection(db, 'budgetItems'),
        where('userId', '==', userId),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'budgetItems'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    })) as BudgetItem[];
  } catch (error) {
    console.error('Error fetching budget items:', error);
    throw error;
  }
};

export const getBudgetItem = async (budgetItemId: string, userId: string): Promise<BudgetItem | null> => {
  try {
    const docRef = doc(db, 'budgetItems', budgetItemId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    if (data.userId !== userId) {
      throw new Error('Unauthorized access to budget item');
    }

    return {
      id: docSnap.id,
      ...convertTimestamps(data)
    } as BudgetItem;
  } catch (error) {
    console.error('Error fetching budget item:', error);
    throw error;
  }
};

export const createBudgetItem = async (
  budgetItem: Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<BudgetItem> => {
  try {
    const now = Timestamp.now();
    const dataToSave = removeUndefinedValues({
      ...budgetItem,
      userId,
      startDate: budgetItem.startDate instanceof Date
        ? Timestamp.fromDate(budgetItem.startDate)
        : budgetItem.startDate,
      endDate: budgetItem.endDate instanceof Date
        ? Timestamp.fromDate(budgetItem.endDate)
        : budgetItem.endDate,
      createdAt: now,
      updatedAt: now,
    });

    const docRef = await addDoc(collection(db, 'budgetItems'), dataToSave);

    return {
      id: docRef.id,
      ...budgetItem,
      userId,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
    } as BudgetItem;
  } catch (error) {
    console.error('Error creating budget item:', error);
    throw error;
  }
};

export const updateBudgetItem = async (
  budgetItemId: string,
  updates: Partial<BudgetItem>,
  userId: string
): Promise<void> => {
  try {
    // Verify ownership
    const existing = await getBudgetItem(budgetItemId, userId);
    if (!existing) {
      throw new Error('Budget item not found or unauthorized');
    }

    const dataToUpdate = removeUndefinedValues({
      ...updates,
      startDate: updates.startDate instanceof Date
        ? Timestamp.fromDate(updates.startDate)
        : updates.startDate,
      endDate: updates.endDate instanceof Date
        ? Timestamp.fromDate(updates.endDate)
        : updates.endDate,
      updatedAt: Timestamp.now(),
    });

    // Remove id and userId from updates
    delete dataToUpdate.id;
    delete dataToUpdate.userId;

    const docRef = doc(db, 'budgetItems', budgetItemId);
    await updateDoc(docRef, dataToUpdate);
  } catch (error) {
    console.error('Error updating budget item:', error);
    throw error;
  }
};

export const deleteBudgetItem = async (budgetItemId: string, userId: string): Promise<void> => {
  try {
    // Verify ownership
    const existing = await getBudgetItem(budgetItemId, userId);
    if (!existing) {
      throw new Error('Budget item not found or unauthorized');
    }

    const docRef = doc(db, 'budgetItems', budgetItemId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting budget item:', error);
    throw error;
  }
};

// Helper: Calculate monthly budget total for a company
export const calculateMonthlyBudget = (budgetItems: BudgetItem[]): number => {
  return budgetItems
    .filter(item => item.isActive)
    .reduce((total, item) => {
      switch (item.frequency) {
        case 'monthly':
          return total + item.amount;
        case 'quarterly':
          return total + (item.amount / 3);
        case 'yearly':
          return total + (item.amount / 12);
        default:
          return total;
      }
    }, 0);
};

// Helper: Calculate yearly budget total for a company
export const calculateYearlyBudget = (budgetItems: BudgetItem[]): number => {
  return budgetItems
    .filter(item => item.isActive)
    .reduce((total, item) => {
      switch (item.frequency) {
        case 'monthly':
          return total + (item.amount * 12);
        case 'quarterly':
          return total + (item.amount * 4);
        case 'yearly':
          return total + item.amount;
        default:
          return total;
      }
    }, 0);
};

// Helper: Get budget items by category
export const getBudgetItemsByCategory = (budgetItems: BudgetItem[]): Record<string, BudgetItem[]> => {
  return budgetItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, BudgetItem[]>);
};

// Get payroll calculations
export const getPayrollCalculations = async (userId: string): Promise<any[]> => {
  try {
    const q = query(
      collection(db, 'payrollCalculations'),
      where('userId', '==', userId),
      orderBy('periodStartDate', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const calculations = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Convert Firestore Timestamps to Date objects
      const converted = { ...data, id: doc.id };

      const dateFields = ['periodStartDate', 'periodEndDate', 'paymentDate', 'createdAt', 'updatedAt'];
      dateFields.forEach(field => {
        if (converted[field] && typeof converted[field].toDate === 'function') {
          converted[field] = converted[field].toDate();
        }
      });

      return converted;
    });

    return calculations;
  } catch (error) {
    console.error('Error loading payroll calculations:', error);
    return [];
  }
};

// ========================================
// 📋 BUSINESS TASKS - Taken Management
// ========================================

/**
 * Haal alle taken op voor een gebruiker
 * @param userId - User ID
 * @param companyId - Optioneel: filter op bedrijf
 * @returns Array van BusinessTask objecten
 */
export const getTasks = async (userId: string, companyId?: string): Promise<any[]> => {
  try {
    let q = query(
      collection(db, 'businessTasks'),
      where('userId', '==', userId),
      orderBy('dueDate', 'asc')
    );

    if (companyId) {
      q = query(
        collection(db, 'businessTasks'),
        where('userId', '==', userId),
        where('companyId', '==', companyId),
        orderBy('dueDate', 'asc')
      );
    }

    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return convertTimestamps({ ...data, id: doc.id });
    });

    return tasks;
  } catch (error) {
    console.error('Error getting tasks:', error);
    throw error;
  }
};

/**
 * Haal ALLE taken op voor een bedrijf (voor admins/co-admins)
 * Inclusief taken die zijn toegewezen aan de gebruiker
 */
export const getAllCompanyTasks = async (companyId: string, userId?: string): Promise<any[]> => {
  try {
    const q = query(
      collection(db, 'businessTasks'),
      where('companyId', '==', companyId),
      orderBy('dueDate', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const allTasks = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return convertTimestamps({ ...data, id: doc.id });
    });

    // Als userId is meegegeven, filter dan op taken die relevant zijn voor deze user
    // (eigenaar, toegewezen, of alle taken als admin/co-admin)
    if (userId) {
      // Voor nu geven we ALLE bedrijfstaken terug
      // De WeeklyTasksReminder kan filteren als nodig
      return allTasks;
    }

    return allTasks;
  } catch (error) {
    console.error('Error getting all company tasks:', error);
    throw error;
  }
};

/**
 * Auth-UIDs van managers + de eigenaar (admin) die dit bedrijf beheren.
 * Gebruikt voor beheerders-meldingen (bv. APK/onderhoud).
 */
export const getCompanyManagerUids = async (
  companyId: string,
  ownerUserId?: string
): Promise<string[]> => {
  const uids = new Set<string>();
  if (ownerUserId) uids.add(ownerUserId);
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'manager'),
      where('assignedCompanyId', '==', companyId)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      const data = d.data();
      uids.add(data.uid || d.id);
    });
  } catch (error) {
    console.error('Error getting company manager uids:', error);
  }
  return Array.from(uids);
};

/**
 * Haal gebruikers op die toegang hebben tot een bedrijf
 * (voor toewijzen van taken)
 */
export const getCompanyUsers = async (companyId: string): Promise<Array<{ uid: string; email: string; displayName?: string }>> => {
  try {
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    if (!companyDoc.exists()) return [];

    const companyData = companyDoc.data();
    const companyOwner = companyData.userId;
    const allowedUsers = companyData.allowedUsers || [];

    const usersSnapshot = await getDocs(collection(db, 'users'));
    const allUsers: Array<{ uid: string; email: string; displayName: string; role?: string }> = [];

    // Haal alle employees op voor naam-resolutie en company-koppeling (batch)
    const employeesSnapshot = await getDocs(collection(db, 'employees'));
    const employeesMap = new Map<string, any>();
    employeesSnapshot.docs.forEach(empDoc => {
      employeesMap.set(empDoc.id, empDoc.data());
    });

    // Bouw set van UIDs die toegang hebben tot dit bedrijf
    const accessUIDs = new Set<string>();
    accessUIDs.add(companyOwner);
    allowedUsers.forEach((uid: string) => accessUIDs.add(uid));

    // Voeg ook users toe die een employee record hebben voor dit bedrijf
    for (const [empId, empData] of employeesMap) {
      if (empData.companyId === companyId || empData.projectCompanies?.includes(companyId)) {
        // Zoek user die via employeeId aan deze employee gekoppeld is
        for (const uDoc of usersSnapshot.docs) {
          if (uDoc.data().employeeId === empId) {
            accessUIDs.add(uDoc.id);
          }
        }
        // Check ook accountUserId op het employee record
        if (empData.accountUserId) accessUIDs.add(empData.accountUserId);
      }
    }

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;

      if (!accessUIDs.has(uid)) continue;

      let displayName = '';

      // 1. Probeer employee data (personalInfo structuur)
      if (userData.employeeId) {
        const employeeData = employeesMap.get(userData.employeeId);
        if (employeeData) {
          if (employeeData.personalInfo?.firstName && employeeData.personalInfo?.lastName) {
            displayName = `${employeeData.personalInfo.firstName} ${employeeData.personalInfo.lastName}`;
          } else if (employeeData.personalInfo?.firstName) {
            displayName = employeeData.personalInfo.firstName;
          }
          // Legacy velden op root niveau
          if (!displayName && employeeData.Name) {
            displayName = employeeData.Name;
          } else if (!displayName && employeeData.firstName && employeeData.lastName) {
            displayName = `${employeeData.firstName} ${employeeData.lastName}`;
          }
        }
      }

      // 2. Fallback: zoek employee gekoppeld aan deze user via userId veld
      if (!displayName) {
        for (const [, empData] of employeesMap) {
          if (empData.userId === uid || empData.accountUserId === uid) {
            if (empData.personalInfo?.firstName && empData.personalInfo?.lastName) {
              displayName = `${empData.personalInfo.firstName} ${empData.personalInfo.lastName}`;
            } else if (empData.personalInfo?.firstName) {
              displayName = empData.personalInfo.firstName;
            }
            if (displayName) break;
          }
        }
      }

      // 3. Fallback naar user document zelf
      if (!displayName) {
        if (userData.displayName) {
          displayName = userData.displayName;
        } else if (userData.firstName && userData.lastName) {
          displayName = `${userData.firstName} ${userData.lastName}`;
        } else if (userData.firstName) {
          displayName = userData.firstName;
        } else if (userData.name) {
          displayName = userData.name;
        }
      }

      // 4. Laatste fallback: email prefix
      if (!displayName && userData.email) {
        displayName = userData.email.split('@')[0];
      }

      if (!displayName) {
        displayName = 'Onbekende gebruiker';
      }

      allUsers.push({
        uid,
        email: userData.email || 'Onbekend',
        displayName,
        role: userData.role
      });
    }

    return allUsers;
  } catch (error) {
    console.error('Error in getCompanyUsers:', error);
    return [];
  }
};

const resolveUserName = (data: Record<string, unknown>): string => {
  const firstName = data.firstName as string | undefined;
  const lastName = data.lastName as string | undefined;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  const displayName = data.displayName as string | undefined;
  if (displayName) return displayName;
  const email = data.email as string | undefined;
  return email ? email.split('@')[0] : '';
};

/**
 * Haalt niet-medewerker gebruikers op voor een admin (admin zelf + co-admins + managers).
 * Vereist dat repairAdminUsers() eerder is aangeroepen zodat adminUserId correct staat.
 * Sluit gebruikers uit die al als medewerker in employeeDocIds staan (voorkomt duplicaten).
 */
export const getAdminNonEmployeeUsers = async (
  adminUserId: string,
  employeeDocIds: string[]
): Promise<Array<{ uid: string; name: string }>> => {
  try {
    const usersCol = collection(db, 'users');
    const empIdsSet = new Set(employeeDocIds);
    const results = new Map<string, { uid: string; name: string }>();

    const addUserDoc = (d: { id: string; data: () => Record<string, unknown> }) => {
      const data = d.data() as Record<string, unknown>;
      if (data.employeeId && empIdsSet.has(data.employeeId as string)) return;
      const uid = (data.uid as string) || '';
      if (!uid) return;
      if (results.has(uid)) return;
      const name = resolveUserName(data);
      if (!name) return;
      results.set(uid, { uid, name });
    };

    // Primaire query: alle users met adminUserId (na repairAdminUsers vindt dit iedereen)
    const snap = await getDocs(query(usersCol, where('adminUserId', '==', adminUserId)));
    snap.docs.forEach(addUserDoc);

    // Backward compat: co-admins via userSettings (vóór normalisatie nog niet in bovenstaande query)
    const settingsSnap = await getDocs(
      query(collection(db, 'userSettings'), where('primaryAdminUserId', '==', adminUserId))
    );
    const coAdminUids: string[] = [];
    settingsSnap.docs.forEach(d => {
      const userId = d.data().userId as string | undefined;
      if (userId && !results.has(userId)) coAdminUids.push(userId);
    });
    for (const uid of coAdminUids) {
      const coSnap = await getDocs(query(usersCol, where('uid', '==', uid)));
      coSnap.docs.forEach(addUserDoc);
    }

    return Array.from(results.values());
  } catch {
    return [];
  }
};

/**
 * Normaliseert de users-collectie zodat elke user doc een correct adminUserId veld heeft.
 * - Admin eigen doc: adminUserId = adminUserId (was null)
 * - Co-admin docs: adminUserId = adminUserId (ontbrak, alleen in userSettings)
 * Na aanroep werkt where('adminUserId', '==', adminUserId) voor alle user types.
 */
export const repairAdminUsers = async (adminUserId: string): Promise<void> => {
  const usersCol = collection(db, 'users');
  const batch = writeBatch(db);
  let hasChanges = false;

  // Fix admin eigen doc
  const selfSnap = await getDocs(query(usersCol, where('uid', '==', adminUserId)));
  selfSnap.docs.forEach(d => {
    if (d.data().adminUserId !== adminUserId) {
      batch.update(d.ref, { adminUserId });
      hasChanges = true;
    }
  });

  // Fix co-admin docs via userSettings
  const settingsSnap = await getDocs(
    query(collection(db, 'userSettings'), where('primaryAdminUserId', '==', adminUserId))
  );
  const coAdminUids: string[] = [];
  settingsSnap.docs.forEach(d => {
    const userId = d.data().userId as string | undefined;
    if (userId) coAdminUids.push(userId);
  });
  for (const uid of coAdminUids) {
    const coSnap = await getDocs(query(usersCol, where('uid', '==', uid)));
    coSnap.docs.forEach(d => {
      if (d.data().adminUserId !== adminUserId) {
        batch.update(d.ref, { adminUserId });
        hasChanges = true;
      }
    });
  }

  if (hasChanges) await batch.commit();
};

/**
 * Update naam en/of email van een user doc in de users collectie.
 */
export const updateUserProfile = async (
  docId: string,
  updates: { firstName?: string; lastName?: string; email?: string }
): Promise<void> => {
  const docRef = doc(db, 'users', docId);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

/**
 * Haal een enkele taak op
 */
export const getTask = async (taskId: string, userId: string): Promise<any | null> => {
  try {
    const docRef = doc(db, 'businessTasks', taskId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();

    // Verificatie dat de gebruiker toegang heeft
    if (data.userId !== userId && !data.assignedTo?.includes(userId)) {
      throw new Error('Geen toegang tot deze taak');
    }

    return convertTimestamps({ ...data, id: docSnap.id });
  } catch (error) {
    console.error('Error getting task:', error);
    throw error;
  }
};

/**
 * Maak een nieuwe taak aan
 */
export const createTask = async (userId: string, taskData: any): Promise<string> => {
  try {
    const now = new Date();

    const newTask = {
      ...taskData,
      userId,
      createdBy: userId,
      status: taskData.status || 'pending',
      progress: taskData.progress || 0,
      isRecurring: taskData.isRecurring || false,
      isScheduled: taskData.isScheduled || false,
      createdAt: now,
      updatedAt: now,
    };

    // Bereken nextOccurrence voor terugkerende taken
    if (newTask.isRecurring && newTask.frequency) {
      newTask.nextOccurrence = calculateNextOccurrence(
        newTask.dueDate,
        newTask.frequency,
        newTask.recurrenceDay
      );
    }

    const taskToSave = removeUndefinedValues(convertToTimestamps(newTask));
    const docRef = await addDoc(collection(db, 'businessTasks'), taskToSave);

    // Audit log
    await AuditService.logAction(
      userId,
      'create' as any,
      'task' as any,
      docRef.id,
      {
        companyId: taskData.companyId,
        metadata: { description: `Taak aangemaakt: ${taskData.title}` },
      }
    );

    // Notificeer toegewezenen (fire-and-forget — taak is al opgeslagen)
    notifyAssignmentChange(docRef.id, taskData.title, userId, [], taskData.assignedTo || []).catch(
      err => console.error('[Tasks] assignment notify mislukt:', err)
    );

    return docRef.id;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

/**
 * Fire-and-forget notificatie helper die nieuwe toegewezenen informeert.
 * Imports worden lazy gedaan om circulaire imports te vermijden.
 */
const notifyAssignmentChange = async (
  taskId: string,
  taskTitle: string,
  assignedBy: string,
  previousAssignees: string[],
  newAssignees: string[]
): Promise<void> => {
  const added = newAssignees.filter(id => !previousAssignees.includes(id));
  if (added.length === 0) return;

  const { resolveToUserUids } = await import('./notificationTargeting');
  const { NotificationService } = await import('./notificationService');
  const uids = await resolveToUserUids(added);
  if (uids.length === 0) return;
  await NotificationService.notifyTaskAssignedBulk(uids, taskTitle, assignedBy, taskId);
};

/**
 * Notificatie bij voltooien: naar opdrachtgever (userId + createdBy) en
 * mede-toegewezenen, exclusief de voltooier zelf.
 */
const notifyTaskCompleted = async (
  taskId: string,
  taskData: any,
  completedByUid: string
): Promise<void> => {
  const { resolveToUserUids, getTaskOwnerUids } = await import('./notificationTargeting');
  const { NotificationService } = await import('./notificationService');

  const assigneeUids = await resolveToUserUids(
    Array.isArray(taskData.assignedTo) ? taskData.assignedTo : []
  );
  const ownerUids = getTaskOwnerUids({ userId: taskData.userId, createdBy: taskData.createdBy });

  const recipientSet = new Set<string>([...ownerUids, ...assigneeUids]);
  recipientSet.delete(completedByUid);
  const recipients = Array.from(recipientSet);
  if (recipients.length === 0) return;

  // Naam van voltooier — best-effort via users collectie
  let completedByName = 'Een collega';
  try {
    const q = query(collection(db, 'users'), where('uid', '==', completedByUid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const u = snap.docs[0].data();
      const name = u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim();
      if (name) completedByName = name;
    }
  } catch {
    // naam lookup is best-effort
  }

  await NotificationService.notifyTaskCompleted(
    recipients,
    taskData.title || 'Taak',
    completedByName,
    taskId
  );
};

/**
 * Update een bestaande taak
 */
export const updateTask = async (taskId: string, userId: string, updates: any): Promise<void> => {
  try {
    const taskRef = doc(db, 'businessTasks', taskId);
    const taskSnap = await getDoc(taskRef);

    if (!taskSnap.exists()) {
      throw new Error('Taak niet gevonden');
    }

    const taskData = taskSnap.data();

    // Verificatie dat de gebruiker toegang heeft
    if (taskData.userId !== userId && !taskData.assignedTo?.includes(userId)) {
      throw new Error('Geen toegang tot deze taak');
    }

    const updatedData: Record<string, any> = {
      ...updates,
      updatedAt: new Date(),
    };

    // Detecteer transitie naar 'completed' (voor latere notify)
    const justCompleted =
      updates.status === 'completed' && taskData.status !== 'completed';

    // Als taak voltooid wordt, zet completedDate
    if (updates.status === 'completed' && !taskData.completedDate) {
      updatedData.completedDate = new Date();
    }

    // Reset reminderSentAt als dueDate in de toekomst opschuift voorbij de
    // 1-uur-threshold — anders zouden we geen nieuwe reminder meer sturen.
    if (updates.dueDate) {
      const newDue = updates.dueDate instanceof Date ? updates.dueDate : new Date(updates.dueDate);
      const msUntilDue = newDue.getTime() - Date.now();
      if (msUntilDue > 60 * 60 * 1000) {
        updatedData.reminderSentAt = null;
      }
    }

    // Herbereken nextOccurrence bij wijziging van terugkerende instellingen
    if (updates.isRecurring !== undefined || updates.frequency !== undefined || updates.dueDate !== undefined) {
      const isRecurring = updates.isRecurring !== undefined ? updates.isRecurring : taskData.isRecurring;
      if (isRecurring) {
        updatedData.nextOccurrence = calculateNextOccurrence(
          updates.dueDate || taskData.dueDate,
          updates.frequency || taskData.frequency,
          updates.recurrenceDay || taskData.recurrenceDay
        );
      }
    }

    const dataToSave = removeUndefinedValues(convertToTimestamps(updatedData));
    await updateDoc(taskRef, dataToSave);

    // Assignment diff → notify nieuwe toegewezenen
    if (Array.isArray(updates.assignedTo)) {
      const prev: string[] = Array.isArray(taskData.assignedTo) ? taskData.assignedTo : [];
      notifyAssignmentChange(
        taskId,
        taskData.title || 'Taak',
        userId,
        prev,
        updates.assignedTo
      ).catch(err => console.error('[Tasks] assignment notify mislukt:', err));
    }

    // Completion → notify opdrachtgever + mede-toegewezenen (exclusief voltooier)
    if (justCompleted) {
      notifyTaskCompleted(taskId, taskData, userId).catch(err =>
        console.error('[Tasks] completed notify mislukt:', err)
      );
    }

    // Audit log
    await AuditService.logAction(
      userId,
      'update' as any,
      'task' as any,
      taskId,
      {
        companyId: taskData.companyId,
        metadata: { description: `Taak bijgewerkt: ${taskData.title}` },
      }
    );
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

/**
 * Verwijder een taak
 */
export const deleteTask = async (taskId: string, userId: string): Promise<void> => {
  try {
    const taskRef = doc(db, 'businessTasks', taskId);
    const taskSnap = await getDoc(taskRef);

    if (!taskSnap.exists()) {
      throw new Error('Taak niet gevonden');
    }

    const taskData = taskSnap.data();

    // Verificatie dat de gebruiker toegang heeft (alleen eigenaar kan verwijderen)
    if (taskData.userId !== userId && taskData.createdBy !== userId) {
      throw new Error('Geen toegang om deze taak te verwijderen');
    }

    await deleteDoc(taskRef);

    // Audit log
    await AuditService.logAction(
      userId,
      'delete' as any,
      'task' as any,
      taskId,
      {
        companyId: taskData.companyId,
        metadata: { description: `Taak verwijderd: ${taskData.title}` },
      }
    );
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

/**
 * Haal taken op gebaseerd op status
 */
export const getTasksByStatus = async (
  userId: string,
  status: string,
  companyId?: string
): Promise<any[]> => {
  try {
    let q = query(
      collection(db, 'businessTasks'),
      where('userId', '==', userId),
      where('status', '==', status),
      orderBy('dueDate', 'asc')
    );

    if (companyId) {
      q = query(
        collection(db, 'businessTasks'),
        where('userId', '==', userId),
        where('companyId', '==', companyId),
        where('status', '==', status),
        orderBy('dueDate', 'asc')
      );
    }

    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return convertTimestamps({ ...data, id: doc.id });
    });

    return tasks;
  } catch (error) {
    console.error('Error getting tasks by status:', error);
    throw error;
  }
};

/**
 * Haal late taken op (overdue)
 */
export const getOverdueTasks = async (userId: string, companyId?: string): Promise<any[]> => {
  try {
    const now = new Date();
    let q = query(
      collection(db, 'businessTasks'),
      where('userId', '==', userId),
      where('status', 'in', ['pending', 'in_progress']),
      orderBy('dueDate', 'asc')
    );

    if (companyId) {
      q = query(
        collection(db, 'businessTasks'),
        where('userId', '==', userId),
        where('companyId', '==', companyId),
        where('status', 'in', ['pending', 'in_progress']),
        orderBy('dueDate', 'asc')
      );
    }

    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs
      .map(doc => {
        const data = doc.data();
        return convertTimestamps({ ...data, id: doc.id });
      })
      .filter(task => task.dueDate < now);

    return tasks;
  } catch (error) {
    console.error('Error getting overdue tasks:', error);
    throw error;
  }
};

/**
 * Genereer nieuwe instanties voor terugkerende taken
 */
export const generateRecurringTasks = async (userId: string): Promise<number> => {
  try {
    const now = new Date();

    // Haal alle terugkerende taken op
    const q = query(
      collection(db, 'businessTasks'),
      where('userId', '==', userId),
      where('isRecurring', '==', true),
      where('status', '==', 'completed')
    );

    const querySnapshot = await getDocs(q);
    let generatedCount = 0;

    for (const docSnap of querySnapshot.docs) {
      const task = convertTimestamps({ ...docSnap.data(), id: docSnap.id });

      // Check of we een nieuwe instantie moeten genereren
      if (task.nextOccurrence && task.nextOccurrence <= now) {
        // Maak nieuwe taak aan
        const newTaskData = {
          ...task,
          id: undefined, // Verwijder oude ID
          status: 'pending',
          progress: 0,
          completedDate: undefined,
          dueDate: task.nextOccurrence,
          startDate: undefined,
          checklist: task.checklist?.map((item: any) => ({
            ...item,
            completed: false,
            completedBy: undefined,
            completedAt: undefined,
          })),
        };

        const newTaskId = await createTask(userId, newTaskData);
        generatedCount++;

        // Update de originele taak met nieuwe nextOccurrence
        const newNextOccurrence = calculateNextOccurrence(
          task.nextOccurrence,
          task.frequency,
          task.recurrenceDay
        );

        await updateDoc(doc(db, 'businessTasks', task.id), {
          nextOccurrence: Timestamp.fromDate(newNextOccurrence),
          lastGenerated: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now),
        });
      }
    }

    return generatedCount;
  } catch (error) {
    console.error('Error generating recurring tasks:', error);
    throw error;
  }
};

/**
 * Bereken de volgende occurrence voor een terugkerende taak
 */
const calculateNextOccurrence = (
  currentDate: Date,
  frequency?: string,
  recurrenceDay?: number
): Date => {
  const next = new Date(currentDate);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      if (recurrenceDay) {
        // Verschuif naar de geconfigureerde weekdag (ISO: 1=ma, 7=zo)
        const targetDay = recurrenceDay;
        const currentDay = next.getDay() || 7; // 0 (zo) → 7
        const diff = (targetDay - currentDay + 7) % 7;
        if (diff !== 0) next.setDate(next.getDate() + diff);
      }
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (recurrenceDay) {
        next.setDate(recurrenceDay);
      }
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      if (recurrenceDay) {
        next.setDate(recurrenceDay);
      }
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
};

/**
 * Haal taken op die zijn toegewezen aan een specifieke gebruiker (via assignedTo array)
 */
export const getTasksAssignedToUser = async (
  userUid: string,
  companyId?: string
): Promise<BusinessTask[]> => {
  const convertTaskDoc = (docSnap: any) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate ? new Date(data.dueDate) : new Date(),
      startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate ? new Date(data.startDate) : undefined,
      completedDate: data.completedDate?.toDate ? data.completedDate.toDate() : data.completedDate ? new Date(data.completedDate) : undefined,
      nextOccurrence: data.nextOccurrence?.toDate ? data.nextOccurrence.toDate() : data.nextOccurrence ? new Date(data.nextOccurrence) : undefined,
      lastGenerated: data.lastGenerated?.toDate ? data.lastGenerated.toDate() : data.lastGenerated ? new Date(data.lastGenerated) : undefined,
      scheduledDate: data.scheduledDate?.toDate ? data.scheduledDate.toDate() : data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      scheduledAt: data.scheduledAt?.toDate ? data.scheduledAt.toDate() : data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
    } as BusinessTask;
  };

  try {
    // Probeer eerst de samengestelde query (vereist Firestore composite index)
    let q;
    if (companyId) {
      q = query(
        collection(db, 'businessTasks'),
        where('assignedTo', 'array-contains', userUid),
        where('companyId', '==', companyId),
        orderBy('dueDate', 'asc')
      );
    } else {
      q = query(
        collection(db, 'businessTasks'),
        where('assignedTo', 'array-contains', userUid),
        orderBy('dueDate', 'asc')
      );
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertTaskDoc);
  } catch (err: any) {
    // Firestore composite index ontbreekt — fallback: query zonder orderBy
    // en sorteer client-side
    console.error('Error fetching tasks (trying fallback):', err?.message || err);
    try {
      let fallbackQ;
      if (companyId) {
        fallbackQ = query(
          collection(db, 'businessTasks'),
          where('assignedTo', 'array-contains', userUid),
          where('companyId', '==', companyId)
        );
      } else {
        fallbackQ = query(
          collection(db, 'businessTasks'),
          where('assignedTo', 'array-contains', userUid)
        );
      }
      const fallbackSnapshot = await getDocs(fallbackQ);
      const tasks = fallbackSnapshot.docs.map(convertTaskDoc);
      return tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    } catch (fallbackErr) {
      console.error('Fallback query also failed:', fallbackErr);
      return [];
    }
  }
};

/**
 * Plan een taak in op een specifieke datum/tijd (door werknemer)
 */
export const scheduleTask = async (
  taskId: string,
  userId: string,
  scheduledDate: Date,
  scheduledStartTime: string,
  scheduledEndTime: string
): Promise<void> => {
  try {
    const taskRef = doc(db, 'businessTasks', taskId);
    const taskSnap = await getDoc(taskRef);

    if (!taskSnap.exists()) {
      throw new Error('Taak niet gevonden');
    }

    const taskData = taskSnap.data();

    // Verificatie: gebruiker moet toegewezen zijn
    if (taskData.userId !== userId && !taskData.assignedTo?.includes(userId)) {
      throw new Error('Geen toegang tot deze taak');
    }

    const now = new Date();
    const dataToSave = convertToTimestamps({
      scheduledDate,
      scheduledStartTime,
      scheduledEndTime,
      scheduledBy: userId,
      scheduledAt: now,
      isScheduled: true,
      updatedAt: now,
    });

    await updateDoc(taskRef, dataToSave);

    await AuditService.logAction(
      userId,
      'update' as any,
      'task' as any,
      taskId,
      {
        companyId: taskData.companyId,
        metadata: { description: `Taak ingepland: ${taskData.title} op ${scheduledDate.toLocaleDateString('nl-NL')} ${scheduledStartTime}-${scheduledEndTime}` },
      }
    );
  } catch (error) {
    console.error('Error scheduling task:', error);
    throw error;
  }
};

/**
 * Verwijder inplanning van een taak
 */
export const unscheduleTask = async (taskId: string, userId: string): Promise<void> => {
  try {
    const taskRef = doc(db, 'businessTasks', taskId);
    const taskSnap = await getDoc(taskRef);

    if (!taskSnap.exists()) {
      throw new Error('Taak niet gevonden');
    }

    const taskData = taskSnap.data();

    if (taskData.userId !== userId && !taskData.assignedTo?.includes(userId)) {
      throw new Error('Geen toegang tot deze taak');
    }

    await updateDoc(taskRef, {
      scheduledDate: null,
      scheduledStartTime: null,
      scheduledEndTime: null,
      scheduledBy: null,
      scheduledAt: null,
      isScheduled: false,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  } catch (error) {
    console.error('Error unscheduling task:', error);
    throw error;
  }
};

/**
 * Haal niet-ingeplande taken op voor een gebruiker
 */
export const getUnscheduledTasks = async (
  userUid: string,
  companyId?: string
): Promise<BusinessTask[]> => {
  try {
    // Haal alle toegewezen taken op en filter client-side op isScheduled
    const allTasks = await getTasksAssignedToUser(userUid, companyId);
    return allTasks.filter(
      task => !task.isScheduled && task.status !== 'completed' && task.status !== 'cancelled'
    );
  } catch (error) {
    console.error('Error getting unscheduled tasks:', error);
    return [];
  }
};

/**
 * Haal ingeplande taken op voor een weekperiode
 */
export const getScheduledTasksForPeriod = async (
  userUid: string,
  startDate: Date,
  endDate: Date,
  companyId?: string
): Promise<BusinessTask[]> => {
  try {
    const allTasks = await getTasksAssignedToUser(userUid, companyId);
    return allTasks.filter(task => {
      if (!task.isScheduled || !task.scheduledDate) return false;
      const scheduled = new Date(task.scheduledDate);
      return scheduled >= startDate && scheduled <= endDate;
    });
  } catch (error) {
    console.error('Error getting scheduled tasks for period:', error);
    return [];
  }
};

/**
 * ========================================
 * INCOMING POST MANAGEMENT
 * ========================================
 */

/**
 * Create a new incoming post entry
 */
export const createIncomingPost = async (userId: string, postData: any): Promise<string> => {
  try {
    // Filter out undefined values - Firebase doesn't allow them
    const cleanData: any = {
      userId,
      companyId: postData.companyId,
      sender: postData.sender,
      subject: postData.subject,
      receivedDate: postData.receivedDate,
      fileUrl: postData.fileUrl,
      fileName: postData.fileName,
      filePath: postData.filePath,
      status: postData.status,
      requiresAction: postData.requiresAction || false,
      uploadDate: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Only add optional fields if they are defined
    if (postData.amount !== undefined && postData.amount !== null && postData.amount !== '') {
      cleanData.amount = postData.amount;
    }
    if (postData.dueDate !== undefined && postData.dueDate !== null) {
      cleanData.dueDate = postData.dueDate;
    }
    if (postData.actionType !== undefined && postData.actionType !== null && postData.actionType !== '') {
      cleanData.actionType = postData.actionType;
    }
    if (postData.actionDescription !== undefined && postData.actionDescription !== null && postData.actionDescription !== '') {
      cleanData.actionDescription = postData.actionDescription;
    }
    if (postData.priority !== undefined && postData.priority !== null && postData.priority !== '') {
      cleanData.priority = postData.priority;
    }
    if (postData.notes !== undefined && postData.notes !== null && postData.notes !== '') {
      cleanData.notes = postData.notes;
    }
    if (postData.tags !== undefined && postData.tags !== null && postData.tags.length > 0) {
      cleanData.tags = postData.tags;
    }

    const docRef = await addDoc(collection(db, 'incomingPost'), cleanData);

    // Log audit
    await AuditService.logAction(
      userId,
      'create' as any,
      'incomingPost' as any,
      docRef.id,
      {
        companyId: postData.companyId,
        metadata: { description: `Post aangemaakt: ${postData.subject} van ${postData.sender}` },
      }
    );

    return docRef.id;
  } catch (error) {
    console.error('Error creating incoming post:', error);
    throw error;
  }
};

/**
 * Get all incoming post for a company
 */
export const getIncomingPost = async (companyId: string, userId?: string): Promise<any[]> => {
  try {
    const postsQuery = query(
      collection(db, 'incomingPost'),
      where('companyId', '==', companyId),
      orderBy('uploadDate', 'desc')
    );

    const snapshot = await getDocs(postsQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadDate: doc.data().uploadDate?.toDate(),
      receivedDate: doc.data().receivedDate?.toDate(),
      dueDate: doc.data().dueDate?.toDate(),
      processedDate: doc.data().processedDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    }));
  } catch (error) {
    console.error('Error getting incoming post:', error);
    throw error;
  }
};

/**
 * Get a single post by ID
 */
export const getPostById = async (postId: string, userId: string): Promise<any | null> => {
  try {
    const docRef = doc(db, 'incomingPost', postId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      uploadDate: data.uploadDate?.toDate(),
      receivedDate: data.receivedDate?.toDate(),
      dueDate: data.dueDate?.toDate(),
      processedDate: data.processedDate?.toDate(),
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    };
  } catch (error) {
    console.error('Error getting post:', error);
    throw error;
  }
};

/**
 * Update incoming post
 */
export const updateIncomingPost = async (postId: string, userId: string, updates: any): Promise<void> => {
  try {
    const docRef = doc(db, 'incomingPost', postId);

    // Filter out undefined values - Firebase doesn't allow them
    const cleanUpdates: any = {
      updatedAt: Timestamp.now(),
    };

    // Only add fields that are defined
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && updates[key] !== null && updates[key] !== '') {
        cleanUpdates[key] = updates[key];
      }
    });

    await updateDoc(docRef, cleanUpdates);

    // Log audit
    await AuditService.logAction(
      userId,
      'update' as any,
      'incomingPost' as any,
      postId,
      {
        companyId: updates.companyId || 'unknown',
        metadata: { description: `Post bijgewerkt` },
      }
    );
  } catch (error) {
    console.error('Error updating incoming post:', error);
    throw error;
  }
};

/**
 * Delete incoming post
 */
export const deleteIncomingPost = async (postId: string, userId: string, companyId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'incomingPost', postId);
    await deleteDoc(docRef);

    // Log audit
    await AuditService.logAction(
      userId,
      'delete' as any,
      'incomingPost' as any,
      postId,
      {
        companyId,
        metadata: { description: `Post verwijderd` },
      }
    );
  } catch (error) {
    console.error('Error deleting incoming post:', error);
    throw error;
  }
};

/**
 * Mark post as processed
 */
export const markPostAsProcessed = async (postId: string, userId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'incomingPost', postId);

    await updateDoc(docRef, {
      status: 'processed',
      processedBy: userId,
      processedDate: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error marking post as processed:', error);
    throw error;
  }
};

/**
 * Upload post-file (binnenkomende post) naar internedata.nl.
 * Gebruikt nu proxy2.php via de uniforme uploadFileToInternedata zodat
 * post in dezelfde folder-boom zit als facturen:
 *   FLG-Administratie/{companyId}__{slug}/Post/{year}/{yyyy-MM-dd}_{subject-slug}.ext
 *
 * Signature uitgebreid met optionele companyId, receivedDate en subject
 * voor een nette filename. Backwards-compat: zonder die velden valt het
 * terug op timestamp-based naamgeving en de legacy-structuur.
 */
export const uploadPostFile = async (
  file: File,
  companyName: string,
  opts?: {
    companyId?: string;
    receivedDate?: Date;
    subject?: string;
  }
): Promise<{ url: string; path: string }> => {
  try {
    const { uploadFileToInternedata, uploadFile, slugify } = await import('./fileUploadService');

    if (opts?.companyId) {
      // Nieuwe gestructureerde upload met jaar + nette filename
      const date = opts.receivedDate || new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const subjectSlug = opts.subject ? slugify(opts.subject) : 'post';
      const customFileName = `${yyyy}-${mm}-${dd}_${subjectSlug}`;

      const res = await uploadFileToInternedata({
        file,
        companyId: opts.companyId,
        companyName,
        folderType: 'Post',
        year: yyyy,
        customFileName,
      });
      return { url: res.fileUrl, path: res.storagePath };
    }

    // Legacy-fallback (oude aanroepen zonder companyId)
    const res = await uploadFile(file, companyName, 'Post', `post-${Date.now()}`);
    return { url: res.fileUrl, path: '' };
  } catch (error) {
    console.error('Error uploading post file:', error);
    throw error;
  }
};
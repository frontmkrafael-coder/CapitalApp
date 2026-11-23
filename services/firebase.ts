import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  User,
  verifyBeforeUpdateEmail,
  updateProfile,
  Auth,
  UserCredential,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocFromServer,
  collection,
  onSnapshot,
  query,
  where,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import {
  Transaction,
  UserStats,
  FinancialGoal,
  UserProfile,
  TransactionType,
  RecurringPayment,
  RecurringFrequency,
  CompanyRecord,
  EmploymentType,
} from "../types";

export { firebaseConfig };

// --- Structured Firestore Error Handling ---
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authInstance?.currentUser?.uid,
      email: authInstance?.currentUser?.email,
      emailVerified: authInstance?.currentUser?.emailVerified,
      isAnonymous: authInstance?.currentUser?.isAnonymous,
      tenantId: authInstance?.currentUser?.tenantId,
      providerInfo:
        authInstance?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Initialization ---
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let initError: Error | null = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  if (app) {
    authInstance = getAuth(app);
    try {
      dbInstance = initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
    try {
      authInstance.languageCode = "pt";
    } catch {
      // Ignore if environment does not allow mutating languageCode
    }
  }
} catch (e: unknown) {
  console.error("Failed to initialize Firebase Auth/Firestore", e);
  initError = e instanceof Error ? e : new Error(String(e));
}

export const auth = authInstance!;
export const db = dbInstance!;
export const firebaseInitializationError = initError;
export { onAuthStateChanged };

// --- Startup Connection Check ---
async function testConnection() {
  if (!dbInstance) return;
  try {
    await getDocFromServer(doc(dbInstance, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
if (typeof window !== "undefined") {
  testConnection();
}

// --- Helpers & Payload Sanitization (Synced with firebase-blueprint.json) ---
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const URL_PATTERN = /^https?:\/\/.+/;

function toMillis(val: unknown): number | undefined {
  if (typeof val === "number") return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === "object" && "toMillis" in val && typeof (val as { toMillis: () => number }).toMillis === "function") {
    return (val as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

function sanitizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function sanitizeOptionalUrl(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!URL_PATTERN.test(trimmed)) {
    throw new Error("A URL deve começar com http:// ou https://.");
  }
  return trimmed.slice(0, maxLength);
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function advanceRecurringDate(
  dateStr: string,
  frequency: RecurringFrequency,
  dayOfMonth: number
): string {
  const parts = DATE_PATTERN.test(dateStr)
    ? dateStr.split("-").map(Number)
    : getTodayIsoDate().split("-").map(Number);
  const [year, month, day] = parts;
  const targetDay = Math.min(31, Math.max(1, Math.round(dayOfMonth) || day));

  if (frequency === "weekly") {
    const dt = new Date(year, month - 1, day + 7);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (frequency === "biweekly") {
    const dt = new Date(year, month - 1, day + 14);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (frequency === "yearly") {
    const nextYear = year + 1;
    const maxDayInMonth = new Date(nextYear, month, 0).getDate();
    const clampedDay = Math.min(targetDay, maxDayInMonth);
    return `${nextYear}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
  }

  // monthly (default)
  const nextMonthIndex = month; // 0-indexed next month since `month` is 1..12
  const dt = new Date(year, nextMonthIndex, 1);
  const nextY = dt.getFullYear();
  const nextM = dt.getMonth() + 1;
  const maxDayInMonth = new Date(nextY, nextM, 0).getDate();
  const clampedDay = Math.min(targetDay, maxDayInMonth);
  return `${nextY}-${String(nextM).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

// --- Authentication Services (Google, Email/Password, GitHub) ---
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export const loginWithGoogle = async (): Promise<void> => {
  await signInWithPopup(auth, googleProvider);
};

export const loginWithGithub = async (): Promise<void> => {
  await signInWithPopup(auth, githubProvider);
};

export interface ExternalOAuthTokens {
  provider: "google" | "github";
  idToken?: string;
  accessToken?: string;
}

const extractOAuthTokens = (
  result: UserCredential,
  fallbackProvider?: "google" | "github"
): ExternalOAuthTokens | null => {
  const providerId = result.providerId || "";
  if (providerId.includes("google") || fallbackProvider === "google") {
    const cred = GoogleAuthProvider.credentialFromResult(result);
    if (cred?.idToken || cred?.accessToken) {
      return {
        provider: "google",
        idToken: cred.idToken,
        accessToken: cred.accessToken,
      };
    }
  }
  if (providerId.includes("github") || fallbackProvider === "github") {
    const cred = GithubAuthProvider.credentialFromResult(result);
    if (cred?.accessToken) {
      return {
        provider: "github",
        accessToken: cred.accessToken,
      };
    }
  }
  return null;
};

export const runExternalBrowserAuthBridge = async (
  provider: "google" | "github"
): Promise<ExternalOAuthTokens | null> => {
  const authProvider = provider === "google" ? googleProvider : githubProvider;
  try {
    const result = await signInWithPopup(auth, authProvider);
    const tokens = extractOAuthTokens(result, provider);
    if (!tokens) {
      throw new Error("Não foi possível obter o token OAuth do provedor.");
    }
    return tokens;
  } catch (err: any) {
    const code = err?.code || "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, authProvider);
      return null;
    }
    throw err;
  }
};

export const consumeExternalBrowserAuthRedirect = async (): Promise<ExternalOAuthTokens | null> => {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  return extractOAuthTokens(result);
};

export const signInWithNativeOAuthTokens = async (
  tokens: ExternalOAuthTokens
): Promise<UserCredential> => {
  if (tokens.provider === "google") {
    if (!tokens.idToken && !tokens.accessToken) {
      throw new Error("Token do Google ausente no retorno do login.");
    }
    const credential = GoogleAuthProvider.credential(
      tokens.idToken || null,
      tokens.accessToken || null
    );
    return await signInWithCredential(auth, credential);
  }
  if (tokens.provider === "github") {
    if (!tokens.accessToken) {
      throw new Error("Token do GitHub ausente no retorno do login.");
    }
    const credential = GithubAuthProvider.credential(tokens.accessToken);
    return await signInWithCredential(auth, credential);
  }
  throw new Error("Provedor OAuth não suportado.");
};

export const registerWithEmail = async (email: string, pass: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  try {
    await sendEmailVerification(userCredential.user);
  } catch {
    // Non-blocking verification email attempt
  }
  return userCredential.user;
};

export const loginWithEmail = async (email: string, pass: string): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(auth, email.trim(), pass);
};

export const resetPassword = async (email: string): Promise<void> => {
  return await sendPasswordResetEmail(auth, email.trim());
};

export const resendVerificationEmail = async (user: User): Promise<void> => {
  await sendEmailVerification(user);
};

export const updateUserEmail = async (user: User, newEmail: string): Promise<void> => {
  await verifyBeforeUpdateEmail(user, newEmail.trim());
};

export const logout = async (): Promise<void> => {
  if (auth) await signOut(auth);
};

export const setAuthPersistence = async (autoLogin: boolean): Promise<void> => {
  if (!auth) return;
  await setPersistence(auth, autoLogin ? browserLocalPersistence : browserSessionPersistence);
};

// --- Data Management (Firestore) ---
export const saveUserProfileToDB = async (user: User): Promise<void> => {
  if (!user) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, "users", user.uid);
  try {
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      const safeDisplayName = (user.displayName?.trim() || user.email?.split("@")[0] || "Usuário").slice(0, 100);
      const safePhoto =
        user.photoURL && URL_PATTERN.test(user.photoURL) ? user.photoURL.slice(0, 1000) : null;
      await setDoc(ref, {
        uid: user.uid,
        displayName: safeDisplayName,
        email: sanitizeOptionalString(user.email, 254),
        photoURL: safePhoto,
        emailVerified: Boolean(user.emailVerified),
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        lastLogin: serverTimestamp(),
        email: sanitizeOptionalString(user.email, 254),
        emailVerified: Boolean(user.emailVerified),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateUserProfileData = async (
  uid: string,
  data: Partial<UserProfile>
): Promise<Partial<UserProfile>> => {
  const path = `users/${uid}`;
  const safeDisplayName = (data.displayName?.trim() || "Usuário").slice(0, 100);
  const safePhotoURL = sanitizeOptionalUrl(data.photoURL, 1000);
  const safeWebsite = sanitizeOptionalUrl(data.website, 300);
  const safePhone = sanitizeOptionalString(data.phoneNumber, 30);
  const safeBio = sanitizeOptionalString(data.bio, 500);
  const safeJobTitle = sanitizeOptionalString(data.jobTitle, 100);

  const firestorePayload = {
    displayName: safeDisplayName,
    photoURL: safePhotoURL,
    phoneNumber: safePhone,
    bio: safeBio,
    jobTitle: safeJobTitle,
    website: safeWebsite,
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, firestorePayload);

    if (auth.currentUser && auth.currentUser.uid === uid) {
      try {
        await updateProfile(auth.currentUser, {
          displayName: safeDisplayName,
          photoURL: safePhotoURL || "",
        });
      } catch {
        // Auth profile sync is best-effort
      }
    }

    return {
      displayName: safeDisplayName,
      photoURL: safePhotoURL,
      phoneNumber: safePhone,
      bio: safeBio,
      jobTitle: safeJobTitle,
      website: safeWebsite,
      updatedAt: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const getUserProfileData = async (uid: string): Promise<UserProfile | null> => {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, "users", uid);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      const raw = docSnap.data();
      return {
        uid: raw.uid || uid,
        displayName: raw.displayName || "Usuário",
        email: raw.email ?? null,
        photoURL: raw.photoURL ?? null,
        emailVerified: Boolean(raw.emailVerified),
        phoneNumber: raw.phoneNumber ?? null,
        bio: raw.bio ?? null,
        jobTitle: raw.jobTitle ?? null,
        website: raw.website ?? null,
        createdAt: toMillis(raw.createdAt),
        lastLogin: toMillis(raw.lastLogin),
        updatedAt: toMillis(raw.updatedAt),
      };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const addTransaction = async (
  uid: string,
  transaction: Omit<Transaction, "id" | "createdAt">
): Promise<void> => {
  const colPath = `users/${uid}/transactions`;
  const description = transaction.description.trim().slice(0, 200);
  const category = transaction.category.trim().slice(0, 60);
  const amount = Number(transaction.amount);
  const date = DATE_PATTERN.test(transaction.date) ? transaction.date : getTodayIsoDate();
  const type =
    transaction.type === TransactionType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE;

  if (!description) throw new Error("Informe uma descrição válida.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new Error("Informe um valor numérico positivo válido.");
  }
  if (!category) throw new Error("Selecione uma categoria.");

  const ref = doc(collection(db, "users", uid, "transactions"));
  const path = `${colPath}/${ref.id}`;
  try {
    await setDoc(ref, {
      id: ref.id,
      userId: uid,
      description,
      amount,
      type,
      category,
      date,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteTransaction = async (uid: string, transactionId: string): Promise<void> => {
  const path = `users/${uid}/transactions/${transactionId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "transactions", transactionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

type Unsubscribe = () => void;

export const subscribeToTransactions = (
  uid: string,
  callback: (data: Transaction[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  const path = `users/${uid}/transactions`;
  const q = query(collection(db, "users", uid, "transactions"), where("userId", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const data: Transaction[] = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data();
        return {
          id: raw.id || docSnap.id,
          userId: raw.userId || uid,
          description: raw.description || "",
          amount: Number(raw.amount) || 0,
          type: raw.type === TransactionType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE,
          category: raw.category || "Outros",
          date: raw.date || getTodayIsoDate(),
          createdAt: toMillis(raw.createdAt) ?? 0,
          updatedAt: toMillis(raw.updatedAt),
        };
      });

      data.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      callback(data);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (structuredErr) {
        if (onError && structuredErr instanceof Error) onError(structuredErr);
      }
    }
  );
};

export const addGoal = async (uid: string, goal: Omit<FinancialGoal, "id">): Promise<void> => {
  const colPath = `users/${uid}/goals`;
  const title = goal.title.trim().slice(0, 120);
  const targetAmount = Number(goal.targetAmount);
  const currentAmount = Math.max(0, Number(goal.currentAmount) || 0);
  const deadline = DATE_PATTERN.test(goal.deadline) ? goal.deadline : getTodayIsoDate();

  if (!title) throw new Error("Informe um título para a meta.");
  if (!Number.isFinite(targetAmount) || targetAmount <= 0 || targetAmount > 1_000_000_000) {
    throw new Error("O valor alvo da meta deve ser maior que zero.");
  }

  const ref = doc(collection(db, "users", uid, "goals"));
  const path = `${colPath}/${ref.id}`;
  try {
    await setDoc(ref, {
      id: ref.id,
      userId: uid,
      title,
      targetAmount,
      currentAmount,
      deadline,
      isAI: Boolean(goal.isAI),
      isCompleted: currentAmount >= targetAmount,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateGoal = async (
  uid: string,
  goalId: string,
  updates: Pick<Partial<FinancialGoal>, "currentAmount" | "isCompleted">
): Promise<void> => {
  const path = `users/${uid}/goals/${goalId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.currentAmount === "number") {
    if (!Number.isFinite(updates.currentAmount) || updates.currentAmount < 0 || updates.currentAmount > 1_000_000_000) {
      throw new Error("Valor acumulado inválido.");
    }
    payload.currentAmount = updates.currentAmount;
  }
  if (typeof updates.isCompleted === "boolean") {
    payload.isCompleted = updates.isCompleted;
  }

  try {
    await updateDoc(doc(db, "users", uid, "goals", goalId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const depositToGoalFromBalance = async (
  uid: string,
  goal: FinancialGoal,
  amount: number
): Promise<void> => {
  const parsedAmount = Number(amount);
  if (!goal?.id || !goal?.title) {
    throw new Error("Meta inválida para aporte.");
  }
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000_000) {
    throw new Error("Informe um valor de aporte positivo válido.");
  }

  const newTotal = Number((Number(goal.currentAmount || 0) + parsedAmount).toFixed(2));
  if (newTotal > 1_000_000_000) {
    throw new Error("Valor acumulado excede o limite permitido.");
  }

  const goalRef = doc(db, "users", uid, "goals", goal.id);
  const txRef = doc(collection(db, "users", uid, "transactions"));
  const path = `users/${uid}/goals/${goal.id}`;

  try {
    const batch = writeBatch(db);
    batch.update(goalRef, {
      currentAmount: newTotal,
      isCompleted: goal.targetAmount > 0 && newTotal >= goal.targetAmount,
      updatedAt: serverTimestamp(),
    });
    batch.set(txRef, {
      id: txRef.id,
      userId: uid,
      description: `Aporte na meta: ${goal.title}`.slice(0, 200),
      amount: parsedAmount,
      type: TransactionType.EXPENSE,
      category: "Metas",
      date: getTodayIsoDate(),
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteGoal = async (uid: string, goalId: string): Promise<void> => {
  const path = `users/${uid}/goals/${goalId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "goals", goalId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeToGoals = (
  uid: string,
  callback: (data: FinancialGoal[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  const path = `users/${uid}/goals`;
  const q = query(collection(db, "users", uid, "goals"), where("userId", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const data: FinancialGoal[] = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data();
        return {
          id: raw.id || docSnap.id,
          userId: raw.userId || uid,
          title: raw.title || "",
          targetAmount: Number(raw.targetAmount) || 0,
          currentAmount: Number(raw.currentAmount) || 0,
          deadline: raw.deadline || getTodayIsoDate(),
          isAI: Boolean(raw.isAI),
          isCompleted: Boolean(raw.isCompleted),
          createdAt: toMillis(raw.createdAt),
          updatedAt: toMillis(raw.updatedAt),
        };
      });

      data.sort((a, b) => a.deadline.localeCompare(b.deadline));
      callback(data);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (structuredErr) {
        if (onError && structuredErr instanceof Error) onError(structuredErr);
      }
    }
  );
};

// --- Recurring Payments Services ---
const VALID_FREQUENCIES: RecurringFrequency[] = ["weekly", "biweekly", "monthly", "yearly"];

export const addRecurringPayment = async (
  uid: string,
  recurring: Omit<RecurringPayment, "id" | "createdAt" | "updatedAt">
): Promise<void> => {
  const colPath = `users/${uid}/recurring`;
  const description = recurring.description.trim().slice(0, 200);
  const category = recurring.category.trim().slice(0, 60);
  const amount = Number(recurring.amount);
  const type =
    recurring.type === TransactionType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE;
  const frequency: RecurringFrequency = VALID_FREQUENCIES.includes(recurring.frequency)
    ? recurring.frequency
    : "monthly";
  const dayOfMonth = Math.min(31, Math.max(1, Math.round(Number(recurring.dayOfMonth) || 1)));
  const startDate = DATE_PATTERN.test(recurring.startDate) ? recurring.startDate : getTodayIsoDate();
  const nextDueDate = DATE_PATTERN.test(recurring.nextDueDate)
    ? recurring.nextDueDate
    : startDate;

  if (!description) throw new Error("Informe uma descrição para o pagamento recorrente.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new Error("Informe um valor positivo válido.");
  }
  if (!category) throw new Error("Selecione uma categoria.");

  const ref = doc(collection(db, "users", uid, "recurring"));
  const path = `${colPath}/${ref.id}`;
  try {
    await setDoc(ref, {
      id: ref.id,
      userId: uid,
      description,
      amount,
      type,
      category,
      frequency,
      dayOfMonth,
      startDate,
      nextDueDate,
      lastExecutedDate: recurring.lastExecutedDate && DATE_PATTERN.test(recurring.lastExecutedDate)
        ? recurring.lastExecutedDate
        : null,
      autoProcess: Boolean(recurring.autoProcess),
      isActive: Boolean(recurring.isActive),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateRecurringPayment = async (
  uid: string,
  recurringId: string,
  updates: Partial<
    Pick<
      RecurringPayment,
      | "description"
      | "amount"
      | "type"
      | "category"
      | "frequency"
      | "dayOfMonth"
      | "nextDueDate"
      | "lastExecutedDate"
      | "autoProcess"
      | "isActive"
    >
  >
): Promise<void> => {
  const path = `users/${uid}/recurring/${recurringId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.description === "string") {
    const trimmed = updates.description.trim().slice(0, 200);
    if (!trimmed) throw new Error("Descrição inválida.");
    payload.description = trimmed;
  }
  if (typeof updates.amount === "number") {
    if (!Number.isFinite(updates.amount) || updates.amount <= 0 || updates.amount > 1_000_000_000) {
      throw new Error("Valor inválido.");
    }
    payload.amount = updates.amount;
  }
  if (updates.type === TransactionType.INCOME || updates.type === TransactionType.EXPENSE) {
    payload.type = updates.type;
  }
  if (typeof updates.category === "string") {
    const trimmed = updates.category.trim().slice(0, 60);
    if (!trimmed) throw new Error("Categoria inválida.");
    payload.category = trimmed;
  }
  if (updates.frequency && VALID_FREQUENCIES.includes(updates.frequency)) {
    payload.frequency = updates.frequency;
  }
  if (typeof updates.dayOfMonth === "number") {
    payload.dayOfMonth = Math.min(31, Math.max(1, Math.round(updates.dayOfMonth)));
  }
  if (typeof updates.nextDueDate === "string" && DATE_PATTERN.test(updates.nextDueDate)) {
    payload.nextDueDate = updates.nextDueDate;
  }
  if (updates.lastExecutedDate === null) {
    payload.lastExecutedDate = null;
  } else if (typeof updates.lastExecutedDate === "string" && DATE_PATTERN.test(updates.lastExecutedDate)) {
    payload.lastExecutedDate = updates.lastExecutedDate;
  }
  if (typeof updates.autoProcess === "boolean") {
    payload.autoProcess = updates.autoProcess;
  }
  if (typeof updates.isActive === "boolean") {
    payload.isActive = updates.isActive;
  }

  try {
    await updateDoc(doc(db, "users", uid, "recurring", recurringId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const executeRecurringPaymentBatch = async (
  uid: string,
  recurring: RecurringPayment,
  executedDate: string,
  nextDueDate: string
): Promise<void> => {
  const safeExecDate = DATE_PATTERN.test(executedDate) ? executedDate : getTodayIsoDate();
  const safeNextDueDate = DATE_PATTERN.test(nextDueDate)
    ? nextDueDate
    : advanceRecurringDate(safeExecDate, recurring.frequency, recurring.dayOfMonth);
  const recurringRef = doc(db, "users", uid, "recurring", recurring.id);
  const txRef = doc(collection(db, "users", uid, "transactions"));
  const path = `users/${uid}/recurring/${recurring.id}`;

  try {
    const batch = writeBatch(db);
    batch.set(txRef, {
      id: txRef.id,
      userId: uid,
      description: `${recurring.description} (Recorrente)`.slice(0, 200),
      amount: Number(recurring.amount),
      type: recurring.type === TransactionType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE,
      category: recurring.category.slice(0, 60),
      date: safeExecDate,
      createdAt: serverTimestamp(),
    });
    batch.update(recurringRef, {
      lastExecutedDate: safeExecDate,
      nextDueDate: safeNextDueDate,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteRecurringPayment = async (uid: string, recurringId: string): Promise<void> => {
  const path = `users/${uid}/recurring/${recurringId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "recurring", recurringId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeToRecurringPayments = (
  uid: string,
  callback: (data: RecurringPayment[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  const path = `users/${uid}/recurring`;
  const q = query(collection(db, "users", uid, "recurring"), where("userId", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const data: RecurringPayment[] = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data();
        const freq: RecurringFrequency = VALID_FREQUENCIES.includes(raw.frequency)
          ? raw.frequency
          : "monthly";
        return {
          id: raw.id || docSnap.id,
          userId: raw.userId || uid,
          description: raw.description || "",
          amount: Number(raw.amount) || 0,
          type: raw.type === TransactionType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE,
          category: raw.category || "Contas",
          frequency: freq,
          dayOfMonth: Number(raw.dayOfMonth) || 1,
          startDate: raw.startDate || getTodayIsoDate(),
          nextDueDate: raw.nextDueDate || getTodayIsoDate(),
          lastExecutedDate: raw.lastExecutedDate ?? null,
          autoProcess: Boolean(raw.autoProcess),
          isActive: raw.isActive !== false,
          createdAt: toMillis(raw.createdAt),
          updatedAt: toMillis(raw.updatedAt),
        };
      });

      data.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
      callback(data);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (structuredErr) {
        if (onError && structuredErr instanceof Error) onError(structuredErr);
      }
    }
  );
};

// --- Companies Services ---
function buildSanitizedCompanyFields(
  company: Omit<CompanyRecord, "id" | "createdAt" | "updatedAt">
) {
  const name = company.name.trim().slice(0, 120);
  if (!name) throw new Error("Informe o nome da empresa.");

  const cnpj = sanitizeOptionalString(company.cnpj, 18);
  const admissionDate = DATE_PATTERN.test(company.admissionDate)
    ? company.admissionDate
    : getTodayIsoDate();
  const employmentType: EmploymentType =
    company.employmentType === "freelancer" ? "freelancer" : "fixed";

  if (employmentType === "fixed") {
    const baseSalary = Number(company.baseSalary);
    const paymentDay = Math.round(Number(company.paymentDay));
    const hasAdvance =
      company.advanceDay !== null &&
      company.advanceDay !== undefined &&
      String(company.advanceDay) !== "";
    const advanceDay = hasAdvance ? Math.round(Number(company.advanceDay)) : null;

    if (!Number.isFinite(baseSalary) || baseSalary <= 0 || baseSalary > 1_000_000_000) {
      throw new Error("Informe um salário base maior que zero.");
    }
    if (!Number.isFinite(paymentDay) || paymentDay < 1 || paymentDay > 31) {
      throw new Error("Informe um dia de pagamento válido (1 a 31).");
    }
    if (advanceDay !== null && (!Number.isFinite(advanceDay) || advanceDay < 1 || advanceDay > 31)) {
      throw new Error("O dia de adiantamento salarial deve estar entre 1 e 31.");
    }

    return {
      name,
      cnpj,
      employmentType,
      admissionDate,
      baseSalary,
      paymentDay,
      advanceDay,
      dailyRate: null as number | null,
    };
  }

  const dailyRate = Number(company.dailyRate);
  if (!Number.isFinite(dailyRate) || dailyRate <= 0 || dailyRate > 1_000_000_000) {
    throw new Error("Informe o valor da diária maior que zero.");
  }

  return {
    name,
    cnpj,
    employmentType,
    admissionDate,
    baseSalary: null as number | null,
    paymentDay: null as number | null,
    advanceDay: null as number | null,
    dailyRate,
  };
}

export const addCompany = async (
  uid: string,
  company: Omit<CompanyRecord, "id" | "createdAt" | "updatedAt">
): Promise<void> => {
  const colPath = `users/${uid}/companies`;
  const sanitized = buildSanitizedCompanyFields(company);
  const ref = doc(collection(db, "users", uid, "companies"));
  const path = `${colPath}/${ref.id}`;
  try {
    await setDoc(ref, {
      id: ref.id,
      userId: uid,
      ...sanitized,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateCompany = async (
  uid: string,
  companyId: string,
  company: Omit<CompanyRecord, "id" | "createdAt" | "updatedAt">
): Promise<void> => {
  const path = `users/${uid}/companies/${companyId}`;
  const sanitized = buildSanitizedCompanyFields(company);
  try {
    await updateDoc(doc(db, "users", uid, "companies", companyId), {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteCompany = async (uid: string, companyId: string): Promise<void> => {
  const path = `users/${uid}/companies/${companyId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "companies", companyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeToCompanies = (
  uid: string,
  callback: (data: CompanyRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  const path = `users/${uid}/companies`;
  const q = query(collection(db, "users", uid, "companies"), where("userId", "==", uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const data: CompanyRecord[] = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data();
        const employmentType: EmploymentType =
          raw.employmentType === "freelancer" ? "freelancer" : "fixed";
        return {
          id: raw.id || docSnap.id,
          userId: raw.userId || uid,
          name: raw.name || "",
          cnpj: raw.cnpj ?? null,
          employmentType,
          admissionDate: raw.admissionDate || getTodayIsoDate(),
          baseSalary: typeof raw.baseSalary === "number" ? raw.baseSalary : null,
          paymentDay: typeof raw.paymentDay === "number" ? raw.paymentDay : null,
          advanceDay: typeof raw.advanceDay === "number" ? raw.advanceDay : null,
          dailyRate: typeof raw.dailyRate === "number" ? raw.dailyRate : null,
          createdAt: toMillis(raw.createdAt),
          updatedAt: toMillis(raw.updatedAt),
        };
      });

      data.sort((a, b) => b.admissionDate.localeCompare(a.admissionDate));
      callback(data);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (structuredErr) {
        if (onError && structuredErr instanceof Error) onError(structuredErr);
      }
    }
  );
};

export const markAIUsage = async (uid: string): Promise<void> => {
  const path = `users/${uid}/stats/data`;
  try {
    const ref = doc(db, "users", uid, "stats", "data");
    await setDoc(
      ref,
      {
        userId: uid,
        hasUsedAI: true,
        lastAnalysisDate: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const subscribeToStats = (
  uid: string,
  callback: (stats: UserStats) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  const path = `users/${uid}/stats/data`;
  return onSnapshot(
    doc(db, "users", uid, "stats", "data"),
    (docSnap) => {
      if (docSnap.exists()) {
        const raw = docSnap.data();
        callback({
          userId: raw.userId || uid,
          hasUsedAI: Boolean(raw.hasUsedAI),
          lastAnalysisDate: toMillis(raw.lastAnalysisDate),
        });
      } else {
        callback({});
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (structuredErr) {
        if (onError && structuredErr instanceof Error) onError(structuredErr);
      }
    }
  );
};

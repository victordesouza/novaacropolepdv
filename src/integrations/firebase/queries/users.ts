import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../client';
import { User } from '../types';

export async function getUsers(): Promise<User[]> {
  const q = query(collection(db, 'users'), orderBy('username'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as User));
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : ({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User);
}

export async function getUserById(id: string): Promise<User | null> {
  const docSnap = await getDoc(doc(db, 'users', id));
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as User) : null;
}

export async function createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'users'), {
    ...user,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'users', id), updates);
}

export async function deleteUser(id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', id));
}

export async function validateUser(username: string, password: string): Promise<User | null> {
  const allUsers = await getUsers();
  const user = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (user && user.password === password) {
    return user;
  }
  return null;
}

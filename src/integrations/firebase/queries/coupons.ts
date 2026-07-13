import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../client';
import type { Coupon } from '../types';

function toCoupon(id: string, data: Omit<Coupon, 'id'>): Coupon {
  return { id, ...data } as Coupon;
}

export async function getCoupons(): Promise<Coupon[]> {
  const snapshot = await getDocs(query(collection(db, 'coupons'), orderBy('name')));
  return snapshot.docs.map((doc) => toCoupon(doc.id, doc.data() as Omit<Coupon, 'id'>));
}

export async function createCoupon(coupon: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'coupons'), {
    ...coupon,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCoupon(id: string, updates: Partial<Omit<Coupon, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'coupons', id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCoupon(id: string): Promise<void> {
  await deleteDoc(doc(db, 'coupons', id));
}

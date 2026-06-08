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
  DocumentReference,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../client';
import { Product, productConverter } from '../types';

export async function getProducts(filters?: {
  category?: string;
  isBook?: boolean;
}): Promise<Product[]> {
  const constraints: QueryConstraint[] = [orderBy('name')];

  if (filters?.category && filters.category !== 'Todas') {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters?.isBook !== undefined) {
    constraints.push(where('isBook', '==', filters.isBook));
  }

  const q = query(collection(db, 'products'), ...constraints);
  const snapshot = await getDocs(q.withConverter(productConverter));
  return snapshot.docs.map(doc => doc.data());
}

export async function searchProducts(searchTerm: string): Promise<Product[]> {
  if (!searchTerm.trim()) return [];

  const term = searchTerm.toLowerCase();
  const allProducts = await getProducts();

  return allProducts.filter(product => {
    const nameMatch = product.name.toLowerCase().includes(term);
    const barcodeMatch = product.barcode?.toLowerCase().includes(term);
    const authorMatch = product.author?.toLowerCase().includes(term);
    return nameMatch || barcodeMatch || authorMatch;
  });
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const snapshot = await getDocs(
    query(collection(db, 'products'), where('barcode', '==', barcode)).withConverter(productConverter)
  );
  return snapshot.empty ? null : snapshot.docs[0].data();
}

export async function getProductById(id: string): Promise<Product | null> {
  const docRef = doc(db, 'products', id).withConverter(productConverter);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

export async function getLowStockProducts(threshold: number = 5): Promise<Product[]> {
  const q = query(
    collection(db, 'products'),
    where('stockQuantity', '<=', threshold),
    orderBy('stockQuantity')
  );
  const snapshot = await getDocs(q.withConverter(productConverter));
  return snapshot.docs.map(doc => doc.data());
}

export async function createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<DocumentReference> {
  return addDoc(collection(db, 'products'), {
    ...product,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProduct(id: string, updates: Partial<Omit<Product, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'products', id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, 'products', id));
}

export async function updateProductStock(id: string, newQuantity: number): Promise<void> {
  await updateDoc(doc(db, 'products', id), {
    stockQuantity: newQuantity,
    updatedAt: serverTimestamp(),
  });
}

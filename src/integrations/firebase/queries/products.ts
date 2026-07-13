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

function toProduct(id: string, data: Omit<Product, 'id'>): Product {
  return {
    id,
    stockAlertMinimum: 1,
    tags: [],
    ...data,
  } as Product;
}

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
  return snapshot.docs.map(doc => toProduct(doc.id, doc.data() as Omit<Product, 'id'>));
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
  return snapshot.empty ? null : toProduct(snapshot.docs[0].id, snapshot.docs[0].data() as Omit<Product, 'id'>);
}

export async function getProductById(id: string): Promise<Product | null> {
  const docRef = doc(db, 'products', id).withConverter(productConverter);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? toProduct(docSnap.id, docSnap.data() as Omit<Product, 'id'>) : null;
}

export async function getLowStockProducts(threshold: number = 5): Promise<Product[]> {
  const snapshot = await getDocs(query(collection(db, 'products')).withConverter(productConverter));
  return snapshot.docs
    .map(doc => toProduct(doc.id, doc.data() as Omit<Product, 'id'>))
    .filter((product) => product.stockQuantity <= (product.stockAlertMinimum ?? threshold))
    .sort((left, right) => left.stockQuantity - right.stockQuantity);
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

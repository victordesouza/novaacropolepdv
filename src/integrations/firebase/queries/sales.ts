import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  serverTimestamp,
  runTransaction,
  Timestamp,
  Query,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../client';
import { Sale, SaleItem, saleConverter } from '../types';
import { getProductById } from './products';

export async function createSaleWithItems(
  sale: Omit<Sale, 'id' | 'createdAt'>,
  items: Array<Omit<SaleItem, 'id' | 'createdAt'> & { productId: string; quantity: number; unitPrice: number }>,
  stockUpdates: Array<{ productId: string; newQuantity: number }>
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const saleId = await runTransaction(db, async (transaction) => {
        // 1. Create sale
        const saleRef = doc(collection(db, 'sales'));
        transaction.set(saleRef, {
          ...sale,
          createdAt: serverTimestamp(),
        });

        // 2. Add sale items as subcollection
        for (const item of items) {
          const itemRef = doc(collection(db, `sales/${saleRef.id}/items`));
          transaction.set(itemRef, {
            ...item,
            createdAt: serverTimestamp(),
          });
        }

        // 3. Update product stock
        for (const { productId, newQuantity } of stockUpdates) {
          const prodRef = doc(db, 'products', productId);
          transaction.update(prodRef, {
            stockQuantity: newQuantity,
            updatedAt: serverTimestamp(),
          });
        }

        return saleRef.id;
      });

      resolve(saleId);
    } catch (error) {
      reject(error);
    }
  });
}

export async function getSales(
  startDate?: Date,
  endDate?: Date,
  limit?: number
): Promise<Sale[]> {
  let constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

  if (startDate) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(startDate)));
  }
  if (endDate) {
    constraints.push(where('createdAt', '<=', Timestamp.fromDate(endDate)));
  }
  if (limit) {
    // Note: Firestore limit() not included in constraints array, applied to query directly
  }

  const q = query(collection(db, 'sales'), ...constraints);
  const snapshot = await getDocs(q.withConverter(saleConverter));
  return snapshot.docs.map(doc => doc.data()).slice(0, limit);
}

export async function getSalesCount(startDate?: Date, endDate?: Date): Promise<number> {
  let constraints: QueryConstraint[] = [];

  if (startDate) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(startDate)));
  }
  if (endDate) {
    constraints.push(where('createdAt', '<=', Timestamp.fromDate(endDate)));
  }

  const q = query(collection(db, 'sales'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.size;
}

export async function getSalesTotalAmount(startDate?: Date, endDate?: Date): Promise<number> {
  let constraints: QueryConstraint[] = [];

  if (startDate) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(startDate)));
  }
  if (endDate) {
    constraints.push(where('createdAt', '<=', Timestamp.fromDate(endDate)));
  }

  const q = query(collection(db, 'sales'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.reduce((sum, doc) => sum + (doc.data().totalAmount || 0), 0);
}

export async function getSaleWithItems(saleId: string): Promise<(Sale & { items: SaleItem[] }) | null> {
  const saleRef = doc(db, 'sales', saleId).withConverter(saleConverter);
  const saleSnap = await getDoc(saleRef);

  if (!saleSnap.exists()) return null;

  const itemsSnapshot = await getDocs(collection(db, `sales/${saleId}/items`));
  const items: SaleItem[] = [];

  for (const itemSnap of itemsSnapshot.docs) {
    const itemData = itemSnap.data() as Omit<SaleItem, 'product'>;
    const product = await getProductById(itemData.productId);

    items.push({
      id: itemSnap.id,
      ...itemData,
      product,
    });
  }

  return {
    ...saleSnap.data(),
    items,
  };
}

export async function getAllSalesWithItems(): Promise<Array<Sale & { items: SaleItem[] }>> {
  const salesSnapshot = await getDocs(collection(db, 'sales').withConverter(saleConverter));
  const results = [];

  for (const saleDoc of salesSnapshot.docs) {
    const sale = saleDoc.data();
    const itemsSnapshot = await getDocs(collection(db, `sales/${sale.id}/items`));

    const items: SaleItem[] = [];
    for (const itemSnap of itemsSnapshot.docs) {
      const itemData = itemSnap.data() as Omit<SaleItem, 'product'>;
      const product = await getProductById(itemData.productId);
      items.push({
        id: itemSnap.id,
        ...itemData,
        product,
      });
    }

    results.push({
      ...sale,
      items,
    });
  }

  return results;
}

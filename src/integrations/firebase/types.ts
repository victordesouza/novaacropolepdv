// Firestore Schemas & Types

export interface Product {
  id: string;
  name: string;
  barcode: string;
  description?: string;
  category: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  imageUrl?: string;
  isBook: boolean;
  author?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface Sale {
  id: string;
  totalAmount: number;
  paymentMethod: string;
  customerName?: string;
  createdAt: any; // Firestore Timestamp
}

export interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  createdAt: any; // Firestore Timestamp
  product?: Product; // Populated after join
}

export interface User {
  id: string;
  username: string;
  password: string; // Note: Plain text for compatibility with existing auth
  role: 'Admin' | 'Operador';
  createdAt: any; // Firestore Timestamp
}

// Firestore Converter para auto-conversão
import { DocumentData, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';

export const productConverter = {
  toFirestore: (product: Partial<Product>) => product,
  fromFirestore: (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions): Product => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      ...data,
    } as Product;
  },
};

export const saleConverter = {
  toFirestore: (sale: Partial<Sale>) => sale,
  fromFirestore: (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions): Sale => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      ...data,
    } as Sale;
  },
};

export const userConverter = {
  toFirestore: (user: Partial<User>) => user,
  fromFirestore: (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions): User => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      ...data,
    } as User;
  },
};

// Firestore Schemas & Types

export interface Product {
  id: string;
  name: string;
  barcode: string;
  description?: string;
  category: string;
  price: number;
  stockQuantity: number;
  stockAlertMinimum: number;
  tags: string[];
  imageUrl?: string;
  isBook: boolean;
  author?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export type CouponDiscountType = 'percent' | 'currency';

export interface Coupon {
  id: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive';
  createdAt: any;
  updatedAt: any;
}

export interface Sale {
  id: string;
  totalAmount: number;
  paymentMethod: string;
  customerName?: string;
  sellerUserId?: string;
  sellerUsername?: string;
  discountType?: CouponDiscountType | 'sale';
  discountValue?: number;
  discountAmount?: number;
  createdAt: any; // Firestore Timestamp
}

export interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  couponId?: string | null;
  couponName?: string | null;
  couponDiscountType?: CouponDiscountType | null;
  couponDiscountValue?: number | null;
  couponDiscountAmount?: number | null;
  createdAt: any; // Firestore Timestamp
  product?: Product; // Populated after join
}

export interface User {
  id: string;
  username: string;
  password: string; // Note: Plain text for compatibility with existing auth
  role: 'Administrador' | 'Recepção' | 'Admin' | 'Operador';
  createdAt: any; // Firestore Timestamp
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  actorUsername: string;
  actorRole: 'Administrador' | 'Recepção';
  subjectUserId?: string;
  subjectUsername?: string;
  area: string;
  action: string;
  data: any;
  createdAt: any;
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

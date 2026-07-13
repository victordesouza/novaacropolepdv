# Firebase Security Rules

## Firestore Rules
Copie e cole isto no Firebase Console → Firestore Database → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Products: Anyone can read, authenticated can write
    match /products/{document=**} {
      allow read: if true;
      allow create, update, delete: if true;
    }
    
    // Sales: Anyone can read and write
    match /sales/{document=**} {
      allow read, create, update, delete: if true;
      allow read, create, update, delete: if true;
    }
    
    // Sales subcollection items
    match /sales/{saleId}/items/{document=**} {
      allow read, create, update, delete: if true;
    }
    
    // Users: Anyone can read and write
    match /users/{document=**} {
      allow read, create, update, delete: if true;
    }

    // Audit logs: Anyone can read and write
    match /auditLogs/{document=**} {
      allow read, create, update, delete: if true;
    }

    // Coupons: Anyone can read and write
    match /coupons/{document=**} {
      allow read, create, update, delete: if true;
    }
  }
}
```

## Cloud Storage Rules
Copie e cole isto no Firebase Console → Storage → Rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /product-images/{allPaths=**} {
      allow read: if true;
      allow create, update, delete: if true;
    }
  }
}
```

## Instruções:
1. Abra https://console.firebase.google.com
2. Selecione seu projeto
3. Vá em Build → Firestore Database → Rules
4. Copie e cole as Firestore Rules acima
5. Clique "Publish"
6. Vá em Build → Storage → Rules
7. Copie e cole as Storage Rules acima
8. Clique "Publish"

Se você usa Firebase CLI, também pode publicar direto do repositório com `firebase deploy --only firestore:rules` depois de apontar o projeto para `firestore.rules`.

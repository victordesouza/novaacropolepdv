// Buscar imagem de produto/livro na internet

export interface BookSuggestion {
  title: string;
  author: string;
  description?: string;
  thumbnail?: string;
  barcode?: string;
  category?: string;
}

export async function searchBookSuggestions(query: string): Promise<BookSuggestion[]> {
  if (!query || query.length < 3) return [];

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&langRestrict=pt`;
    const response = await fetch(url);
    
    if (!response.ok) return [];
    
    const data = await response.json();
    if (!data.items) return [];

    return data.items.map((item: any) => {
      const info = item.volumeInfo;
      const isbn13 = info.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier;
      const isbn10 = info.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')?.identifier;

      return {
        title: info.title,
        author: info.authors ? info.authors.join(', ') : '',
        description: info.description || '',
        thumbnail: info.imageLinks?.thumbnail?.replace('http:', 'https:').replace('&edge=curl', ''),
        barcode: isbn13 || isbn10 || '',
        category: 'Livraria'
      };
    });
  } catch (error) {
    console.error('Erro ao buscar sugestões de livros:', error);
    return [];
  }
}

export async function searchBookCover(title: string, author?: string, barcode?: string): Promise<string | null> {
// ... existing code ...
  try {
    // 1. Tentar por ISBN se tiver código de barras (10 ou 13 dígitos)
    if (barcode && (barcode.length === 10 || barcode.length === 13) && /^\d+$/.test(barcode)) {
      const isbnUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${barcode}`;
      const isbnResponse = await fetch(isbnUrl);
      if (isbnResponse.ok) {
        const data = await isbnResponse.json();
        if (data.items && data.items.length > 0) {
          const thumbnail = data.items[0].volumeInfo.imageLinks?.thumbnail;
          if (thumbnail) return thumbnail.replace('http:', 'https:').replace('&edge=curl', '');
        }
      }
    }

    // 2. Tentar Google Books API por título/autor
    const query = author 
      ? `intitle:${title}+inauthor:${author}`
      : `intitle:${title}`;
    
    const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`;
    const gbResponse = await fetch(googleBooksUrl);
    
    if (gbResponse.ok) {
      const data = await gbResponse.json();
      if (data.items && data.items.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        let thumbnail = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail;
        
        if (thumbnail) {
          thumbnail = thumbnail.replace('http:', 'https:');
          thumbnail = thumbnail.replace('&edge=curl', '');
          return thumbnail;
        }
      }
    }

    // 3. Fallback: Open Library API
    const encodedTitle = encodeURIComponent(title);
    const openLibraryUrl = `https://openlibrary.org/search.json?title=${encodedTitle}${author ? `&author=${encodeURIComponent(author)}` : ''}&limit=1`;
    
    const olResponse = await fetch(openLibraryUrl);
    if (olResponse.ok) {
      const olData = await olResponse.json();
      if (olData.docs && olData.docs.length > 0 && olData.docs[0].cover_i) {
        return `https://covers.openlibrary.org/b/id/${olData.docs[0].cover_i}-L.jpg`;
      }
    }

    return null;
  } catch (error) {
    console.error('Erro ao buscar capa de livro:', error);
    return null;
  }
}

export async function searchGenericImage(productName: string): Promise<string | null> {
  try {
    const encodedName = encodeURIComponent(`${productName} product`);
    
    // Tentar Unsplash
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodedName}&per_page=1&order_by=relevant`,
      {
        headers: {
          'Accept-Version': 'v1'
        }
      }
    );

    if (response.ok) {
      const data = await response.json() as any;
      if (data.results && data.results.length > 0) {
        return data.results[0].urls.regular;
      }
    }

    // Fallback: Google Books (alguns produtos aparecem lá)
    const gbResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodedName}&maxResults=1`);
    if (gbResponse.ok) {
      const data = await gbResponse.json();
      if (data.items && data.items.length > 0) {
        const thumb = data.items[0].volumeInfo.imageLinks?.thumbnail;
        if (thumb) return thumb.replace('http:', 'https:');
      }
    }

    return null;
  } catch (error) {
    console.error('Erro ao buscar imagem genérica:', error);
    return null;
  }
}

export async function searchProductImage(
  productName: string,
  author?: string,
  isBook?: boolean,
  barcode?: string
): Promise<string | null> {
  if (isBook) {
    return await searchBookCover(productName, author, barcode);
  } else {
    return await searchGenericImage(productName);
  }
}

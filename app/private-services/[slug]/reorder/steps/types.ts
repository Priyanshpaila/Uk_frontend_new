export type StepKey = 'treatments' | 'login' | 'raf' | 'calendar' | 'payment';

export type Variation = {
  id: number;
  title: string;
  price: number | string | null;
  stock: number;
  max_qty?: number;
  status: 'draft' | 'published';
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  desc: string | null;         // html
  image?: string | null;
  min_price?: number | null;
  variations: Variation[];
};

export type CatalogResponse = {
  service: { slug: string; name: string };
  products: Product[];
};
/** Paged list response used by the catalog and admin toy lists. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginate<T>(all: T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize, totalPages, hasMore: start + pageSize < all.length };
}

export const CATALOG_SORTS = ['best', 'popular', 'newest', 'age'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];
export const CATALOG_SORT_LABELS: Record<CatalogSort, string> = {
  best: 'Best match',
  popular: 'Popular',
  newest: 'Newest',
  age: 'Age: low to high',
};

export const ADMIN_TOY_SORTS = ['name', 'recent', 'rented', 'stock'] as const;
export type AdminToySort = (typeof ADMIN_TOY_SORTS)[number];
export const ADMIN_TOY_SORT_LABELS: Record<AdminToySort, string> = {
  name: 'Name',
  recent: 'Recently added',
  rented: 'Most rented',
  stock: 'Lowest stock',
};

export const ADMIN_TOY_FILTERS = ['noPhotos', 'outOfStock', 'hasDamaged'] as const;
export type AdminToyFilter = (typeof ADMIN_TOY_FILTERS)[number];
export const ADMIN_TOY_FILTER_LABELS: Record<AdminToyFilter, string> = {
  noPhotos: 'No photos yet',
  outOfStock: 'Out of stock',
  hasDamaged: 'Has damaged units',
};

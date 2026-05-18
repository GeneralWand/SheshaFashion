/**
 * Values for `products.size` (Postgres `size_enum`).
 * Align these with your DB enum labels (case-sensitive). Adjust if your enum differs.
 */
export const PRODUCT_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
  { value: 'XXL', label: 'XXL' },
  { value: 'XXXL', label: 'XXXL' },
  { value: 'ONE_SIZE', label: 'One size' },
];

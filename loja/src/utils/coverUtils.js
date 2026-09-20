export function getCoverImage(product) {
  if (!product || !Array.isArray(product.images) || product.images.length === 0) {
    return '/placeholder.png';
  }

  const index = resolveCoverIndex(product);
  return product.images[index] || product.images[0];
}

export function resolveCoverIndex(product, preferredIndex = null) {
  if (!product || !Array.isArray(product.images) || product.images.length === 0) {
    return 0;
  }

  if (
    Number.isInteger(preferredIndex) &&
    preferredIndex >= 0 &&
    preferredIndex < product.images.length
  ) {
    return preferredIndex;
  }

  const storedIndex =
    product.mainImageIndex !== undefined && product.mainImageIndex !== null
      ? Number(product.mainImageIndex)
      : 0;

  return Number.isInteger(storedIndex) &&
    storedIndex >= 0 &&
    storedIndex < product.images.length
    ? storedIndex
    : 0;
}

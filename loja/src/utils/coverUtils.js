export function getCoverImage(product) {
    if (!product || !product.images || product.images.length === 0) {
        return '/placeholder.png';
    }
    const index = product.mainImageIndex !== undefined && product.mainImageIndex !== null 
        ? product.mainImageIndex 
        : 0;
    return product.images[index] || product.images[0];
}

export function resolveCoverIndex(product) {
    if (!product) return 0;
    return product.mainImageIndex !== undefined && product.mainImageIndex !== null 
        ? product.mainImageIndex 
        : 0;
}

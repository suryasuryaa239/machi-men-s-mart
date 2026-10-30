import React, { useState, memo } from 'react';
import { Eye, ArrowUpRight, Heart } from 'lucide-react';
import './ProductCard.css';

function ProductCard({
  product,
  onQuickView,
  isInWishlist = false,
  onToggleWishlist,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0] || null);

  const hasHoverImage = Boolean(product.hoverImage);

  return (
    <article
      className="streetwear-product-card"
      data-id={product.id}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Product Image Canvas */}
      <div
        className="card-media-wrapper"
        onClick={() =>
          onQuickView({
            ...product,
            selectedColor: selectedColor || product.colors?.[0],
          })
        }
        role="button"
        tabIndex={0}
        aria-label={`View ${product.name} 360 preview`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onQuickView({
              ...product,
              selectedColor: selectedColor || product.colors?.[0],
            });
          }
        }}
      >
        {/* Wishlist Heart Toggle Button (Step 12) */}
        <button
          type="button"
          className={`card-wishlist-toggle ${isInWishlist ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleWishlist) {
              onToggleWishlist(product, selectedColor);
            }
          }}
          aria-label={isInWishlist ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          title={isInWishlist ? 'Saved in Wishlist' : 'Save to Wishlist'}
          id={`wishlist-toggle-${product.id}`}
        >
          <Heart
            size={16}
            fill={isInWishlist ? '#EF4444' : 'none'}
            color={isInWishlist ? '#EF4444' : '#111113'}
            strokeWidth={isInWishlist ? 0 : 2}
          />
        </button>

        {/* Badge */}
        {product.badge && (
          <span className={`card-badge badge-${product.badgeType || 'dark'}`}>
            {product.badge}
          </span>
        )}

        {/* Primary Image */}
        <img
          src={isHovered && hasHoverImage ? product.hoverImage : (selectedColor?.image || product.image)}
          alt={`${product.name}${selectedColor?.name ? ` in ${selectedColor.name}` : ''} – ${product.subTitle || 'Oversized Streetwear'}`}
          className={`card-product-img ${isHovered && hasHoverImage ? 'is-alternate' : ''}`}
          loading="lazy"
          decoding="async"
        />

        {/* Quick View Button */}
        <div className="card-quick-actions">
          <button
            type="button"
            className="card-quick-view-btn"
            onClick={() =>
              onQuickView({
                ...product,
                selectedColor: selectedColor || product.colors?.[0],
              })
            }
            aria-label={`Quick view ${product.name}`}
          >
            <Eye size={15} />
            <span>QUICK VIEW</span>
          </button>
        </div>

        {/* Available Sizes Bar (Hover preview) */}
        <div className="card-sizes-preview" aria-hidden="true">
          <span className="sizes-label">SIZES:</span>
          <div className="sizes-chips">
            {product.sizes?.map((sz) => (
              <span key={sz} className="size-badge">
                {sz}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Product Information */}
      <div className="card-info-block">
        <div className="card-header-row">
          <span className="card-gsm-tag">{product.gsm}</span>
          {/* Color Swatches */}
          {product.colors && product.colors.length > 0 && (
            <div className="color-swatches" aria-label="Available Colors">
              {product.colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`color-dot ${selectedColor?.name === c.name ? 'selected' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedColor(c);
                  }}
                  aria-label={`Select ${c.name} color`}
                />
              ))}
            </div>
          )}
        </div>

        <h3 className="card-product-title">
          <button
            type="button"
            className="title-button-link"
            onClick={() =>
              onQuickView({
                ...product,
                selectedColor: selectedColor || product.colors?.[0],
              })
            }
          >
            {product.name}
          </button>
        </h3>

        {product.subTitle && <p className="card-product-sub">{product.subTitle}</p>}

        <div className="card-price-row">
          <span className="price-current">{product.price}</span>
          {product.originalPrice && (
            <span className="price-strikethrough">{product.originalPrice}</span>
          )}
          <button
            type="button"
            className="card-inspect-arrow-btn"
            onClick={() => onQuickView(product)}
            aria-label={`Inspect ${product.name}`}
            title="Inspect"
          >
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

export default memo(ProductCard);

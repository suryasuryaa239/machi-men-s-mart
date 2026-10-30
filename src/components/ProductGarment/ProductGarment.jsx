import React, { forwardRef, useState } from 'react';
import './ProductGarment.css';

const ProductGarment = forwardRef(function ProductGarment(
  { product, isFeatured = false, className = '', innerRef, onSelect },
  ref
) {
  // Active colorway state for this garment on the rack
  const defaultColor = product.colors && product.colors.length > 0 ? product.colors[0] : null;
  const [userSelectedColor, setUserSelectedColor] = useState(null);
  const selectedColor = userSelectedColor || defaultColor;

  const activeImage = selectedColor?.image || product.image;

  const handleClick = (e) => {
    if (onSelect) {
      e.stopPropagation();
      onSelect({
        ...product,
        selectedColor: selectedColor || (product.colors ? product.colors[0] : null),
        image: activeImage,
        backImage: selectedColor?.backImage || product.backImage || product.hoverImage,
      });
    }
  };

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
      e.preventDefault();
      e.stopPropagation();
      handleClick(e);
    }
  };

  const handleColorClick = (e, colorObj) => {
    e.stopPropagation();
    setUserSelectedColor(colorObj);
  };

  return (
    <div
      ref={ref}
      className={`product-garment-item ${product.position} ${isFeatured ? 'is-featured' : ''} ${className}`}
      data-id={product.id}
      data-position={product.position}
      data-featured={isFeatured}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Open product viewer for ${product.name} (${selectedColor?.name || 'Standard'})`}
    >
      {/* Isolated inner layer for mouse parallax without competing with scroll transforms */}
      <div ref={innerRef} className="garment-parallax-inner">
        {/* Independent pendular swing layer for natural fabric movement */}
        <div className={`garment-sway-wrap sway-${product.position}`}>
          {/* Hanging Hook Connector (Physically anchored to the rail) */}
          <div className="hanger-connector" aria-hidden="true">
            <span className="hanger-ring"></span>
            <span className="hanger-wire"></span>
            <span className="hanger-collar-bar"></span>
          </div>

          {/* Garment Image Canvas */}
          <div className="garment-visual-wrapper">
            <img
              src={activeImage}
              alt={`${product.name} - ${selectedColor?.name || product.subName}`}
              className="garment-img"
              loading={isFeatured ? 'eager' : 'lazy'}
              draggable="false"
            />

            {/* Quick Action Overlay (View style prompt + live color variant dots) */}
            <div className="garment-interactive-dock" aria-hidden="true">
              <span className="garment-hover-pill">
                <span>VIEW STYLE</span>
              </span>

              {/* Live Color Swatches on Rack */}
              {product.colors && product.colors.length > 1 && (
                <div
                  className="garment-color-pills"
                  role="radiogroup"
                  aria-label={`Available colors for ${product.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {product.colors.map((c) => {
                    const isCurrent = selectedColor?.name === c.name;
                    return (
                      <button
                        key={c.id || c.name}
                        type="button"
                        role="radio"
                        aria-checked={isCurrent}
                        className={`garment-color-dot ${isCurrent ? 'active' : ''}`}
                        style={{ backgroundColor: c.hex }}
                        onClick={(e) => handleColorClick(e, c)}
                        title={c.name}
                        aria-label={`Select ${c.name}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ambient Floor/Drop Shadow */}
            <div className="garment-ambient-shadow"></div>
          </div>

          {/* Subtle Tag Attached to Garment */}
          <div className="garment-tag-label" aria-hidden="true">
            <span className="tag-brand">MACHII</span>
            <span className="tag-name">{product.name}</span>
            <span className="tag-price">{product.price}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProductGarment;

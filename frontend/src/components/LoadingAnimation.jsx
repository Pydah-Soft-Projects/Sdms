import React from 'react';

const LoadingAnimation = ({
  width = 64,
  height = 64,
  className = '',
  message = 'Loading...',
  size = 'md', // xs, sm, md, lg, xl
  variant = 'default', // default, minimal, overlay, inline
  showMessage = true,
  centered = true
}) => {
  // Size configurations
  const sizeConfig = {
    xs: { width: 16, height: 16, textSize: 'text-xs', borderSize: 'border-2' },
    sm: { width: 24, height: 24, textSize: 'text-xs', borderSize: 'border-2' },
    md: { width: 32, height: 32, textSize: 'text-sm', borderSize: 'border-3' },
    lg: { width: 40, height: 40, textSize: 'text-sm', borderSize: 'border-3' },
    xl: { width: 48, height: 48, textSize: 'text-base', borderSize: 'border-4' }
  };

  // Variant configurations
  const variantConfig = {
    default: 'flex flex-col items-center justify-center',
    minimal: 'flex items-center gap-2',
    overlay: 'fixed inset-0 flex flex-col items-center justify-center bg-surface bg-opacity-90 z-50',
    inline: 'flex items-center gap-3'
  };

  const config = sizeConfig[size] || sizeConfig.md;
  const variantClass = variantConfig[variant] || variantConfig.default;
  const actualWidth = width || config.width;
  const actualHeight = height || config.height;

  return (
    <div className={`${centered ? variantClass : 'flex flex-col items-center justify-center'} ${className}`}>
      <div 
        style={{ width: actualWidth, height: actualHeight }}
        className="relative"
      >
        {/* Blue Spinner */}
        <div
          className={`${config.borderSize} border-[var(--primary-light)] border-t-primary rounded-full animate-spin`}
          style={{
            width: actualWidth,
            height: actualHeight,
            borderWidth: actualWidth / 8
          }}
        ></div>
      </div>
      {showMessage && message && (
        <p className={`mt-2 ${config.textSize} text-primary font-medium`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingAnimation;

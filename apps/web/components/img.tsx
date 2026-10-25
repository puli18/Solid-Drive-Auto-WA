/**
 * <Img>: plain <img> with lazy loading and a Cloudflare Images srcset (thumb/card/full variants, see
 * `imageSrcSet` in @/lib/images). `fill` stretches it over the nearest positioned parent;
 * `priority` loads it eagerly with high fetch priority (above-the-fold images).
 */
import { type CSSProperties, type ImgHTMLAttributes } from 'react';
import { imageSrcSet } from '@/lib/images';

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'> & {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  /** Accepted for compatibility (variants are pre-sized). */
  quality?: number;
};

const FILL: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

export function Img({ src, alt, fill, priority, quality: _quality, sizes, style, loading, srcSet, ...rest }: ImgProps) {
  const set = srcSet ?? imageSrcSet(src);
  return (
    <img
      src={src}
      alt={alt}
      srcSet={set}
      sizes={set ? sizes : undefined}
      loading={loading ?? (priority ? 'eager' : 'lazy')}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      style={fill ? { ...FILL, ...style } : style}
      {...rest}
    />
  );
}

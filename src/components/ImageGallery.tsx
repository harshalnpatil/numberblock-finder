import { useState, useEffect } from 'react';
import { NumberImage } from '@/lib/api/numberblocks';
import { Card } from '@/components/ui/card';
import { AlertCircle, ImageOff, Loader2, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ImageGalleryProps {
  images: NumberImage[];
}

// Cache for proxied image URLs (only used for non-cached wiki URLs)
const imageCache = new Map<string, string>();

function isCachedUrl(url: string): boolean {
  // Check if URL is from our Supabase storage (already cached)
  return url.includes('supabase.co/storage');
}

function ProxiedImage({ imageUrl, number, cached }: { imageUrl: string; number: number; cached?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      // If it's a cached URL from our storage, use it directly
      if (isCachedUrl(imageUrl)) {
        setSrc(imageUrl);
        setLoading(false);
        return;
      }

      // Check local cache
      if (imageCache.has(imageUrl)) {
        setSrc(imageCache.get(imageUrl)!);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('proxy-image', {
          body: { imageUrl },
        });

        if (cancelled) return;

        if (error || !data?.success) {
          setError(true);
          setLoading(false);
          return;
        }

        // Create data URL from base64
        const dataUrl = `data:${data.contentType};base64,${data.data}`;
        imageCache.set(imageUrl, dataUrl);
        setSrc(dataUrl);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="flex flex-col items-center gap-1 text-muted-foreground p-2">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Numberblock ${number}`}
      className="w-full h-full object-contain"
    />
  );
}

export function ImageGallery({ images }: ImageGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No images scraped yet. Click "Scrape Images" to get started!</p>
      </div>
    );
  }

  const successfulImages = images.filter(img => img.imageUrl);
  const failedImages = images.filter(img => !img.imageUrl);
  const cachedImages = images.filter(img => img.cached);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Found {successfulImages.length} of {images.length} images</span>
        <div className="flex gap-4">
          {cachedImages.length > 0 && (
            <span className="flex items-center gap-1 text-primary">
              <Database className="h-3 w-3" />
              {cachedImages.length} cached
            </span>
          )}
          {failedImages.length > 0 && (
            <span className="text-destructive">
              {failedImages.length} failed
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {images.map((img) => (
          <Card 
            key={img.number} 
            className={`overflow-hidden ${!img.imageUrl ? 'border-destructive/50' : ''} ${img.cached ? 'ring-1 ring-primary/20' : ''}`}
          >
            <div className="aspect-square relative bg-muted flex items-center justify-center">
              {img.imageUrl ? (
                <ProxiedImage imageUrl={img.imageUrl} number={img.number} cached={img.cached} />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground p-2">
                  {img.error ? (
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  ) : (
                    <ImageOff className="h-6 w-6" />
                  )}
                </div>
              )}
            </div>
            <div className="p-2 text-center">
              <span className="font-bold text-lg">{img.number}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

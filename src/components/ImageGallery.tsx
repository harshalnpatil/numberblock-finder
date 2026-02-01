import { useState, useEffect } from 'react';
import { NumberImage } from '@/lib/api/numberblocks';
import { Card } from '@/components/ui/card';
import { AlertCircle, ImageOff, Loader2, Database, Sparkles } from 'lucide-react';
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <span className="text-sm">Oops!</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Numberblock ${number}`}
      className="w-full h-full object-contain p-2"
    />
  );
}

export function ImageGallery({ images }: ImageGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔢</div>
        <p className="text-xl font-semibold text-muted-foreground">
          No pictures yet!
        </p>
        <p className="text-lg text-muted-foreground mt-2">
          Click "Find Pictures" to start! ✨
        </p>
      </div>
    );
  }

  const successfulImages = images.filter(img => img.imageUrl);
  const failedImages = images.filter(img => !img.imageUrl);
  const cachedImages = images.filter(img => img.cached);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-4 text-lg font-semibold bg-card p-4 rounded-2xl shadow-md">
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Found {successfulImages.length} of {images.length} pictures! 🎉
        </span>
        <div className="flex gap-4">
          {cachedImages.length > 0 && (
            <span className="flex items-center gap-2 text-primary bg-primary/10 px-3 py-1 rounded-full">
              <Database className="h-4 w-4" />
              {cachedImages.length} saved ⚡
            </span>
          )}
          {failedImages.length > 0 && (
            <span className="text-destructive bg-destructive/10 px-3 py-1 rounded-full">
              {failedImages.length} missing 😢
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((img) => (
          <Card 
            key={img.number} 
            className={`overflow-hidden rounded-3xl border-4 transition-all hover:scale-105 hover:shadow-xl cursor-pointer
              ${!img.imageUrl ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 hover:border-primary/50'}
              ${img.cached ? 'ring-2 ring-primary/30' : ''}
            `}
          >
            <div className="aspect-square relative bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
              {img.imageUrl ? (
                <ProxiedImage imageUrl={img.imageUrl} number={img.number} cached={img.cached} />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
                  {img.error ? (
                    <>
                      <AlertCircle className="h-10 w-10 text-destructive" />
                      <span className="text-sm">Oops!</span>
                    </>
                  ) : (
                    <>
                      <ImageOff className="h-10 w-10" />
                      <span className="text-sm">Not found</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 text-center bg-gradient-to-t from-primary/10 to-transparent">
              <span className="font-bold text-2xl text-primary">{img.number}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
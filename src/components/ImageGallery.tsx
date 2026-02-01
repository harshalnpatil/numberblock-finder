import { useState, useEffect } from 'react';
import { NumberImage, numberblocksApi } from '@/lib/api/numberblocks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ImageOff, Loader2, Database, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ImageGalleryProps {
  images: NumberImage[];
  onImageUpdate?: (number: number, imageUrl: string) => void;
}

// Cache for proxied image URLs (only used for non-cached wiki URLs)
const imageCache = new Map<string, string>();

function isCachedUrl(url: string): boolean {
  // Check if URL is from our Supabase storage (already cached)
  return url.includes('supabase.co/storage');
}

function ProxiedImage({ imageUrl, number, cached, aiGenerated }: { imageUrl: string; number: number; cached?: boolean; aiGenerated?: boolean }) {
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
    <div className="relative w-full h-full">
      <img
        src={src}
        alt={`Numberblock ${number}`}
        className="w-full h-full object-contain p-2"
      />
      {aiGenerated && (
        <div className="absolute top-1 right-1 bg-secondary/90 text-secondary-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
          <Wand2 className="h-3 w-3" />
          AI
        </div>
      )}
    </div>
  );
}

interface ImageCardProps {
  img: NumberImage;
  onGenerate?: (number: number) => void;
  isGenerating?: boolean;
}

function ImageCard({ img, onGenerate, isGenerating }: ImageCardProps) {
  return (
    <Card 
      className={`overflow-hidden rounded-3xl border-4 transition-all hover:scale-105 hover:shadow-xl
        ${!img.imageUrl ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 hover:border-primary/50'}
        ${img.cached ? 'ring-2 ring-primary/30' : ''}
        ${img.aiGenerated ? 'ring-2 ring-secondary/50' : ''}
      `}
    >
      <div className="aspect-square relative bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
        {img.imageUrl ? (
          <ProxiedImage imageUrl={img.imageUrl} number={img.number} cached={img.cached} aiGenerated={img.aiGenerated} />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
            {isGenerating ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-secondary" />
                <span className="text-sm text-center">Making with AI...</span>
              </>
            ) : img.error ? (
              <>
                <AlertCircle className="h-8 w-8 text-destructive" />
                <span className="text-sm text-center">Oops!</span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-1 text-xs rounded-full fun-button"
                  onClick={() => onGenerate?.(img.number)}
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Make with AI! ✨
                </Button>
              </>
            ) : (
              <>
                <ImageOff className="h-8 w-8" />
                <span className="text-sm text-center">Not found</span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-1 text-xs rounded-full fun-button"
                  onClick={() => onGenerate?.(img.number)}
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Make with AI! ✨
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="p-3 text-center bg-gradient-to-t from-primary/10 to-transparent">
        <span className="font-bold text-2xl text-primary">{img.number.toLocaleString()}</span>
      </div>
    </Card>
  );
}

export function ImageGallery({ images, onImageUpdate }: ImageGalleryProps) {
  const [generatingNumbers, setGeneratingNumbers] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const handleGenerate = async (number: number) => {
    setGeneratingNumbers(prev => new Set(prev).add(number));
    
    try {
      const response = await numberblocksApi.generateWithAI(number);
      
      if (response.success && response.imageUrl) {
        toast({
          title: 'Picture created! ✨',
          description: `Made a Numberblock ${number.toLocaleString()} with AI magic!`,
        });
        onImageUpdate?.(number, response.imageUrl);
      } else {
        toast({
          title: 'Oops!',
          description: response.error || 'Could not create picture',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Oops!',
        description: 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setGeneratingNumbers(prev => {
        const next = new Set(prev);
        next.delete(number);
        return next;
      });
    }
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔢</div>
        <p className="text-xl font-semibold text-muted-foreground">
          No pictures yet!
        </p>
        <p className="text-lg text-muted-foreground mt-2">
          Click "Find It!" to start! ✨
        </p>
      </div>
    );
  }

  const successfulImages = images.filter(img => img.imageUrl);
  const failedImages = images.filter(img => !img.imageUrl);
  const cachedImages = images.filter(img => img.cached);
  const aiImages = images.filter(img => img.aiGenerated);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-4 text-lg font-semibold bg-card p-4 rounded-2xl shadow-md">
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Found {successfulImages.length} of {images.length} picture{images.length !== 1 ? 's' : ''}! 🎉
        </span>
        <div className="flex flex-wrap gap-2 justify-center">
          {cachedImages.length > 0 && (
            <span className="flex items-center gap-2 text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">
              <Database className="h-4 w-4" />
              {cachedImages.length} saved ⚡
            </span>
          )}
          {aiImages.length > 0 && (
            <span className="flex items-center gap-2 text-secondary-foreground bg-secondary/20 px-3 py-1 rounded-full text-sm">
              <Wand2 className="h-4 w-4" />
              {aiImages.length} AI made ✨
            </span>
          )}
          {failedImages.length > 0 && (
            <span className="text-destructive bg-destructive/10 px-3 py-1 rounded-full text-sm">
              {failedImages.length} missing 😢
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((img) => (
          <ImageCard
            key={img.number}
            img={img}
            onGenerate={handleGenerate}
            isGenerating={generatingNumbers.has(img.number)}
          />
        ))}
      </div>
    </div>
  );
}

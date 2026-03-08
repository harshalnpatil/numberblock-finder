import { useState, useEffect } from 'react';
import { NumberImage, numberblocksApi, GenerationStrategy, ALL_STRATEGIES } from '@/lib/api/numberblocks';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Cache for proxied image URLs
const imageCache = new Map<string, string>();

function isCachedUrl(url: string): boolean {
  return url.includes('supabase.co/storage');
}

function CompareImage({ imageUrl, number }: { imageUrl: string; number: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadImage() {
      if (isCachedUrl(imageUrl)) {
        setSrc(imageUrl);
        setLoading(false);
        return;
      }
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
        if (error || !data?.success) { setError(true); setLoading(false); return; }
        const dataUrl = `data:${data.contentType};base64,${data.data}`;
        imageCache.set(imageUrl, dataUrl);
        setSrc(dataUrl);
        setLoading(false);
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    }
    loadImage();
    return () => { cancelled = true; };
  }, [imageUrl]);

  if (loading) return (
    <div className="w-full h-full flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
  if (error || !src) return (
    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
      <AlertCircle className="h-6 w-6 text-destructive" />
    </div>
  );
  return <img src={src} alt={`Numberblock ${number}`} className="w-full h-full object-contain p-2" />;
}

export interface CompareItem {
  strategy: GenerationStrategy;
  label: string;
  emoji: string;
  image: NumberImage | null;
  loading: boolean;
  error?: string;
}

interface CompareStripProps {
  number: number;
  items: CompareItem[];
}

export function CompareStrip({ number, items }: CompareStripProps) {
  return (
    <div className="space-y-4 bg-card p-4 sm:p-6 rounded-3xl shadow-lg border-4 border-secondary/20">
      <div className="text-center">
        <span className="text-2xl font-bold text-primary">Numberblock {number.toLocaleString()}</span>
        <span className="text-muted-foreground ml-2">— Strategy Comparison 🔬</span>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max px-1">
          {items.map((item) => (
            <Card
              key={item.strategy}
              className={`flex-shrink-0 w-44 overflow-hidden rounded-2xl border-2 transition-all ${
                item.image?.imageUrl
                  ? 'border-primary/20'
                  : item.loading
                    ? 'border-muted animate-pulse'
                    : 'border-destructive/20'
              }`}
            >
              <div className="aspect-square bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                {item.loading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Generating...</span>
                  </div>
                ) : item.image?.imageUrl ? (
                  <CompareImage imageUrl={item.image.imageUrl} number={number} />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground p-3">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <span className="text-xs text-center">{item.error || 'Failed'}</span>
                  </div>
                )}
              </div>
              <div className="p-2 text-center bg-gradient-to-t from-primary/5 to-transparent">
                <span className="text-lg mr-1">{item.emoji}</span>
                <span className="text-sm font-semibold">{item.label}</span>
              </div>
            </Card>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

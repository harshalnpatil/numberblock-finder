import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { numberblocksApi, NumberImage, GenerationStrategy, ALL_STRATEGIES } from '@/lib/api/numberblocks';
import { supabase } from '@/integrations/supabase/client';
import type { CompareItem } from '@/components/CompareStrip';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Helper to convert base64 to blob
function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export interface ScrapeProgress {
  current: number;
  total: number;
  phase: 'checking' | 'scraping' | 'generating' | 'comparing' | 'idle';
}

export function useNumberblocksScraper() {
  const [images, setImages] = useState<NumberImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<ScrapeProgress>({ current: 0, total: 0, phase: 'idle' });
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [compareNumber, setCompareNumber] = useState<number | null>(null);

  // Ref to track cancellation
  const cancelledRef = useRef(false);
  // Cancellation token for a running "compare all strategies" run
  const compareAbortRef = useRef<AbortController | null>(null);


  const scrapeImages = useCallback(async (startNumber: number, endNumber: number, strategy: GenerationStrategy = 'auto') => {
    setIsLoading(true);
    setImages([]);
    cancelledRef.current = false;
    
    const total = endNumber - startNumber + 1;
    const isSingleNumber = startNumber === endNumber;
    
    // Start with "checking" phase to indicate we're looking in cache first
    setProgress({ current: 0, total, phase: 'checking' });
    
    const allResults: NumberImage[] = [];
    const batchSize = 5; // Process 5 at a time for progress updates
    
    try {
      // For direct generation strategies on single numbers, just call once
      if (isSingleNumber && strategy !== 'auto' && strategy !== 'wiki-only') {
        setProgress({ current: 0, total, phase: 'generating' });
        const response = await numberblocksApi.scrapeImages(startNumber, endNumber, strategy);
        if (response.success && response.data) {
          allResults.push(...response.data);
          setImages([...allResults]);
        } else if (response.error) {
          toast.error('Error', { description: response.error });
        }
      } else {
        for (let i = startNumber; i <= endNumber; i += batchSize) {
          // Check if cancelled
          if (cancelledRef.current) {
            toast('Scraping stopped', {
              description: `Stopped at ${allResults.length} images`,
            });
            break;
          }
          
          const batchEnd = Math.min(i + batchSize - 1, endNumber);
          
          // For single numbers, show generating phase since backend may auto-generate
          if (isSingleNumber && i === startNumber) {
            setProgress({ current: 0, total, phase: 'generating' });
          }
          
          const response = await numberblocksApi.scrapeImages(i, batchEnd, strategy);
          
          // After first batch for range mode, switch to 'scraping' phase
          if (!isSingleNumber) {
            setProgress(prev => prev.phase === 'checking' ? { ...prev, phase: 'scraping' } : prev);
          }
          
          // Check again after async call
          if (cancelledRef.current) {
            if (response.success && response.data) {
              allResults.push(...response.data);
              setImages([...allResults]);
            }
            toast('Scraping stopped', {
              description: `Stopped at ${allResults.length} images`,
            });
            break;
          }
          
          if (response.success && response.data) {
            allResults.push(...response.data);
            setImages([...allResults]);
          }
          
          // Update progress
          const completed = Math.min(batchEnd - startNumber + 1, total);
          setProgress({ current: completed, total, phase: 'scraping' });
        }
      }
      
      if (!cancelledRef.current) {
        const successCount = allResults.filter(img => img.imageUrl).length;
        toast.success('Search complete!', {
          description:
            successCount > 0
              ? `Found ${successCount} picture${successCount > 1 ? 's' : ''}!`
              : 'No pictures found',
        });
      }
    } catch (error) {
      console.error('Scrape error:', error);
      toast.error('Error', {
        description: 'Failed to find pictures. Please try again.',
      });
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0, phase: 'idle' });
    }
  }, []);

  const stopScraping = useCallback(() => {
    cancelledRef.current = true;
    // Compare mode fires all strategies in parallel; abort the in-flight
    // requests and release the UI immediately instead of waiting for them.
    if (compareAbortRef.current) {
      compareAbortRef.current.abort();
      compareAbortRef.current = null;
      setCompareItems(prev =>
        prev.map(item => (item.loading ? { ...item, loading: false, error: 'Stopped' } : item))
      );
      setIsLoading(false);
      setProgress({ current: 0, total: 0, phase: 'idle' });
      toast('Comparison stopped');
    }
  }, []);


  const downloadImages = useCallback(async () => {
    const validImages = images.filter(img => img.imageUrl);
    
    if (validImages.length === 0) {
      toast.error('No images to download', { description: 'Find some pictures first!' });
      return;
    }

    setIsDownloading(true);

    try {
      // If only one image, download directly instead of as ZIP
      if (validImages.length === 1) {
        const img = validImages[0];
        
        // Use edge function to proxy the image
        const { data, error } = await supabase.functions.invoke('proxy-image', {
          body: { imageUrl: img.imageUrl },
        });
        
        if (error || !data?.success) {
          throw new Error(error?.message || data?.error || 'Failed to fetch image');
        }
        
        const blob = base64ToBlob(data.data, data.contentType);
        
        // Determine file extension from content type
        let extension = 'png';
        if (data.contentType?.includes('jpeg') || data.contentType?.includes('jpg')) {
          extension = 'jpg';
        } else if (data.contentType?.includes('gif')) {
          extension = 'gif';
        } else if (data.contentType?.includes('webp')) {
          extension = 'webp';
        } else if (data.contentType?.includes('svg')) {
          extension = 'svg';
        }
        
        // Save directly as image file
        saveAs(blob, `numberblock-${img.number}.${extension}`);
        
        toast.success('Download complete!', {
          description: `Saved Numberblock ${img.number}!`,
        });
      } else {
        // Multiple images: create ZIP
        const zip = new JSZip();
        
        // Fetch all images through proxy and add to ZIP
        const fetchPromises = validImages.map(async (img) => {
          try {
            // Pad number for proper sorting (001, 010, 100)
            const paddedNumber = img.number.toString().padStart(3, '0');
            
            // Use edge function to proxy the image
            const { data, error } = await supabase.functions.invoke('proxy-image', {
              body: { imageUrl: img.imageUrl },
            });
            
            if (error || !data?.success) {
              throw new Error(error?.message || data?.error || `Failed to fetch image ${img.number}`);
            }
            
            const blob = base64ToBlob(data.data, data.contentType);
            
            // Determine file extension from content type
            let extension = 'png';
            if (data.contentType?.includes('jpeg') || data.contentType?.includes('jpg')) {
              extension = 'jpg';
            } else if (data.contentType?.includes('gif')) {
              extension = 'gif';
            } else if (data.contentType?.includes('webp')) {
              extension = 'webp';
            } else if (data.contentType?.includes('svg')) {
              extension = 'svg';
            }
            
            zip.file(`${paddedNumber}.${extension}`, blob);
            return true;
          } catch (error) {
            console.error(`Failed to fetch image ${img.number}:`, error);
            return false;
          }
        });

        const results = await Promise.all(fetchPromises);
        const successCount = results.filter(Boolean).length;

        if (successCount === 0) {
          throw new Error('Failed to download any images');
        }

        // Generate and download ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'numberblocks-images.zip');

        toast.success('Download complete!', {
          description: `ZIP created with ${successCount} pictures!`,
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed', {
        description: error instanceof Error ? error.message : 'Failed to download',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [images]);

  const updateImage = useCallback((number: number, imageUrl: string) => {
    setImages(prev => prev.map(img => 
      img.number === number 
        ? { ...img, imageUrl, aiGenerated: true, error: undefined } 
        : img
    ));
  }, []);

  const compareStrategies = useCallback(async (number: number) => {
    setIsLoading(true);
    setImages([]);
    setCompareNumber(number);
    cancelledRef.current = false;
    
    const strategies = ALL_STRATEGIES;
    const total = strategies.length;
    setProgress({ current: 0, total, phase: 'comparing' });
    
    // Initialize all items as loading
    const initialItems: CompareItem[] = strategies.map(s => ({
      strategy: s.value,
      label: s.label,
      emoji: s.emoji,
      image: null,
      loading: true,
    }));
    setCompareItems([...initialItems]);
    
    // Fire all strategies in parallel, update as each resolves
    const promises = strategies.map(async (s, idx) => {
      try {
        const result = await numberblocksApi.scrapeImages(number, number, s.value);
        const image = result.success && result.data?.[0] ? result.data[0] : null;
        setCompareItems(prev => prev.map((item, i) =>
          i === idx ? { ...item, image, loading: false, error: !image ? (result.error || 'No result') : undefined } : item
        ));
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      } catch (err) {
        setCompareItems(prev => prev.map((item, i) =>
          i === idx ? { ...item, loading: false, error: 'Failed' } : item
        ));
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
    });
    
    await Promise.all(promises);
    
    toast.success('Comparison complete! 🔬', {
      description: `Generated Numberblock ${number.toLocaleString()} with ${total} strategies`,
    });

    setIsLoading(false);
    setProgress({ current: 0, total: 0, phase: 'idle' });
  }, []);

  const successfulImageCount = images.filter(img => img.imageUrl).length;

  return {
    images,
    isLoading,
    isDownloading,
    progress,
    scrapeImages,
    stopScraping,
    downloadAsZip: downloadImages,
    updateImage,
    compareStrategies,
    compareItems,
    compareNumber,
    hasImages: images.length > 0 || compareItems.length > 0,
    successfulImageCount,
  };
}

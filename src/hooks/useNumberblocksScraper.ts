import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { numberblocksApi, NumberImage } from '@/lib/api/numberblocks';
import { supabase } from '@/integrations/supabase/client';
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
  phase: 'scraping' | 'idle';
}

export function useNumberblocksScraper() {
  const [images, setImages] = useState<NumberImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<ScrapeProgress>({ current: 0, total: 0, phase: 'idle' });
  const { toast } = useToast();
  
  // Ref to track cancellation
  const cancelledRef = useRef(false);

  const scrapeImages = useCallback(async (startNumber: number, endNumber: number) => {
    setIsLoading(true);
    setImages([]);
    cancelledRef.current = false;
    
    const total = endNumber - startNumber + 1;
    setProgress({ current: 0, total, phase: 'scraping' });
    
    const allResults: NumberImage[] = [];
    const batchSize = 5; // Process 5 at a time for progress updates
    
    try {
      for (let i = startNumber; i <= endNumber; i += batchSize) {
        // Check if cancelled
        if (cancelledRef.current) {
          toast({
            title: 'Scraping stopped',
            description: `Stopped at ${allResults.length} images`,
          });
          break;
        }
        
        const batchEnd = Math.min(i + batchSize - 1, endNumber);
        
        const response = await numberblocksApi.scrapeImages(i, batchEnd);
        
        // Check again after async call
        if (cancelledRef.current) {
          if (response.success && response.data) {
            allResults.push(...response.data);
            setImages([...allResults]);
          }
          toast({
            title: 'Scraping stopped',
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
      
      if (!cancelledRef.current) {
        const successCount = allResults.filter(img => img.imageUrl).length;
        toast({
          title: 'Scraping complete!',
          description: `Found ${successCount} of ${allResults.length} images`,
        });
      }
    } catch (error) {
      console.error('Scrape error:', error);
      toast({
        title: 'Error',
        description: 'Failed to scrape images. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0, phase: 'idle' });
    }
  }, [toast]);

  const stopScraping = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const downloadAsZip = useCallback(async () => {
    const validImages = images.filter(img => img.imageUrl);
    
    if (validImages.length === 0) {
      toast({
        title: 'No images to download',
        description: 'Scrape some images first!',
        variant: 'destructive',
      });
      return;
    }

    setIsDownloading(true);

    try {
      const zip = new JSZip();
      
      // Fetch all images through proxy and add to ZIP
      const fetchPromises = validImages.map(async (img) => {
        try {
          // Pad number for proper sorting (001, 010, 100)
          const paddedNumber = img.number.toString().padStart(3, '0');
          
          // Use edge function to proxy the image (bypasses CORS/hotlink protection)
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

      toast({
        title: 'Download complete!',
        description: `ZIP created with ${successCount} images`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to create ZIP',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [images, toast]);

  const successfulImageCount = images.filter(img => img.imageUrl).length;

  return {
    images,
    isLoading,
    isDownloading,
    progress,
    scrapeImages,
    stopScraping,
    downloadAsZip,
    hasImages: images.length > 0,
    successfulImageCount,
  };
}

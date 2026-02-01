import { useState, useCallback } from 'react';
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

export function useNumberblocksScraper() {
  const [images, setImages] = useState<NumberImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const scrapeImages = useCallback(async (startNumber: number, endNumber: number) => {
    setIsLoading(true);
    
    try {
      const response = await numberblocksApi.scrapeImages(startNumber, endNumber);
      
      if (response.success && response.data) {
        setImages(response.data);
        const successCount = response.data.filter(img => img.imageUrl).length;
        
        toast({
          title: 'Scraping complete!',
          description: `Found ${successCount} of ${response.data.length} images`,
        });
      } else {
        toast({
          title: 'Scraping failed',
          description: response.error || 'Unknown error occurred',
          variant: 'destructive',
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
    }
  }, [toast]);

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
    scrapeImages,
    downloadAsZip,
    hasImages: images.length > 0,
    successfulImageCount,
  };
}

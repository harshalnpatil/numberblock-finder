import { supabase } from '@/integrations/supabase/client';

export interface NumberImage {
  number: number;
  imageUrl: string | null;
  pageUrl: string;
  cached?: boolean;
  error?: string;
}

export interface ScrapeResponse {
  success: boolean;
  error?: string;
  data?: NumberImage[];
}

export const numberblocksApi = {
  async scrapeImages(startNumber: number = 1, endNumber: number = 20): Promise<ScrapeResponse> {
    const { data, error } = await supabase.functions.invoke('scrape-numberblocks', {
      body: { startNumber, endNumber },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    
    return data;
  },
};

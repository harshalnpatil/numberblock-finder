import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Download } from 'lucide-react';

interface ScrapeControlsProps {
  onScrape: (start: number, end: number) => Promise<void>;
  onDownload: () => Promise<void>;
  isLoading: boolean;
  isDownloading: boolean;
  hasImages: boolean;
  imageCount: number;
}

export function ScrapeControls({
  onScrape,
  onDownload,
  isLoading,
  isDownloading,
  hasImages,
  imageCount,
}: ScrapeControlsProps) {
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(20);

  const handleScrape = () => {
    onScrape(startNumber, endNumber);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="start">Start Number</Label>
          <Input
            id="start"
            type="number"
            min={1}
            max={1000}
            value={startNumber}
            onChange={(e) => setStartNumber(Number(e.target.value))}
            className="w-24"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">End Number</Label>
          <Input
            id="end"
            type="number"
            min={1}
            max={1000}
            value={endNumber}
            onChange={(e) => setEndNumber(Number(e.target.value))}
            className="w-24"
            disabled={isLoading}
          />
        </div>
        <Button
          onClick={handleScrape}
          disabled={isLoading || startNumber > endNumber}
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Scrape Images
            </>
          )}
        </Button>
      </div>

      {hasImages && (
        <Button
          onClick={onDownload}
          disabled={isDownloading || imageCount === 0}
          variant="secondary"
          size="lg"
          className="w-full sm:w-auto"
        >
          {isDownloading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating ZIP...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download All as ZIP ({imageCount} images)
            </>
          )}
        </Button>
      )}
    </div>
  );
}

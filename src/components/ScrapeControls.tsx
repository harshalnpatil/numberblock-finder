import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Search, Download, Square, Sparkles } from 'lucide-react';
import { ScrapeProgress } from '@/hooks/useNumberblocksScraper';

interface ScrapeControlsProps {
  onScrape: (start: number, end: number) => Promise<void>;
  onStop: () => void;
  onDownload: () => Promise<void>;
  isLoading: boolean;
  isDownloading: boolean;
  hasImages: boolean;
  imageCount: number;
  progress: ScrapeProgress;
}

// Format number with commas (e.g., 1234567 -> 1,234,567)
const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// Parse formatted string back to number
const parseFormattedNumber = (str: string): number => {
  const cleaned = str.replace(/,/g, '').replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
};

export function ScrapeControls({
  onScrape,
  onStop,
  onDownload,
  isLoading,
  isDownloading,
  hasImages,
  imageCount,
  progress,
}: ScrapeControlsProps) {
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(20);

  const handleScrape = () => {
    onScrape(startNumber, endNumber);
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFormattedNumber(e.target.value);
    if (value >= 0 && value <= 9999999) {
      setStartNumber(value);
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFormattedNumber(e.target.value);
    if (value >= 0 && value <= 9999999) {
      setEndNumber(value);
    }
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-6 bg-card p-6 sm:p-8 rounded-3xl shadow-lg border-4 border-primary/20">
      <div className="flex flex-wrap gap-6 items-end justify-center">
        <div className="space-y-3">
          <Label htmlFor="start" className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">1️⃣</span> From Number
          </Label>
          <Input
            id="start"
            type="text"
            inputMode="numeric"
            value={formatNumber(startNumber)}
            onChange={handleStartChange}
            className="w-full min-w-[5rem] max-w-[10rem] h-14 text-xl sm:text-2xl font-bold text-center rounded-2xl border-3 border-primary/30 focus:border-primary"
            disabled={isLoading}
          />
        </div>
        
        <div className="text-4xl font-bold text-primary hidden sm:block">➡️</div>
        
        <div className="space-y-3">
          <Label htmlFor="end" className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">🔢</span> To Number
          </Label>
          <Input
            id="end"
            type="text"
            inputMode="numeric"
            value={formatNumber(endNumber)}
            onChange={handleEndChange}
            className="w-full min-w-[5rem] max-w-[10rem] h-14 text-xl sm:text-2xl font-bold text-center rounded-2xl border-3 border-primary/30 focus:border-primary"
            disabled={isLoading}
          />
        </div>
        
        {isLoading ? (
          <Button
            onClick={onStop}
            variant="destructive"
            className="h-14 px-8 text-xl font-bold rounded-2xl fun-button shadow-lg"
          >
            <Square className="mr-2 h-6 w-6" />
            Stop! 🛑
          </Button>
        ) : (
          <Button
            onClick={handleScrape}
            disabled={startNumber > endNumber}
            className="h-14 px-8 text-xl font-bold rounded-2xl fun-button shadow-lg bg-primary hover:bg-primary/90"
          >
            <Sparkles className="mr-2 h-6 w-6" />
            Find Pictures! ✨
          </Button>
        )}
      </div>

      {isLoading && progress.total > 0 && (
        <div className="space-y-3 bg-muted/50 p-4 rounded-2xl">
          <div className="flex justify-between text-lg font-semibold">
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Looking for Numberblocks... 🔍
            </span>
            <span className="text-primary text-xl font-bold">
              {progress.current} / {progress.total}
            </span>
          </div>
          <Progress value={progressPercent} className="h-4 rounded-full" />
        </div>
      )}

      {hasImages && !isLoading && (
        <Button
          onClick={onDownload}
          disabled={isDownloading || imageCount === 0}
          className="w-full h-16 text-xl font-bold rounded-2xl fun-button shadow-lg bg-secondary hover:bg-secondary/90"
        >
          {isDownloading ? (
            <>
              <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              Making your ZIP file... 📦
            </>
          ) : (
            <>
              <Download className="mr-3 h-6 w-6" />
              Download All Pictures! 🎉 ({imageCount} pics)
            </>
          )}
        </Button>
      )}
    </div>
  );
}
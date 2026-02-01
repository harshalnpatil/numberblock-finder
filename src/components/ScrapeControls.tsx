import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Download, Square, Sparkles, ChevronDown } from 'lucide-react';
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
  const [singleNumber, setSingleNumber] = useState(1);
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(20);
  const [isRangeMode, setIsRangeMode] = useState(false);

  const handleSingleScrape = () => {
    onScrape(singleNumber, singleNumber);
  };

  const handleRangeScrape = () => {
    onScrape(startNumber, endNumber);
  };

  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFormattedNumber(e.target.value);
    if (value >= 0 && value <= 9999999) {
      setSingleNumber(value);
    }
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
      {/* Single Number Mode (Default) */}
      <div className="flex flex-wrap gap-4 items-end justify-center">
        <div className="space-y-3">
          <Label htmlFor="single" className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">🔢</span> Which Numberblock?
          </Label>
          <Input
            id="single"
            type="text"
            inputMode="numeric"
            value={formatNumber(singleNumber)}
            onChange={handleSingleChange}
            className="w-full min-w-[5rem] max-w-[10rem] h-14 text-xl sm:text-2xl font-bold text-center rounded-2xl border-3 border-primary/30 focus:border-primary"
            disabled={isLoading}
            placeholder="1"
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
            onClick={handleSingleScrape}
            disabled={singleNumber < 1}
            className="h-14 px-8 text-xl font-bold rounded-2xl fun-button shadow-lg bg-primary hover:bg-primary/90"
          >
            <Sparkles className="mr-2 h-6 w-6" />
            Find It! ✨
          </Button>
        )}
      </div>

      {/* Range Mode (Hidden by default) */}
      <Collapsible open={isRangeMode} onOpenChange={setIsRangeMode}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-primary text-lg py-3 rounded-2xl"
            disabled={isLoading}
          >
            <span>🌈 Find Many Numberblocks</span>
            <ChevronDown className={`h-5 w-5 transition-transform ${isRangeMode ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="pt-4">
          <div className="bg-muted/30 p-4 sm:p-6 rounded-2xl space-y-4">
            <div className="flex flex-wrap gap-4 items-end justify-center">
              <div className="space-y-3">
                <Label htmlFor="start" className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-2xl">1️⃣</span> From
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
                  <span className="text-2xl">🔟</span> To
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
              
              {!isLoading && (
                <Button
                  onClick={handleRangeScrape}
                  disabled={startNumber > endNumber}
                  className="h-14 px-8 text-xl font-bold rounded-2xl fun-button shadow-lg bg-secondary hover:bg-secondary/90"
                >
                  <Sparkles className="mr-2 h-6 w-6" />
                  Find All! 🌈
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

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
              Getting your picture... 📦
            </>
          ) : (
            <>
              <Download className="mr-3 h-6 w-6" />
              {imageCount === 1 ? 'Download Picture! 🎉' : `Download All Pictures! 🎉 (${imageCount} pics)`}
            </>
          )}
        </Button>
      )}
    </div>
  );
}

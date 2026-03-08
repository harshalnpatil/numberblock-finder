import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Download, Square, Sparkles, GitCompareArrows } from 'lucide-react';
import { ScrapeProgress } from '@/hooks/useNumberblocksScraper';
import { AdvancedModePanel } from '@/components/AdvancedModePanel';
import type { GenerationStrategy } from '@/lib/api/numberblocks';

interface ScrapeControlsProps {
  onScrape: (start: number, end: number, strategy: GenerationStrategy) => Promise<void>;
  onStop: () => void;
  onDownload: () => Promise<void>;
  onCompare: (number: number) => Promise<void>;
  isLoading: boolean;
  isDownloading: boolean;
  hasImages: boolean;
  imageCount: number;
  progress: ScrapeProgress;
  strategy: GenerationStrategy;
  onStrategyChange: (strategy: GenerationStrategy) => void;
}

const formatNumber = (num: number): string => num.toLocaleString();

const parseFormattedNumber = (str: string): number => {
  const cleaned = str.replace(/,/g, '').replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
};

export function ScrapeControls({
  onScrape,
  onStop,
  onDownload,
  onCompare,
  isLoading,
  isDownloading,
  hasImages,
  imageCount,
  progress,
  strategy,
  onStrategyChange,
}: ScrapeControlsProps) {
  const [singleNumber, setSingleNumber] = useState(1);
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(20);
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const handleScrape = () => {
    if (compareMode) {
      onCompare(singleNumber);
    } else if (isRangeMode) {
      onScrape(startNumber, endNumber, strategy);
    } else {
      onScrape(singleNumber, singleNumber, strategy);
    }
  };

  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFormattedNumber(e.target.value);
    if (value >= 0 && value <= 9999999) setSingleNumber(value);
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-6 bg-card p-6 sm:p-8 rounded-3xl shadow-lg border-4 border-primary/20">
      <Tabs defaultValue="simple" className="w-full">
        {/* Subtle mode toggle — tucked in the corner */}
        <div className="flex justify-end mb-4">
          <TabsList className="h-8 bg-muted/50 p-0.5 rounded-full">
            <TabsTrigger
              value="simple"
              className="text-xs px-3 h-7 rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Simple
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="text-xs px-3 h-7 rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              Advanced
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── Simple Mode ─── */}
        <TabsContent value="simple" className="mt-0 space-y-4">
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
                onClick={() => onScrape(singleNumber, singleNumber, strategy)}
                disabled={singleNumber < 1}
                className="h-14 px-8 text-xl font-bold rounded-2xl fun-button shadow-lg bg-primary hover:bg-primary/90"
              >
                <Sparkles className="mr-2 h-6 w-6" />
                Find It! ✨
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ─── Advanced Mode ─── */}
        <TabsContent value="advanced" className="mt-0 space-y-5">
          <div className="flex flex-wrap gap-4 items-end justify-center">
            <div className="space-y-3">
              <Label htmlFor="single-adv" className="text-lg font-semibold flex items-center gap-2">
                <span className="text-2xl">🔢</span> Which Numberblock?
              </Label>
              <Input
                id="single-adv"
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
                onClick={handleScrape}
                disabled={isRangeMode && !compareMode ? startNumber > endNumber : singleNumber < 1}
                className={`h-14 px-8 text-xl font-bold rounded-2xl fun-button shadow-lg ${
                  compareMode 
                    ? 'bg-secondary hover:bg-secondary/90' 
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {compareMode ? (
                  <>
                    <GitCompareArrows className="mr-2 h-6 w-6" />
                    Compare All! 🔬
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-6 w-6" />
                    {isRangeMode ? 'Find All! 🌈' : 'Find It! ✨'}
                  </>
                )}
              </Button>
            )}
          </div>

          <AdvancedModePanel
            strategy={strategy}
            onStrategyChange={onStrategyChange}
            disabled={isLoading}
            isRangeMode={isRangeMode}
            onRangeModeChange={setIsRangeMode}
            startNumber={startNumber}
            endNumber={endNumber}
            onStartChange={setStartNumber}
            onEndChange={setEndNumber}
            compareMode={compareMode}
            onCompareModeChange={setCompareMode}
          />
        </TabsContent>
      </Tabs>

      {/* Progress */}
      {isLoading && progress.total > 0 && (
        <div className="space-y-3 bg-muted/50 p-4 rounded-2xl">
          <div className="flex justify-between text-lg font-semibold">
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              {progress.phase === 'checking'
                ? 'Checking for saved pictures... 📂'
                : progress.phase === 'generating'
                  ? 'Creating your Numberblock... ✨🎨'
                  : progress.phase === 'comparing'
                    ? 'Comparing all strategies... 🔬'
                    : 'Looking for Numberblocks... 🔍'}
            </span>
            {progress.total > 1 && (
              <span className="text-primary text-xl font-bold">
                {progress.current} / {progress.total}
              </span>
            )}
          </div>
          <Progress value={progressPercent} className="h-4 rounded-full" />
        </div>
      )}

      {/* Download */}
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

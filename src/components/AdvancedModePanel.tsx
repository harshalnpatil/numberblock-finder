import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GitCompareArrows } from 'lucide-react';
import type { GenerationStrategy } from '@/lib/api/numberblocks';

interface AdvancedModePanelProps {
  strategy: GenerationStrategy;
  onStrategyChange: (strategy: GenerationStrategy) => void;
  disabled?: boolean;
  isRangeMode: boolean;
  onRangeModeChange: (val: boolean) => void;
  startNumber: number;
  endNumber: number;
  onStartChange: (val: number) => void;
  onEndChange: (val: number) => void;
  compareMode: boolean;
  onCompareModeChange: (val: boolean) => void;
}

const STRATEGIES: { value: GenerationStrategy; label: string; description: string; emoji: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Wiki → Compose → DALL-E fallback', emoji: '🔄' },
  { value: 'svg', label: 'SVG', description: 'Deterministic math blocks', emoji: '📐' },
  { value: 'compose', label: 'Compose', description: 'Number overlay, no AI', emoji: '🧩' },
  { value: 'ai-openai', label: 'OpenAI', description: 'DALL-E 3 generation', emoji: '🎨' },
  { value: 'ai-gemini', label: 'Gemini', description: 'Google Gemini generation', emoji: '✨' },
  { value: 'wiki-only', label: 'Wiki Only', description: 'Scrape only, no fallback', emoji: '📚' },
];

export function AdvancedModePanel({
  strategy,
  onStrategyChange,
  disabled,
  isRangeMode,
  onRangeModeChange,
  startNumber,
  endNumber,
  onStartChange,
  onEndChange,
  compareMode,
  onCompareModeChange,
}: AdvancedModePanelProps) {
  return (
    <div className="space-y-5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
      {/* Compare Mode Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/10 border-2 border-secondary/20">
        <Label className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
          <GitCompareArrows className="h-4 w-4 text-secondary" />
          <span>Compare All Strategies</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">NEW</Badge>
        </Label>
        <Switch
          checked={compareMode}
          onCheckedChange={onCompareModeChange}
          disabled={disabled}
        />
      </div>

      {/* Strategy Selection - disabled when compare mode is on */}
      <div className={`space-y-3 transition-opacity ${compareMode ? 'opacity-40 pointer-events-none' : ''}`}>
        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          🔧 Generation Strategy
        </Label>
        <RadioGroup
          value={strategy}
          onValueChange={(val) => onStrategyChange(val as GenerationStrategy)}
          className="grid grid-cols-2 sm:grid-cols-3 gap-2"
          disabled={disabled || compareMode}
        >
          {STRATEGIES.map((s) => (
            <Label
              key={s.value}
              htmlFor={`strat-${s.value}`}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${strategy === s.value
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40'
                }
                ${disabled ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              <RadioGroupItem value={s.value} id={`strat-${s.value}`} className="sr-only" />
              <span className="text-lg">{s.emoji}</span>
              <div className="min-w-0">
                <span className="text-sm font-medium block">{s.label}</span>
                <span className="text-[10px] text-muted-foreground block leading-tight truncate">
                  {s.description}
                </span>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      {/* Range Mode Toggle - disabled when compare mode is on */}
      <div className={`space-y-4 transition-opacity ${compareMode ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            🌈 Batch Range
          </Label>
          <Switch
            checked={isRangeMode}
            onCheckedChange={onRangeModeChange}
            disabled={disabled || compareMode}
          />
        </div>

        {isRangeMode && !compareMode && (
          <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between text-sm">
              <Badge variant="secondary" className="font-mono text-base px-3 py-1">
                {startNumber}
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary" className="font-mono text-base px-3 py-1">
                {endNumber}
              </Badge>
            </div>
            <div className="px-1">
              <Slider
                min={1}
                max={100}
                step={1}
                value={[startNumber, endNumber]}
                onValueChange={([s, e]) => {
                  onStartChange(s);
                  onEndChange(e);
                }}
                disabled={disabled}
                className="py-2"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Will generate <span className="font-semibold text-foreground">{endNumber - startNumber + 1}</span> images
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

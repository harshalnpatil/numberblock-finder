import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
}: AdvancedModePanelProps) {
  return (
    <div className="space-y-5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
      {/* Strategy Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          🔧 Generation Strategy
        </Label>
        <RadioGroup
          value={strategy}
          onValueChange={(val) => onStrategyChange(val as GenerationStrategy)}
          className="grid grid-cols-2 sm:grid-cols-3 gap-2"
          disabled={disabled}
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

      {/* Range Mode Toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            🌈 Batch Range
          </Label>
          <Switch
            checked={isRangeMode}
            onCheckedChange={onRangeModeChange}
            disabled={disabled}
          />
        </div>

        {isRangeMode && (
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

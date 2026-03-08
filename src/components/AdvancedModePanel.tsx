import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { GenerationStrategy } from '@/lib/api/numberblocks';

interface AdvancedModePanelProps {
  strategy: GenerationStrategy;
  onStrategyChange: (strategy: GenerationStrategy) => void;
  disabled?: boolean;
}

const STRATEGIES: { value: GenerationStrategy; label: string; description: string; emoji: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Wiki → Compose → DALL-E (default)', emoji: '🔄' },
  { value: 'svg', label: 'Programmatic SVG', description: 'Deterministic, mathematically correct blocks', emoji: '📐' },
  { value: 'ai-openai', label: 'AI – OpenAI', description: 'DALL-E 3 image generation', emoji: '🎨' },
  { value: 'ai-gemini', label: 'AI – Gemini', description: 'Google Gemini image generation', emoji: '✨' },
  { value: 'wiki-only', label: 'Wiki Only', description: 'Scrape only, no AI fallback', emoji: '📚' },
];

export function AdvancedModePanel({ strategy, onStrategyChange, disabled }: AdvancedModePanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 justify-center">
        <Label htmlFor="advanced-mode" className="text-sm text-muted-foreground flex items-center gap-1.5 cursor-pointer">
          <Settings2 className="h-4 w-4" />
          Advanced Mode
        </Label>
        <Switch
          id="advanced-mode"
          checked={isOpen}
          onCheckedChange={setIsOpen}
          disabled={disabled}
          className="scale-90"
        />
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent className="pt-4">
          <div className="bg-muted/40 p-4 sm:p-5 rounded-2xl border border-border/50">
            <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              🔧 Generation Strategy
            </p>
            <RadioGroup
              value={strategy}
              onValueChange={(val) => onStrategyChange(val as GenerationStrategy)}
              className="space-y-2"
              disabled={disabled}
            >
              {STRATEGIES.map((s) => (
                <div key={s.value} className="flex items-start gap-3 p-2 rounded-xl hover:bg-muted/60 transition-colors">
                  <RadioGroupItem value={s.value} id={`strategy-${s.value}`} className="mt-0.5" />
                  <Label htmlFor={`strategy-${s.value}`} className="cursor-pointer flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span>{s.emoji}</span>
                      {s.label}
                    </span>
                    <span className="text-xs text-muted-foreground block mt-0.5">{s.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

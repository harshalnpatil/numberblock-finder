import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Settings2 } from 'lucide-react';
import type { GenerationStrategy } from '@/lib/api/numberblocks';

interface AdvancedModePanelProps {
  strategy: GenerationStrategy;
  onStrategyChange: (strategy: GenerationStrategy) => void;
  disabled?: boolean;
}

const STRATEGIES: { value: GenerationStrategy; label: string; description: string; emoji: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Wiki scrape → Compose → DALL-E fallback', emoji: '🔄' },
  { value: 'svg', label: 'Programmatic SVG', description: 'Deterministic, mathematically correct blocks', emoji: '📐' },
  { value: 'compose', label: 'Compose Only', description: 'Number overlay on template, no AI', emoji: '🧩' },
  { value: 'ai-openai', label: 'AI – OpenAI', description: 'DALL-E 3 image generation', emoji: '🎨' },
  { value: 'ai-gemini', label: 'AI – Gemini', description: 'Google Gemini image generation', emoji: '✨' },
  { value: 'wiki-only', label: 'Wiki Only', description: 'Scrape only, no AI fallback', emoji: '📚' },
];

export function AdvancedModePanel({ strategy, onStrategyChange, disabled }: AdvancedModePanelProps) {
  const currentStrategy = STRATEGIES.find((s) => s.value === strategy);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="text-muted-foreground hover:text-primary gap-2"
        >
          <Settings2 className="h-4 w-4" />
          <span className="text-sm">
            {strategy === 'auto' ? 'Advanced' : `⚙️ ${currentStrategy?.label}`}
          </span>
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-lg">
              🔧 Generation Strategy
            </DrawerTitle>
            <DrawerDescription>
              Choose how Numberblock images are created
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-2">
            <RadioGroup
              value={strategy}
              onValueChange={(val) => onStrategyChange(val as GenerationStrategy)}
              className="space-y-1"
            >
              {STRATEGIES.map((s) => (
                <div
                  key={s.value}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors"
                >
                  <RadioGroupItem value={s.value} id={`strategy-${s.value}`} className="mt-0.5" />
                  <Label htmlFor={`strategy-${s.value}`} className="cursor-pointer flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span>{s.emoji}</span>
                      {s.label}
                    </span>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {s.description}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="rounded-2xl">
                Done
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

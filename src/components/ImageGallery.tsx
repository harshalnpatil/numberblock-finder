import { NumberImage } from '@/lib/api/numberblocks';
import { Card } from '@/components/ui/card';
import { AlertCircle, ImageOff } from 'lucide-react';

interface ImageGalleryProps {
  images: NumberImage[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No images scraped yet. Click "Scrape Images" to get started!</p>
      </div>
    );
  }

  const successfulImages = images.filter(img => img.imageUrl);
  const failedImages = images.filter(img => !img.imageUrl);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Found {successfulImages.length} of {images.length} images</span>
        {failedImages.length > 0 && (
          <span className="text-destructive">
            {failedImages.length} failed
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {images.map((img) => (
          <Card 
            key={img.number} 
            className={`overflow-hidden ${!img.imageUrl ? 'border-destructive/50' : ''}`}
          >
            <div className="aspect-square relative bg-muted flex items-center justify-center">
              {img.imageUrl ? (
                <img
                  src={img.imageUrl}
                  alt={`Numberblock ${img.number}`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground p-2">
                  {img.error ? (
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  ) : (
                    <ImageOff className="h-6 w-6" />
                  )}
                </div>
              )}
            </div>
            <div className="p-2 text-center">
              <span className="font-bold text-lg">{img.number}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

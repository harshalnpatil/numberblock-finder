import { ScrapeControls } from '@/components/ScrapeControls';
import { ImageGallery } from '@/components/ImageGallery';
import { useNumberblocksScraper } from '@/hooks/useNumberblocksScraper';

const Index = () => {
  const {
    images,
    isLoading,
    isDownloading,
    scrapeImages,
    downloadAsZip,
    hasImages,
    successfulImageCount,
  } = useNumberblocksScraper();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Numberblocks Image Scraper
          </h1>
          <p className="text-muted-foreground">
            Scrape character images from the Numberblocks wiki and download as a ZIP
          </p>
        </header>

        <div className="space-y-8">
          <ScrapeControls
            onScrape={scrapeImages}
            onDownload={downloadAsZip}
            isLoading={isLoading}
            isDownloading={isDownloading}
            hasImages={hasImages}
            imageCount={successfulImageCount}
          />

          <ImageGallery images={images} />
        </div>
      </div>
    </div>
  );
};

export default Index;

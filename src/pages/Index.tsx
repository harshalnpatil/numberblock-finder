import { ScrapeControls } from '@/components/ScrapeControls';
import { ImageGallery } from '@/components/ImageGallery';
import { useNumberblocksScraper } from '@/hooks/useNumberblocksScraper';

const Index = () => {
  const {
    images,
    isLoading,
    isDownloading,
    progress,
    scrapeImages,
    stopScraping,
    downloadAsZip,
    updateImage,
    hasImages,
    successfulImageCount,
  } = useNumberblocksScraper();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="text-center mb-10">
          <div className="text-6xl mb-4 animate-bounce-gentle">🔢</div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 rainbow-text">
            Numberblocks Finder!
          </h1>
          <p className="text-xl font-medium text-muted-foreground">
            Find or imagine your favorite Numberblocks pictures! 🌈
          </p>
        </header>

        <div className="space-y-8">
          <ScrapeControls
            onScrape={scrapeImages}
            onStop={stopScraping}
            onDownload={downloadAsZip}
            isLoading={isLoading}
            isDownloading={isDownloading}
            hasImages={hasImages}
            imageCount={successfulImageCount}
            progress={progress}
          />

          <ImageGallery images={images} onImageUpdate={updateImage} />
        </div>

        <footer className="text-center mt-12 text-muted-foreground">
          <p className="text-lg">Made with 💜 for little number fans!</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
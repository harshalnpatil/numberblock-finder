
# Numberblocks Image Scraper & Downloader

## What We'll Build
A simple web app that scrapes high-quality Numberblocks character images from the Fandom wikis and lets you download them all as a ZIP file to your phone.

---

## Core Features

### 1. Image Scraper
- Connects to **Firecrawl** to scrape the Numberblocks Fandom wiki
- Targets character pages for numbers 1-100+ (and beyond if available)
- Extracts the primary character image from each page (the official "infobox" image)
- Stores image URLs organized by number

### 2. Image Gallery Preview
- Displays all scraped images in a grid organized by number
- Shows the number label under each image so you can verify you have the right ones
- Visual confirmation before downloading

### 3. Bulk ZIP Download
- **"Download All as ZIP"** button
- Packages all images into a single ZIP file
- Images named clearly (e.g., `001.png`, `002.png`, `010.png`, `100.png`)
- Works on mobile - download directly to your phone's files

---

## How It Works

1. **You click "Scrape Images"** → App fetches character pages from the wiki
2. **Review the gallery** → See all the images organized by number
3. **Click "Download ZIP"** → Get a single file with all images, ready to transfer to your projector app

---

## Technical Approach
- Uses Firecrawl connector to scrape Fandom wiki pages
- Processes multiple character pages to extract official images
- Client-side ZIP generation for easy mobile download
- No account or backend storage needed - images are packaged on-the-fly


# Mess Refund Tracker
*Stop leaving money on the table — instantly track your skipped meals and calculate the refunds your hostel owes you.*

**[ Offline-First ]** **[ Zero Backend ]** **[ PWA Ready ]**

## Overview
Hostellers skip meals frequently, but rarely claim the refunds they are owed because manual tracking is tedious and prone to errors. Mess Refund Tracker solves this with an instant, offline-first progressive web app that offers one-tap meal logging and automatic, real-time refund calculation.

## Built For
Built for the Mind the Product "World Product Day: Everyone Ships Now" hackathon (June 2026) and instrumented with Novus.ai for product analytics.

## Features
- **One-Tap Meal Logging:** Interactive calendar to seamlessly log skipped breakfasts, lunches, and dinners.
- **Customizable Presets:** Pre-configured refund rates (Standard, Flat Rate, Light Refund) or fully custom inputs.
- **Monthly History & Filters:** Easily toggle between "This Month" and "All Time" views with collapsible monthly breakdowns.
- **Live Refund Forecast:** A dynamic progress bar projects your expected total refund by month's end.
- **Export & Backup:** Secure JSON backup/restore functionality to safely migrate your data.
- **Warden Report & Receipt:** Generate PDF-ready print views or download a polished PNG receipt to submit your claim.
- **Fully Offline:** Zero login, zero backend, and zero network calls required — all data is securely persisted via browser `localStorage`.

## Tech Stack
- **Vanilla HTML/CSS/JS:** No frameworks, entirely lightweight.
- **Tailwind CSS:** Styled via CDN for rapid, modern utility classes.
- **Storage:** Browser `localStorage` for offline data persistence.
- **Rendering:** HTML5 Canvas API for local, client-side image exports.
- **Build:** Zero build steps — runs immediately in the browser.

## Getting Started
To use the application, clone the repository and open the index file in any modern browser. No `npm install`, no build process, and no server are required.

```bash
git clone https://github.com/Bunny276-luffy/mess-refund-tracker.git
```
Then, simply open `index.html` in your browser.

## How It Works
1. **Set Rates:** Configure your hostel's specific refund rates or select from the default presets.
2. **Log Meals:** Tap any date on the calendar to mark your skipped meals.
3. **Track Refund:** Watch your total and month-end forecast update live.
4. **Claim It:** Export a Warden Report or download an image receipt to officially claim your refund from the mess administration.

## Why Offline-First?
Hostel Wi-Fi can be notoriously unreliable, and students shouldn't have to create an account just to track their personal meals. By using local storage exclusively, we eliminate privacy concerns, remove server dependencies, and guarantee instant load times regardless of network conditions.

## License
MIT License — free to use and adapt.

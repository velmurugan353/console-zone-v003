import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function expectMatch(source: string, pattern: RegExp, message: string) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

const appSource = read('src/App.tsx');
const rentalsSource = read('src/pages/Rentals.tsx');
const bookingSource = read('src/pages/RentalBookingPage.tsx');
const confirmationSource = read('src/pages/BookingConfirmationPage.tsx');

expectMatch(
  appSource,
  /path="\/rentals\/:slug\/book"/,
  'App router must expose /rentals/:slug/book for the rental CTA.',
);

expectMatch(
  appSource,
  /path="\/rentals\/:slug\/book\/confirm"/,
  'App router must expose /rentals/:slug/book/confirm for the booking confirmation page.',
);

expectMatch(
  rentalsSource,
  /to=\{`\/rentals\/\$\{activeStock\?\.slug\}\/book`\}/,
  'Rentals page must link into the slug-based booking route.',
);

expectMatch(
  bookingSource,
  /const\s+\{\s*slug\s*\}\s*=\s*useParams\(\)/,
  'Rental booking page must read the slug route param.',
);

expectMatch(
  bookingSource,
  /navigate\(`\/rentals\/\$\{slug\}\/book\/confirm\?id=\$\{docRef\.id\}`\)/,
  'Rental booking page must navigate to the slug-based confirmation route.',
);

expectMatch(
  confirmationSource,
  /const\s+\{\s*slug\s*\}\s*=\s*useParams\(\)/,
  'Booking confirmation page must read the slug route param.',
);

console.log('Rental route regression checks passed.');

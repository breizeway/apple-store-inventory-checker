const request = require('request');
const notifier = require('node-notifier');

const args = process.argv.slice(2);
const favorites = ['MK1A3LL/A', 'MK1H3LL/A'];
const control = 'MYD92LL/A';

// const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// console.log(timezone);
const timeZone = 'America/Los_Angeles';

let storeNumber = 'R077';
let state = 'OR';

if (args.length > 0) {
	const passedStore = args[0];
	if (passedStore.charAt(0) === 'R') {
		// All retail store numbers start with R
		storeNumber = passedStore;
		state = null;
	}
}

const SKUs = {
  'MKGR3LL/A': '14" Si, Base',
  'MKGP3LL/A': '14" SG, Base',
  'MKGT3LL/A': '14" Si, Better',
  'MKGQ3LL/A': '14" SG, Better',
  'MMQX3LL/A': '14" Si, Ultimate',
  'MKH53LL/A': '14" SG, Ultimate',
  'MK1E3LL/A': '16" Si, Base',
  'MK183LL/A': '16" SG, Base',
  'MK1F3LL/A': '16" Si, Better',
  'MK193LL/A': '16" SG, Better',
  'MK1H3LL/A': '16" Si, Best',
  'MK1A3LL/A': '16" SG, Best',
  'MK1A3LL/A': '16" SG, Ultimate',
  'MK1H3LL/A': '16" Si, Ultimate',
  [control]: '13" Control',
};

const query =
  Object.keys(SKUs)
    .map((k, i) => `parts.${i}=${encodeURIComponent(k)}`)
    .join('&') + `&searchNearby=true&store=${storeNumber}`;

var options = {
  method: 'GET',
  url: 'https://www.apple.com/shop/fulfillment-messages?' + query,
};

request(options, (error, response) => {
  if (error) throw new Error(error);

  const body = JSON.parse(response.body);
  const storesArray = body.body.content.pickupMessage.stores;
  let skuCounter = {};
  let hasStoreSearchError = false;

  const statusArray = storesArray
    .flatMap((store) => {
      if (state && state !== store.state) return null;

      const name = store.storeName;
      let productStatus = [];

      for (const [key, value] of Object.entries(SKUs)) {
        const product = store.partsAvailability[key];

        hasStoreSearchError = product.storeSearchEnabled !== true;

        if (key === control && hasStoreSearchError !== true) {
          hasStoreSearchError = product.pickupDisplay !== 'available';
        } else {
          productStatus.push(`${value}: ${product.pickupDisplay}`);

          if (product.pickupDisplay !== 'unavailable') {
            console.log(`${value} in stock at ${store.storeName}`);
            let count = skuCounter[key] ?? 0;
            count += 1;
            skuCounter[key] = count;
          }
        }
      }

      return {
        name: name,
        products: productStatus,
      };
    })
    .filter((n) => n);

  let hasError = hasStoreSearchError;

  const inventory = Object.entries(skuCounter)
    .map(([key, value]) => `${SKUs[key]}: ${value}`)
    .join(' | ');

  console.log(inventory);

  let hasUltimate = Object.keys(skuCounter).some((r) => favorites.indexOf(r) >= 0);
  let notificationMessage;

  if (inventory) {
    notificationMessage = `${hasUltimate ? 'FOUND ULTIMATE! ' : ''}Some models found: ${inventory}`;
  } else {
    console.log(statusArray);
    notificationMessage = 'No models found.';
  }

  const message = hasError ? 'Possible error?' : notificationMessage;
  notifier.notify({
    title: 'MacBook Pro Availability',
    message: message,
    sound: hasError || inventory,
    timeout: false,
  });

  // Log time at end
  console.log(new Date().toLocaleString('en-US', { timeZone }));
});

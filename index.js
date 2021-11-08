const request = require("request");
const notifier = require("node-notifier");
const { SKUs, COUNTRIES, CONTROL } = require("./constants");


const args = process.argv.slice(2);
const favorites = ['MMQW3LL/A', 'MK233LL/A'];

//  to find timezone:
//    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
//    console.log(timezone);

const timeZone = 'America/Los_Angeles';

let storeNumber = 'R077';
let state = 'OR';
let countryCode = '';

if (args.length > 0) {
  const passedStore = args[0];
  const passedCountry = args[1] ?? "US";
  if (passedStore.charAt(0) === "R") {
    // All retail store numbers start with R
    storeNumber = passedStore;
    state = null;
  }
  countryCode = COUNTRIES[passedCountry];
}

const query =
  Object.keys(SKUs)
    .map((k, i) => `parts.${i}=${encodeURIComponent(k)}`)
    .join("&") + `&searchNearby=true&store=${storeNumber}`;

const options = {
  method: "GET",
  url: `https://www.apple.com${countryCode}/shop/fulfillment-messages?` + query,
};

request(options, (error, response) => {
  if (error) throw new Error(error);

  const body = JSON.parse(response.body);
  const storesArray = body.body.content.pickupMessage.stores;
  const skuCounter = {};
  let hasStoreSearchError = false;

  const statusArray = storesArray
    .flatMap((store) => {
      if (state && state !== store.state) return null;

      const name = store.storeName;
      let productStatus = [];

      for (const [key, value] of Object.entries(SKUs)) {
        const product = store.partsAvailability[key];

        hasStoreSearchError = product.storeSearchEnabled !== true;

        if (key === CONTROL && hasStoreSearchError !== true) {
          hasStoreSearchError = product.pickupDisplay !== "available";
        } else {
          productStatus.push(`${value}: ${product.pickupDisplay}`);

          if (product.pickupDisplay !== "unavailable") {
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

  const inventory = Object.entries(skuCounter)
    .map(([key, value]) => `${SKUs[key]}: ${value}`)
    .join(' | ');

  console.log(inventory);

  const hasFavorites = Object.keys(skuCounter).some(
    (r) => favorites.indexOf(r) >= 0
  );
  let notificationMessage;

  if (inventory) {
    notificationMessage = `${
      hasFavorites ? "FOUND FAVORITE! " : ""
    }Some models found: ${inventory}`;
  } else {
    console.log(statusArray);
    notificationMessage = "No models found.";
  }

  const message = hasStoreSearchError ? "Possible error?" : notificationMessage;
  notifier.notify({
    title: "MacBook Pro Availability",
    message: message,
    sound: hasStoreSearchError || inventory,
    timeout: false,
  });

  // Log time at end
  console.log(new Date().toLocaleString("en-US", { timeZone }));
});

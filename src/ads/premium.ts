// Who sees ads: free players, unless ads are switched off altogether.
let premium = false;
export const setPremium = (p: boolean) => { premium = p; };

/** Ads are switched off for now. Set to true to bring back Sarvimo ads and the "No Ads" upgrade prompts. */
export const ADS_ON = false;
export const adsEnabled = () => ADS_ON && !premium;

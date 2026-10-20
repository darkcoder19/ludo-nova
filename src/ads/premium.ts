// Who sees ads. Until accounts exist, everyone is a free player.
// Will be backed by the signed-in user's plan (free / premium).
let premium = false;
export const setPremium = (p: boolean) => { premium = p; };
export const adsEnabled = () => !premium;

// One catalog shared by physics, rendering and the field guide.
export const FOOD_TYPES=Object.freeze(['jelly','moon','compass']);
export const TRASH_TYPES=Object.freeze(['bag','balloon','film','glove','bottle','cup','mask']);
export const TARGET_TYPES=Object.freeze([...FOOD_TYPES,...TRASH_TYPES]);
export const isFood=type=>FOOD_TYPES.includes(type);
export const VARIANT_COUNT=3;

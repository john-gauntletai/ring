import { detectMobile } from '../_lib/helpers.js';

export const DISTANCE_TO_PLAYER = 5;
export const TERRAIN_SIZE = detectMobile() ? 70 : 150;

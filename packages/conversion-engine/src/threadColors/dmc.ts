import type { ThreadBrand } from '@stitchlog/types';

export interface ThreadColorEntry {
  brand: ThreadBrand;
  code: string;
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
}

export const DMC_COLORS: ThreadColorEntry[] = [
  { brand: 'DMC', code: 'blanc',  name: 'White',                  hex: '#FFFFFF', r: 255, g: 255, b: 255 },
  { brand: 'DMC', code: 'B5200',  name: 'Bright White',           hex: '#F8F8FF', r: 248, g: 248, b: 255 },
  { brand: 'DMC', code: '3865',   name: 'Winter White',           hex: '#F5F0E8', r: 245, g: 240, b: 232 },
  { brand: 'DMC', code: '310',    name: 'Black',                  hex: '#000000', r:   0, g:   0, b:   0 },
  { brand: 'DMC', code: '3799',   name: 'Very Dk Pewter Gray',    hex: '#2B2B2B', r:  43, g:  43, b:  43 },
  { brand: 'DMC', code: '414',    name: 'Dk Steel Gray',          hex: '#7E7E7E', r: 126, g: 126, b: 126 },
  { brand: 'DMC', code: '318',    name: 'Lt Steel Gray',          hex: '#ABABAB', r: 171, g: 171, b: 171 },
  { brand: 'DMC', code: '762',    name: 'Very Lt Pearl Gray',     hex: '#D8D8D8', r: 216, g: 216, b: 216 },
  { brand: 'DMC', code: '321',    name: 'Red',                    hex: '#C62B38', r: 198, g:  43, b:  56 },
  { brand: 'DMC', code: '816',    name: 'Garnet',                 hex: '#8B1A2A', r: 139, g:  26, b:  42 },
  { brand: 'DMC', code: '351',    name: 'Coral',                  hex: '#E8614A', r: 232, g:  97, b:  74 },
  { brand: 'DMC', code: '353',    name: 'Peach',                  hex: '#F5B8A0', r: 245, g: 184, b: 160 },
  { brand: 'DMC', code: '3706',   name: 'Med Lt Melon',           hex: '#FF8F8F', r: 255, g: 143, b: 143 },
  { brand: 'DMC', code: '740',    name: 'Tangerine',              hex: '#FF7300', r: 255, g: 115, b:   0 },
  { brand: 'DMC', code: '742',    name: 'Lt Tangerine',           hex: '#F9B81F', r: 249, g: 184, b:  31 },
  { brand: 'DMC', code: '744',    name: 'Pale Yellow',            hex: '#FFF0A0', r: 255, g: 240, b: 160 },
  { brand: 'DMC', code: '307',    name: 'Lemon',                  hex: '#FFE733', r: 255, g: 231, b:  51 },
  { brand: 'DMC', code: '472',    name: 'Ultra Lt Avocado',       hex: '#A8C96E', r: 168, g: 201, b: 110 },
  { brand: 'DMC', code: '704',    name: 'Bright Chartreuse',      hex: '#6ECC2B', r: 110, g: 204, b:  43 },
  { brand: 'DMC', code: '909',    name: 'Very Dk Emerald Grn',    hex: '#1A6B33', r:  26, g: 107, b:  51 },
  { brand: 'DMC', code: '502',    name: 'Blue Green',             hex: '#6BA48C', r: 107, g: 164, b: 140 },
  { brand: 'DMC', code: '336',    name: 'Navy Blue',              hex: '#1B3A6B', r:  27, g:  58, b: 107 },
  { brand: 'DMC', code: '798',    name: 'Dk Delft Blue',          hex: '#3B6BB5', r:  59, g: 107, b: 181 },
  { brand: 'DMC', code: '809',    name: 'Delft Blue',             hex: '#7BA3D4', r: 123, g: 163, b: 212 },
  { brand: 'DMC', code: '3753',   name: 'Ultra Very Lt Ant Blue', hex: '#D4E4F0', r: 212, g: 228, b: 240 },
  { brand: 'DMC', code: '553',    name: 'Violet',                 hex: '#8B5BA5', r: 139, g:  91, b: 165 },
  { brand: 'DMC', code: '210',    name: 'Med Lavender',           hex: '#C9A8D4', r: 201, g: 168, b: 212 },
  { brand: 'DMC', code: '3835',   name: 'Med Grape',              hex: '#9B6B9B', r: 155, g: 107, b: 155 },
  { brand: 'DMC', code: '223',    name: 'Lt Shell Pink',          hex: '#C98080', r: 201, g: 128, b: 128 },
  { brand: 'DMC', code: '3350',   name: 'Ultra Dk Dusty Rose',    hex: '#B5476B', r: 181, g:  71, b: 107 },
  { brand: 'DMC', code: '433',    name: 'Med Brown',              hex: '#8B4513', r: 139, g:  69, b:  19 },
  { brand: 'DMC', code: '434',    name: 'Lt Brown',               hex: '#A0522D', r: 160, g:  82, b:  45 },
  { brand: 'DMC', code: '435',    name: 'Very Lt Brown',          hex: '#C4813B', r: 196, g: 129, b:  59 },
  { brand: 'DMC', code: '437',    name: 'Lt Tan',                 hex: '#D4A96A', r: 212, g: 169, b: 106 },
  { brand: 'DMC', code: '738',    name: 'Very Lt Tan',            hex: '#E8C99A', r: 232, g: 201, b: 154 },
  { brand: 'DMC', code: '739',    name: 'Ultra Very Lt Tan',      hex: '#F5E6C8', r: 245, g: 230, b: 200 },
  { brand: 'DMC', code: '801',    name: 'Dk Coffee Brown',        hex: '#6B3A1F', r: 107, g:  58, b:  31 },
  { brand: 'DMC', code: '938',    name: 'Ultra Dk Coffee Brn',    hex: '#3D1C0A', r:  61, g:  28, b:  10 },
  { brand: 'DMC', code: '3371',   name: 'Black Brown',            hex: '#1A0A05', r:  26, g:  10, b:   5 },
  { brand: 'DMC', code: '420',    name: 'Dk Hazelnut Brown',      hex: '#8B6914', r: 139, g: 105, b:  20 },
  { brand: 'DMC', code: '422',    name: 'Lt Hazelnut Brown',      hex: '#C4A46B', r: 196, g: 164, b: 107 },
  { brand: 'DMC', code: '644',    name: 'Med Beige Gray',         hex: '#D4CCBA', r: 212, g: 204, b: 186 },
  { brand: 'DMC', code: '822',    name: 'Lt Beige Gray',          hex: '#E8E0CC', r: 232, g: 224, b: 204 },
  { brand: 'DMC', code: '3782',   name: 'Lt Mocha Brown',         hex: '#C4B090', r: 196, g: 176, b: 144 },
  { brand: 'DMC', code: '3024',   name: 'Very Lt Brown Gray',     hex: '#D8D0C0', r: 216, g: 208, b: 192 },
  { brand: 'DMC', code: '169',    name: 'Lt Pewter',              hex: '#909090', r: 144, g: 144, b: 144 },
  { brand: 'DMC', code: '3072',   name: 'Very Lt Beaver Gray',    hex: '#E0E0DC', r: 224, g: 224, b: 220 },
  { brand: 'DMC', code: '535',    name: 'Very Lt Ash Gray',       hex: '#646464', r: 100, g: 100, b: 100 },
  { brand: 'DMC', code: '3862',   name: 'Dk Mocha Beige',         hex: '#7A6040', r: 122, g:  96, b:  64 },
  { brand: 'DMC', code: '3863',   name: 'Med Mocha Beige',        hex: '#9A7A52', r: 154, g: 122, b:  82 },
];

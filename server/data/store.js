let nextId = 1;
const id = (prefix) => `${prefix}-${nextId++}`;

export const members = [
  { id: 'maya', name: 'Maya', height: '5\'5"', size: 'S', color: '#e6879f', accent: '#f7d9e2' },
  { id: 'liam', name: 'Liam', height: '6\'1"', size: 'L', color: '#5b84b1', accent: '#d9e6f5' },
  { id: 'sophie', name: 'Sophie', height: '5\'8"', size: 'M', color: '#d99a4e', accent: '#f7e3c9' },
];

export const items = [
  { id: id('item'), ownerId: 'maya', name: 'Camel Trench Coat', category: 'outerwear', size: 'S', fabric: 'Wool-Blend Gabardine', brand: 'Sezane', laundry: 'fresh', pool: true, claimedBy: 'liam' },
  { id: id('item'), ownerId: 'maya', name: 'Silk Slip Dress', category: 'dress', size: 'S', fabric: 'Mulberry Silk', brand: 'Reformation', laundry: 'fresh', pool: true, claimedBy: null },
  { id: id('item'), ownerId: 'maya', name: 'Cropped Cardigan', category: 'top', size: 'S', fabric: 'Merino Wool', brand: 'Aritzia', laundry: 'hamper', pool: false, claimedBy: null },
  { id: id('item'), ownerId: 'maya', name: 'White Oxford Shirt', category: 'top', size: 'S', fabric: 'Egyptian Cotton', brand: 'J.Crew', laundry: 'fresh', pool: true, claimedBy: null },
  { id: id('item'), ownerId: 'maya', name: 'Wide-Leg Trousers', category: 'bottom', size: 'S', fabric: 'Tencel Twill', brand: 'Mango', laundry: 'fresh', pool: true, claimedBy: null },

  { id: id('item'), ownerId: 'liam', name: 'Raw Denim Jacket', category: 'outerwear', size: 'L', fabric: '13.5oz Raw Denim', brand: "Levi's Vintage", laundry: 'fresh', pool: true, claimedBy: null },
  { id: id('item'), ownerId: 'liam', name: 'Merino Crewneck', category: 'top', size: 'L', fabric: 'Merino Wool', brand: 'Uniqlo', laundry: 'fresh', pool: true, claimedBy: null },
  { id: id('item'), ownerId: 'liam', name: 'Chino Trousers', category: 'bottom', size: 'L', fabric: 'Cotton Twill', brand: 'Banana Republic', laundry: 'hamper', pool: false, claimedBy: null },
  { id: id('item'), ownerId: 'liam', name: 'Suede Chelsea Boots', category: 'shoes', size: '11', fabric: 'Suede', brand: 'Clarks', laundry: 'fresh', pool: true, claimedBy: null },
  { id: id('item'), ownerId: 'liam', name: 'Oxford Button-Down', category: 'top', size: 'L', fabric: 'Egyptian Cotton', brand: 'J.Crew', laundry: 'fresh', pool: true, claimedBy: null },

  { id: id('item'), ownerId: 'sophie', name: 'Leather Moto Jacket', category: 'outerwear', size: 'M', fabric: 'Lambskin Leather', brand: 'AllSaints', laundry: 'fresh', pool: true, claimedBy: null },
  { id: id('item'), ownerId: 'sophie', name: 'Pleated Midi Skirt', category: 'bottom', size: 'M', fabric: 'Satin Polyester', brand: 'Zara', laundry: 'fresh', pool: true, claimedBy: null },
  { id: id('item'), ownerId: 'sophie', name: 'Ribbed Tank Top', category: 'top', size: 'M', fabric: 'Egyptian Cotton', brand: 'Skims', laundry: 'hamper', pool: true, claimedBy: null },
  { id: id('item'), ownerId: 'sophie', name: 'Platform Boots', category: 'shoes', size: '8', fabric: 'Vegan Leather', brand: 'Dr. Martens', laundry: 'fresh', pool: false, claimedBy: null },
  { id: id('item'), ownerId: 'sophie', name: 'Cashmere Wrap Coat', category: 'outerwear', size: 'M', fabric: 'Cashmere', brand: 'Mango', laundry: 'fresh', pool: true, claimedBy: null },
];

export const influencers = [];

export const votes = { fire: 0, slay: 0, swap: 0, pass: 0, log: [] };

export function memberById(mid) {
  return members.find((m) => m.id === mid) || null;
}

export function itemById(iid) {
  return items.find((i) => i.id === iid) || null;
}

export function poolItems(excludeOwnerId = null) {
  return items.filter((i) => i.pool && !i.claimedBy && (!excludeOwnerId || i.ownerId !== excludeOwnerId));
}

export function newId(prefix) {
  return id(prefix);
}

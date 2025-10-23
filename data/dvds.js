const catalog = [
  {
    title: "The Matrix",
    releaseYear: 1999,
    formats: ["DVD", "Blu-ray"],
    availability: "in_stock",
    inventoryCount: 12,
    retailers: ["Best Buy", "Target", "Barnes & Noble"],
  },
  {
    title: "Interstellar",
    releaseYear: 2014,
    formats: ["DVD", "Blu-ray", "4K UHD"],
    availability: "low_stock",
    inventoryCount: 3,
    retailers: ["Amazon", "Walmart"],
  },
  {
    title: "The Lord of the Rings: The Fellowship of the Ring",
    releaseYear: 2001,
    formats: ["DVD", "Extended Edition DVD", "Blu-ray"],
    availability: "preorder",
    inventoryCount: 0,
    retailers: ["Best Buy", "Amazon"],
  },
  {
    title: "Everything Everywhere All at Once",
    releaseYear: 2022,
    formats: ["DVD", "Blu-ray", "Digital"],
    availability: "in_stock",
    inventoryCount: 8,
    retailers: ["A24 Shop", "Amazon", "Target"],
  },
  {
    title: "Spider-Man: Across the Spider-Verse",
    releaseYear: 2023,
    formats: ["DVD", "Blu-ray", "4K UHD"],
    availability: "preorder",
    inventoryCount: 0,
    retailers: ["Amazon", "Walmart", "Best Buy"],
  },
  {
    title: "Barbie",
    releaseYear: 2023,
    formats: ["DVD", "Blu-ray"],
    availability: "in_stock",
    inventoryCount: 6,
    retailers: ["Amazon", "Target"],
  },
];

module.exports = { catalog };

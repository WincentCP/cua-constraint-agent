// Editorial identity only: never derive imagery or copy from hidden attributes.
export const collection = [
  {
    name: "Daily Form Tee",
    image: "collection.png",
    short: "Siluet sederhana, ruang untuk gaya personal.",
    description:
      "Awal yang sederhana untuk gaya yang personal. Daily Form memberi ruang untuk dipadukan dengan pilihan favoritmu.",
    design: "Kaos polos dengan tampilan bersih tanpa grafis.",
  },
  {
    name: "After Hours Tee",
    image: "after-hours.png",
    short: "Sepotong cerita kota dalam grafis sederhana.",
    description:
      "Terinspirasi ritme kota setelah matahari turun. After Hours membawa aksen grafis yang memberi karakter pada penampilan sehari-hari.",
    design: "Grafis lanskap kota dan tulisan After Hours pada bagian dada.",
  },
  {
    name: "Studio Edition Tee",
    image: "studio-edition.png",
    short: "Tipografi berani untuk ekspresi sehari-hari.",
    description:
      "Tipografi sebagai bentuk ekspresi. Studio Edition menghadirkan komposisi visual untuk kamu yang suka tampil dengan sudut pandang sendiri.",
    design:
      "Komposisi tulisan Studio Edition dengan bingkai grafis pada bagian depan.",
  },
] as const;
export function editorial(name: string) {
  return collection.find((p) => p.name === name) ?? collection[0];
}

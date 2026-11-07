export type Ownership = "owned" | "wishlist" | "none";

export type Book = {
  id: string;
  title: string;
  author: string;
  ownership: Ownership;
  coverKey?: string;
};

export const demoBooks: Book[] = [
  {
    id: "demo-brume",
    title: "La brume du phare",
    author: "Ada Quenelle",
    ownership: "owned",
  },
  {
    id: "demo-horloge",
    title: "L'horloge sans aiguilles",
    author: "Milo Sablier",
    ownership: "wishlist",
  },
  {
    id: "demo-jardin",
    title: "Le jardin sous la gare",
    author: "Nina Calebasse",
    ownership: "none",
  },
  {
    id: "demo-cartographe",
    title: "Mémoires d'un cartographe distrait",
    author: "Oscar Liseron",
    ownership: "owned",
  },
];

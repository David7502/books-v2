# Bibliothèque

Application de livres, construite une étape à la fois. L'interface affiche quatre livres inventés et permet de les filtrer par titre ou par auteur. Rien n'est enregistré, et le Worker n'a pas changé. Il n'y a pas encore de base de données ni de mise en ligne.

## Modèle accepté

Deux idées restent séparées, dans deux tableaux du même fichier de démo. Rien n'est enregistré.

- un **livre** (`books`) : titre, auteur en texte simple, possession (`owned`, `wishlist` ou `none`), et plus tard une couverture ;
- une **lecture** (`readings`) : pour l'instant, seulement `id`, `bookId` et `status` (`to_read`, `reading` ou `read`). Les dates, le lieu et la note viendront plus tard.

Posséder un livre et l'avoir lu sont deux faits différents. Relire un livre ajoutera une nouvelle lecture, pas un second livre.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de départ. Vite la cherche à la racine, à côté de `vite.config.ts`. Elle charge le code React. |
| `src/client/main.tsx` | Démarre React dans l'élément `#root`. |
| `src/client/demo-books.ts` | Les livres, et à part les lectures de démo. |
| `src/client/BookCard.tsx` | Une carte. Elle affiche « j’ai », « je veux » et « j’ai lu » seulement quand c'est le cas. |
| `src/client/search.ts` | Prépare le texte cherché et décide si un livre correspond. |
| `src/client/App.tsx` | L'écran. Le champ de recherche filtre les cartes. |
| `tests/search.test.ts` | Vérifie la recherche sans ouvrir le navigateur. |
| `src/client/styles.css` | Mise en page courte : une colonne sur un téléphone, deux sur un écran large. |
| `src/worker/index.ts` | Le Worker. Il répond uniquement à `GET /api/health`. |
| `wrangler.jsonc` | Réglages du Worker : date de compatibilité, fichiers statiques, route `/api/*`, journaux. Aucun secret. |
| `vite.config.ts` | Relie Vite, React et le plugin Cloudflare. |
| `package.json` | Dépendances et commandes `dev`, `build`, `typecheck`, `preview`. |
| `tsconfig.json` | Point d'entrée TypeScript. Il renvoie vers les trois fichiers suivants. |
| `tsconfig.app.json` | Vérifie le code de `src/client`. |
| `tsconfig.node.json` | Vérifie `vite.config.ts`. |
| `tsconfig.worker.json` | Vérifie `src/worker`. |
| `.gitignore` | Empêche Git d'enregistrer `node_modules`, `dist`, `.wrangler` et les fichiers locaux `.dev.vars*`. |

`worker-configuration.d.ts` est produit par `npm run typecheck`. Il décrit les types du Worker à partir de `wrangler.jsonc`. On ne l'écrit pas à la main, et on ne le commit pas.

`npm run build` produit `dist/`, ignoré par Git. Ce dossier contient l'interface compilée et le Worker prêt à être prévisualisé.

## Trajet d'une requête

Le navigateur parle à un seul programme local : Vite, avec le plugin Cloudflare. Ce programme fait deux choses.

1. Pour `/`, `/src/client/...` et les autres fichiers de l'interface, il sert des **fichiers statiques**. En local, Vite les sert directement. Après `npm run build`, ce sont les fichiers générés dans `dist`.
2. Pour `/api/*`, `wrangler.jsonc` envoie la requête au **Worker** (`run_worker_first`). `src/worker/index.ts` répond `{ "ok": true }` sur `/api/health`, et `404` sur les autres chemins `/api/*`.

La page n'appelle pas `/api/health`. Cette adresse sert seulement à voir la séparation entre l'interface et le Worker. `{ "ok": true }` veut dire que la route a répondu. Il n'y a pas de service externe derrière.

## Commandes

```bash
npm install
npm run dev
```

Puis ouvrir l'adresse affichée, en général `http://localhost:5173/`.

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

`preview` rejoue le résultat du build dans le runtime Workers, sur un autre port. Rien n'est déployé.

## De la liste à l'écran

`demoBooks` est un **tableau** : une liste ordonnée. Chaque case est un **objet**, un seul livre, avec ses champs côte à côte (`id`, `title`, `author`, `ownership`).

Le **type** `Book` décrit cet objet. TypeScript refuse un livre sans titre, ou une possession autre que `owned`, `wishlist` ou `none`. L'auteur est un texte. `coverKey` est facultatif : aucun livre de démo ne l'a, donc chaque carte affiche « Pas de couverture » sans télécharger d'image.

La possession et la lecture restent deux faits. `owned` affiche « j’ai ». `wishlist` affiche « je veux ». `none` n'affiche rien : ce n'est pas « j’ai lu ». « j’ai lu » vient seulement d'une lecture dont le `status` est `read`.

Ces mots se cumulent. Un livre possédé et terminé montre « j’ai » et « j’ai lu ». Une liste d'achat terminée montrerait « je veux » et « j’ai lu » : la démo n'a pas encore ce cas, mais les deux conditions sont indépendantes. Un livre emprunté et terminé (`none` + lecture `read`) montre seulement « j’ai lu ». Un livre seulement possédé montre « j’ai ». Un livre seulement souhaité montre « je veux ».

Dans `BookCard`, `{showOwned && <li>j’ai</li>}` n'écrit la balise que si la condition est vraie. Chaque libellé a sa propre condition. L'aspect de ces mots est provisoire.

`App.tsx` importe le tableau de livres. `map` produit un élément de liste par livre. `key={book.id}` donne à React un nom stable. `BookCard` reçoit le livre et `completed`, un booléen calculé à part avec `hasCompletedReading`.

## Rechercher dans la liste

`useState("")` crée une **mémoire** pour le texte tapé. `query` est ce texte. `setQuery` le remplace. À chaque frappe, React réaffiche la page.

Le champ est **contrôlé** : `value={query}` affiche cette mémoire, et `onChange` y recopie ce que tu tapes. Le libellé « Rechercher un titre ou un auteur » est visible à côté du champ.

`visibleBooks` est un nouveau tableau **calculé** : `filter` garde les livres dont le titre ou l'auteur contient la recherche. `map` dessine seulement ce tableau. `filter` choisit, `map` affiche.

`normalizeSearch` prépare les deux textes de la même façon : espaces en trop enlevés, minuscules, accents retirés. « Mémoires » et « memoires » deviennent le même mot. Une recherche vide, ou faite seulement d'espaces, garde les quatre livres.

Les libellés « j’ai », « j’ai lu » et « je veux » ne changent pas : la recherche ne les lit pas.

## Résultat attendu

- La page affiche le titre **Bibliothèque**, la mention de données inventées, un champ « Rechercher un titre ou un auteur », et **4** cartes quand la recherche est vide.
- « La brume du phare » : « j’ai » et « j’ai lu ». « Mémoires d'un cartographe distrait » : « j’ai ». « L'horloge sans aiguilles » : « je veux ». « Le jardin sous la gare » : « j’ai lu ».
- Les anciens libellés « Possédé », « Liste d'achat » et « Ni possédé, ni sur la liste d'achat » n'apparaissent plus.
- `curl -i http://localhost:5173/api/health` pendant `npm run dev` renvoie `200` et `{"ok":true}`.
- `phare` laisse « La brume du phare », avec « j’ai » et « j’ai lu ». `memoires` trouve « Mémoires d'un cartographe distrait ». `zzzz` affiche « Aucun livre » et une phrase qui dit qu'aucun livre ne correspond.
- `npm test`, `npm run typecheck` et `npm run build` se terminent sans erreur.

## Secrets

Ce dépôt ne contient aucun jeton, mot de passe ni fichier `.dev.vars`. Le nom `books-v2` dans `wrangler.jsonc` est seulement le nom du Worker. Le bloc `observability` prépare des journaux pour une future mise en ligne. En local, rien n'est envoyé.

## Exercice

Avec `npm run dev` lancé, cherche `phare`, puis `sablier`, puis `xyz`. Efface le champ : les quatre cartes reviennent. Essaie aussi `memoires` sans accent.

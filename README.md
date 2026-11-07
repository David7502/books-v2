# Bibliothèque

Application de livres, construite une étape à la fois. L'interface affiche maintenant quatre livres inventés. Ils vivent dans un fichier du projet : rien n'est enregistré, et le Worker n'a pas changé. Il n'y a pas encore de base de données ni de mise en ligne.

## Modèle accepté

Deux idées restent séparées. Seule la fiche du livre est décrite dans `demo-books.ts`, et seulement pour l'affichage. Les lectures ne sont pas encore dans le code.

- un **livre** (`books`) : titre, auteur en texte simple, possession (`owned`, `wishlist` ou `none`), et plus tard une couverture ;
- une **lecture** (`readings`) : statut (`to_read`, `reading` ou `read`), dates de début et de fin, lieu en texte libre, note de 1 à 5 ou vide.

Posséder un livre et l'avoir lu sont deux faits différents. Relire un livre ajoutera une nouvelle lecture, pas un second livre.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de départ. Vite la cherche à la racine, à côté de `vite.config.ts`. Elle charge le code React. |
| `src/client/main.tsx` | Démarre React dans l'élément `#root`. |
| `src/client/demo-books.ts` | Le type `Book` et le tableau des quatre livres de démonstration. |
| `src/client/BookCard.tsx` | Une carte : placeholder de couverture, titre, auteur, possession. |
| `src/client/App.tsx` | L'écran. Il parcourt le tableau et affiche une carte par livre. |
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
npm run typecheck
npm run build
npm run preview
```

`preview` rejoue le résultat du build dans le runtime Workers, sur un autre port. Rien n'est déployé.

## De la liste à l'écran

`demoBooks` est un **tableau** : une liste ordonnée. Chaque case est un **objet**, un seul livre, avec ses champs côte à côte (`id`, `title`, `author`, `ownership`).

Le **type** `Book` décrit cet objet. TypeScript refuse un livre sans titre, ou une possession autre que `owned`, `wishlist` ou `none`. L'auteur est un texte. `coverKey` est facultatif : aucun livre de démo ne l'a, donc chaque carte affiche « Pas de couverture » sans télécharger d'image.

La possession n'est pas un statut de lecture. `owned` veut dire « je l'ai », `wishlist` « je voudrais l'acheter », `none` « ni l'un ni l'autre ». Les lectures viendront plus tard, dans d'autres données.

`App.tsx` importe ce tableau. `map` le parcourt et produit un élément de liste par livre. `key={book.id}` donne à React un nom stable pour chaque carte. `BookCard` reçoit le livre dans la **prop** `book` : le composant affiche les champs, il ne va pas les chercher ailleurs.

## Résultat attendu

- La page affiche le titre **Bibliothèque**, la mention **Données de démonstration**, et **4** cartes.
- Les titres sont « La brume du phare », « L'horloge sans aiguilles », « Le jardin sous la gare » et « Mémoires d'un cartographe distrait ».
- `curl -i http://localhost:5173/api/health` pendant `npm run dev` renvoie `200` et `{"ok":true}`.
- `npm run typecheck` et `npm run build` se terminent sans erreur.

## Secrets

Ce dépôt ne contient aucun jeton, mot de passe ni fichier `.dev.vars`. Le nom `books-v2` dans `wrangler.jsonc` est seulement le nom du Worker. Le bloc `observability` prépare des journaux pour une future mise en ligne. En local, rien n'est envoyé.

## Exercice

Avec `npm run dev` lancé, ouvre `src/client/demo-books.ts`. Change le titre d'un livre, ou ajoute un objet avec un `id` que les autres n'utilisent pas. Enregistre, puis regarde la page : la carte suit le fichier. Si deux livres partagent le même `id`, React ne peut plus les distinguer.

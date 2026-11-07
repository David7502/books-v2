# Bibliothèque

Squelette local de l'application de livres. Cette étape montre seulement comment la page et une toute petite API vivent ensemble. Il n'y a pas encore de livres, de base de données, ni de mise en ligne.

## Modèle accepté, pas encore codé

Deux idées restent séparées :

- un **livre** (`books`) : titre, auteur en texte simple, possession (`owned`, `wishlist` ou `none`), et plus tard une couverture ;
- une **lecture** (`readings`) : statut (`to_read`, `reading` ou `read`), dates de début et de fin, lieu en texte libre, note de 1 à 5 ou vide.

Posséder un livre et l'avoir lu sont deux faits différents. Relire un livre ajoutera une nouvelle lecture, pas un second livre.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de départ. Vite la cherche à la racine, à côté de `vite.config.ts`. Elle charge le code React. |
| `src/client/main.tsx` | Démarre React dans l'élément `#root`. |
| `src/client/App.tsx` | Le seul écran : le titre « Bibliothèque ». |
| `src/client/styles.css` | Mise en page courte, lisible sur un téléphone ou un grand écran. |
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

## Résultat attendu

- La page d'accueil affiche le titre **Bibliothèque** et deux phrases.
- `curl -i http://localhost:5173/api/health` pendant `npm run dev` renvoie `200` et `{"ok":true}`.
- `curl -i http://localhost:5173/api/autre` renvoie `404`.
- `npm run typecheck` et `npm run build` se terminent sans erreur.

## Secrets

Ce dépôt ne contient aucun jeton, mot de passe ni fichier `.dev.vars`. Le nom `books-v2` dans `wrangler.jsonc` est seulement le nom du Worker. Le bloc `observability` prépare des journaux pour une future mise en ligne. En local, rien n'est envoyé.

## Exercice

Avec `npm run dev` lancé, ouvre la page d'accueil, puis `/api/health`. Écris une phrase : quel fichier produit la page, et quel fichier produit le JSON ?

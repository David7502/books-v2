# Bibliothèque

Application de livres, construite une étape à la fois. L'interface affiche les livres, permet de les chercher, d'en ajouter et d'en modifier. Les fiches sont enregistrées dans une base D1 **locale**. Elles restent après un rechargement et après un redémarrage du serveur de développement. Elles ne sont pas envoyées chez Cloudflare.

## Modèle accepté

Deux idées restent séparées, dans deux tableaux du même fichier de démo. Rien n'est enregistré.

- un **livre** (`books`) : titre, auteur en texte simple, possession (`owned`, `wishlist` ou `none`), et plus tard une couverture ;
- une **lecture** (`readings`) : une fiche par livre, avec un statut, des dates facultatives, un lieu et une note.

Posséder un livre et l'avoir lu sont deux faits différents. Chaque livre a au plus une fiche de lecture.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page de départ. Vite la cherche à la racine, à côté de `vite.config.ts`. Elle charge le code React. |
| `src/client/main.tsx` | Démarre React dans l'élément `#root`. |
| `src/client/demo-books.ts` | Les livres, et à part les lectures de démo. |
| `src/client/BookCard.tsx` | Une carte. Elle affiche « j’ai », « je veux » et « j’ai lu » seulement quand c'est le cas. |
| `src/client/search.ts` | Prépare le texte cherché et décide si un livre correspond. |
| `src/client/add-book.ts` | Vérifie le titre et l'auteur, puis ajoute le livre sans modifier l'ancien tableau. |
| `src/client/BookForm.tsx` | Le formulaire partagé : ajout vide, ou modification déjà remplie. |
| `src/client/path.ts` | Nettoie l'adresse (`/ajouter/` devient `/ajouter`). |
| `src/client/use-path.ts` | Lit l'adresse et la change sans recharger la page. |
| `src/client/App.tsx` | Garde les livres en mémoire et choisit l'écran selon l'adresse. |
| `tests/search.test.ts` | Vérifie la recherche sans ouvrir le navigateur. |
| `tests/add-book.test.ts` | Vérifie l'ajout : texte vide, possession, et livres de démo inchangés. |
| `src/client/styles.css` | Mise en page courte : une colonne sur un téléphone, deux sur un écran large. |
| `src/worker/index.ts` | L'API : liste, ajout et modification, avec le SQL paramétré. |
| `src/worker/validate.ts` | Contrôle le JSON reçu avant toute requête SQL. |
| `migrations/0001_books_and_readings.sql` | Crée les tables `books` et `readings`. |
| `seed/demo.sql` | Jeu facultatif de livres inventés, sans écraser l'existant. |
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
2. Pour `/api/*`, `wrangler.jsonc` envoie la requête au **Worker** (`run_worker_first`). `/api/health` répond `{ "ok": true }`. `/api/books` lit et écrit la base. Une autre adresse `/api/...` répond `404`.

## Commandes

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

`db:migrate` crée les tables dans la base locale, dans `.wrangler/`. `db:seed` est facultatif : il ajoute quatre livres inventés seulement s'ils ne sont pas déjà là, sans écraser tes modifications. Sans ce seed, la liste démarre vide. Puis ouvrir l'adresse affichée, en général `http://localhost:5173/`.

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

## Deux adresses

L'accueil est `/`. Le formulaire est `/ajouter`. Ce ne sont pas deux rechargements : `App` reste monté, donc le `useState` des livres survit au changement d'écran.

Le Worker sert déjà `index.html` pour une adresse qui n'est pas un fichier. C'est le mode `single-page-application`. React lit ensuite `window.location.pathname`. Un clic simple sur **Ajouter un livre** appelle `history.pushState` : l'adresse change, la page ne se recharge pas. Le bouton Précédent du navigateur envoie `popstate`, et l'écran suit. Ouvrir le lien dans un nouvel onglet charge vraiment `/ajouter`, comme un rechargement : la mémoire est vide, il reste les quatre livres inventés.

`/api/health` et les autres adresses `/api/...` passent d'abord par le Worker. Une adresse d'API inconnue répond `404`, pas la page HTML. La fiche de lecture est sur `/livres/identifiant/lecture`.

On n'ajoute pas de bibliothèque de routes. L'accueil est `/`, l'ajout `/ajouter`, la modification `/livres/identifiant/modifier`.

## Ajouter un livre

Le bouton **Ajouter un livre** de l'accueil mène à `/ajouter`. **Modifier**, sur une carte, mène à `/livres/…/modifier`. Les deux écrans utilisent le même `BookForm`. À la création, les champs commencent vides. À la modification, ils sont remplis avec le livre trouvé par son `id`.

`onSubmitBook` est la fonction fournie par `App`. Pour un ajout, elle fabrique un nouvel `id`. Pour une modification, elle garde l'`id`, la couverture et les lectures : seul le titre, l'auteur et la possession changent.

`onSubmit` reçoit l'événement du formulaire. `preventDefault()` empêche le navigateur de recharger la page. La touche Entrée dans un champ envoie ce même événement.

Les champs sont contrôlés : `value` affiche le `useState`, `onChange` le met à jour. `validateNewBook` enlève les espaces autour du titre et de l'auteur. Un texte vide, ou fait seulement d'espaces, est refusé et le formulaire n'est pas vidé. La case « j’ai » vaut `owned`. La case « je veux » vaut `wishlist`. Les deux peuvent rester vides : le livre est alors `none`, sans case nommée « Ni l’un ni l’autre ». Cocher l'une décoche l'autre, parce que la base ne garde qu'un seul lien. Les livres déjà enregistrés avec `none` restent ainsi tant qu'on ne coche rien.

Sur `/ajouter` seulement, la case **J’ai lu** est indépendante. Si elle est cochée, le Worker crée le livre et une fiche `read` dans le même `batch` D1. Les dates, le lieu et la note restent vides. Si l'une des deux écritures échoue, aucune n'est gardée. Modifier un livre n'envoie pas cette case : la fiche se change sur sa propre page.

`appendBook` construit un nouveau tableau `[...previous, book]`. `replaceBook` en construit un autre avec `map` : le livre dont l'`id` correspond est un nouvel objet, les autres restent les mêmes. On ne modifie pas l'ancien tableau sur place. Cette liste vit dans le `useState` de la visite. Elle n'est pas encore une base de données : recharger revient aux quatre livres inventés. Un `id` ajouté puis perdu après rechargement mène à « Livre introuvable », sans planter.

Au retour, la recherche est vidée s'il y en avait une, pour que la carte soit visible. Le message le dit. **Annuler** revient à `/` sans enregistrer.

## Une fiche de lecture

Chaque livre a une seule fiche, dans la table `readings`, reliée par `book_id`. Le bouton **Lecture** ouvre `/livres/identifiant/lecture`. Le même formulaire sert la première fois et les fois suivantes : le premier enregistrement crée la ligne, le suivant met à jour la même ligne.

`0002_reading_details.sql` ajoute des colonnes vides : dates, lieu, note. `0003_one_reading_per_book.sql` ajoute un index unique sur `book_id`. Les lignes déjà présentes restent. `npm run db:migrate` n'efface rien. Le jeu de démo et la base locale inspectée n'ont pas deux fiches pour un même livre. Si une base en avait déjà, l'index refuserait de se créer et le serveur refuserait d'en choisir une, sans les supprimer.

Une date vide reste vide. « À lire » n'accepte aucune date. « En cours » peut avoir un début, pas de fin. « Terminé » peut avoir les deux, et la fin ne peut pas précéder le début. La note est 1 à 5, ou « Sans note ». Elle ne change ni le statut ni la possession.

« j’ai lu » vient du statut Terminé de cette fiche. Changer « j’ai » ou « je veux » ne change pas la fiche.

## Compter et filtrer

L'accueil montre quatre boutons : **Tous**, **Lu**, **Je veux**, **J’ai**. Le nombre sur chaque bouton compte toute la bibliothèque, pas la recherche en cours. **Tous** est le nombre de livres enregistrés. **Lu** compte les fiches Terminées. **Je veux** compte `wishlist`. **J’ai** compte `owned`. Un livre possédé et terminé compte dans Tous, dans Lu et dans J’ai. La somme des boutons n'est donc pas le total.

Le bouton pressé a `aria-pressed="true"` et un contour. La liste en dessous applique ce filtre et la recherche titre ou auteur. Le nombre sous **Livres** est celui des cartes affichées. S'il ne reste rien, le message le dit, et **Revenir à Tous** enlève le filtre et la recherche. **Effacer**, à côté du champ, n'enlève que le texte.

## La base locale

Le navigateur appelle `/api/books`. Le Worker lit `env.DB`, exécute du SQL dont les valeurs viennent de `?` (elles ne sont pas collées dans la phrase SQL), puis renvoie du JSON. React range ce JSON dans son état.

D1 est le service de base de Cloudflare. Ici, `remote` vaut `false` et aucun identifiant de base distante n'est écrit : Wrangler n'a pas créé de base sur le compte. `npm run dev` utilise l'émulation locale, un fichier SQLite dans `.wrangler/`, ignoré par Git. Ce n'est pas la base du nuage. Un autre ordinateur ne la voit pas. Ne lance pas de déploiement : l'API n'a pas encore d'authentification.

`npm run preview`, après `npm run build`, réutilise aussi cette base locale si les migrations ont été appliquées. Les commandes de base portent `--local`. Il n'y a pas de commande de remise à zéro dans ce dépôt.

## Résultat attendu

- L'accueil `/` affiche le titre **Bibliothèque**, le bouton **Ajouter un livre**, la recherche, et **4** cartes quand la recherche est vide. Le formulaire est sur `/ajouter`.
- « La brume du phare » : « j’ai » et « j’ai lu ». « Mémoires d'un cartographe distrait » : « j’ai ». « L'horloge sans aiguilles » : « je veux ». « Le jardin sous la gare » : « j’ai lu ».
- Les anciens libellés « Possédé », « Liste d'achat » et « Ni possédé, ni sur la liste d'achat » n'apparaissent plus.
- `curl -i http://localhost:5173/api/health` pendant `npm run dev` renvoie `200` et `{"ok":true}`.
- `phare` laisse « La brume du phare », avec « j’ai » et « j’ai lu ». `memoires` trouve « Mémoires d'un cartographe distrait ». `zzzz` affiche « Aucun livre » et une phrase qui dit qu'aucun livre ne correspond.
- Un titre ou un auteur vide est refusé. Ajouter un livre avec **J’ai lu** et sans cocher « j’ai » affiche seulement « j’ai lu ». Ajouter avec « j’ai » sans cette case n'affiche pas « j’ai lu ». Les deux ensemble affichent les deux. Le livre reste après rechargement.
- Les boutons **Tous**, **Lu**, **Je veux** et **J’ai** montrent des totaux qui ne changent pas quand on cherche. **Lu** puis une recherche ne garde que les livres terminés qui correspondent.
- `npm test`, `npm run typecheck` et `npm run build` se terminent sans erreur.

## Secrets

Ce dépôt ne contient aucun jeton, mot de passe ni fichier `.dev.vars`. Le nom `books-v2` dans `wrangler.jsonc` est seulement le nom du Worker. Le bloc `observability` prépare des journaux pour une future mise en ligne. En local, rien n'est envoyé.

## Exercice

Avec `npm run dev`, ajoute un livre en cochant seulement **J’ai lu**. La carte montre « j’ai lu », sans « j’ai ». Le bouton **Lu** le compte. **J’ai** ne le compte pas. Aucune migration n'est nécessaire pour cette étape.

# Bibliothèque

Application de livres, construite une étape à la fois. L'interface affiche les livres, permet de les chercher, d'en ajouter et d'en modifier. Les fiches sont enregistrées dans une base D1 **locale**. Elles restent après un rechargement et après un redémarrage du serveur de développement. Elles ne sont pas envoyées chez Cloudflare.

## Modèle accepté

Deux idées restent séparées, dans deux tableaux du même fichier de démo. Rien n'est enregistré.

- un **livre** (`books`) : titre, auteur en texte simple, possession (`owned`, `wishlist` ou `none`), et la clé d'une couverture facultative ;
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

Le **type** `Book` décrit cet objet. TypeScript refuse un livre sans titre, ou une possession autre que `owned`, `wishlist` ou `none`. L'auteur est un texte. `coverKey` est facultatif. Sans clé, la carte affiche « Pas de couverture ». Avec une clé, elle demande l'image au Worker.

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

`onSubmitBook` est la fonction fournie par `App`. Pour un ajout, le Worker fabrique un nouvel `id`. Pour une modification, il garde l'`id` et les lectures : le titre, l'auteur et la possession changent. La couverture ne change que si une nouvelle image est choisie.

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

## Couvertures

Le formulaire d'ajout et celui de modification ont un champ image facultatif. JPEG, PNG ou WebP, 2 Mo maximum. Le navigateur montre un aperçu avant l'envoi. Sans image, la carte dit « Pas de couverture ».

Le Worker ne se fie pas au nom du fichier. Il lit les premiers octets. S'ils ne sont pas ceux d'un JPEG, d'un PNG ou d'un WebP, ou si le type annoncé ne correspond pas, il refuse et ne change rien. Une image acceptée est écrite dans le seau R2 `COVERS`, sous une clé `covers/` suivie d'un identifiant au hasard. D1 range seulement cette clé dans `cover_key`, qui existait déjà : aucune migration. La carte charge ensuite `/api/books/identifiant/cover`. Le Worker relit la clé, reprend l'objet, et répond avec son type et `nosniff`.

`remote` vaut `false` pour ce seau comme pour D1. `npm run dev` simule R2 dans `.wrangler/`, ignoré par Git. Ne lance pas `wrangler r2 bucket create` : cela créerait un seau chez Cloudflare. Ces commandes locales ne déploient pas.

Remplacer une couverture écrit d'abord le nouvel objet. La clé dans D1 ne change qu'ensuite. Si cette écriture échoue, l'ancienne couverture reste. Un ajout avec image et **J’ai lu** part dans la même requête : si l'image est refusée, le livre n'est pas créé.

## La base locale

Le navigateur appelle `/api/books`. Le Worker lit `env.DB`, exécute du SQL dont les valeurs viennent de `?` (elles ne sont pas collées dans la phrase SQL), puis renvoie du JSON. React range ce JSON dans son état.

D1 est le service de base de Cloudflare. Dans ce dépôt, `remote` vaut `false` et aucun identifiant de base distante n'est écrit. `npm run dev` et `npm run preview` utilisent l'émulation locale, un fichier SQLite dans `.wrangler/`, ignoré par Git. Ce n'est pas la base du nuage. Un autre ordinateur ne la voit pas.

L'écran ne répète plus cette phrase. Elle était fausse une fois l'application en ligne. On ne s'appuie pas sur `import.meta.env.DEV` ni sur le nom `localhost` pour l'afficher : `npm run preview` construit comme une version de production et reste pourtant sur la base locale.

`npm run preview`, après `npm run build`, réutilise aussi cette base locale si les migrations ont été appliquées. Les commandes de base portent `--local`. Il n'y a pas de commande de remise à zéro dans ce dépôt.

## Résultat attendu

- L'accueil `/` affiche le titre **Bibliothèque**, le bouton **Ajouter un livre**, la recherche, et **4** cartes quand la recherche est vide. Le formulaire est sur `/ajouter`.
- « La brume du phare » : « j’ai » et « j’ai lu ». « Mémoires d'un cartographe distrait » : « j’ai ». « L'horloge sans aiguilles » : « je veux ». « Le jardin sous la gare » : « j’ai lu ».
- Les anciens libellés « Possédé », « Liste d'achat » et « Ni possédé, ni sur la liste d'achat » n'apparaissent plus.
- Avec `.dev.vars` qui contient `ACCESS_LOCAL_EXEMPT=dev-only`, `curl -i http://localhost:5173/api/health` pendant `npm run dev` renvoie `200` et `{"ok":true}`. Sans ce fichier, la même adresse répond `401`.
- `phare` laisse « La brume du phare », avec « j’ai » et « j’ai lu ». `memoires` trouve « Mémoires d'un cartographe distrait ». `zzzz` affiche « Aucun livre » et une phrase qui dit qu'aucun livre ne correspond.
- Un titre ou un auteur vide est refusé. Ajouter un livre avec **J’ai lu** et sans cocher « j’ai » affiche seulement « j’ai lu ». Ajouter avec « j’ai » sans cette case n'affiche pas « j’ai lu ». Les deux ensemble affichent les deux. Le livre reste après rechargement.
- Les boutons **Tous**, **Lu**, **Je veux** et **J’ai** montrent des totaux qui ne changent pas quand on cherche. **Lu** puis une recherche ne garde que les livres terminés qui correspondent.
- Une couverture JPEG, PNG ou WebP d'au plus 2 Mo s'affiche sur la carte et après rechargement. Un SVG, une page HTML, ou une image trop lourde est refusé. Le livre sans image garde « Pas de couverture ».
- `npm test`, `npm run typecheck` et `npm run build` se terminent sans erreur.

## Préparer l'accès

Ce dépôt ne met rien en ligne et ne crée pas d'application Access. Le code sait seulement refuser les adresses `/api/...` quand la protection n'est pas encore réglée, ou quand le jeton n'est pas valable.

Cloudflare Access, plus tard, montrera une page de connexion et ajoutera un jeton signé dans l'en-tête `Cf-Access-Jwt-Assertion`. Le Worker vérifie la signature avec les clés publiques du domaine d'équipe, puis l'émetteur, l'audience et la date. Il ne lit pas l'en-tête qui annonce seulement un e-mail. Un cookie `CF_Authorization` est accepté seulement après la même vérification. Une modification venue d'un autre site est refusée. Les livres, les fiches et les couvertures ne sont lus qu'après ça.

`ctx.access`, le raccourci documenté par Cloudflare, ne traverse pas le routeur des fichiers statiques. Cette application en a un, à cause de Vite. Le Worker valide donc le jeton lui-même, avec la bibliothèque `jose`. Le bloc `access.dev` de Wrangler ne peut pas ouvrir l'application locale : il ne remplit que `ctx.access`.

Dans `wrangler.jsonc`, `TEAM_DOMAIN` et `POLICY_AUD` sont vides. C'est voulu : sans ces deux valeurs exactes, l'API répond que l'accès n'est pas configuré. Le nom d'hôte `localhost` ne change rien. `ACCESS_LOCAL_EXEMPT` est vide dans la configuration déployable. Pour travailler sur cette machine, un fichier `.dev.vars` ignoré par Git peut contenir seulement :

```bash
printf 'ACCESS_LOCAL_EXEMPT=dev-only\n' > .dev.vars
```

Wrangler l'utilise pour `npm run dev` et `npm run preview`, et ne l'envoie pas lors d'un déploiement. Cette exemption ne s'applique pas si `TEAM_DOMAIN` ou `POLICY_AUD` est rempli. Une valeur vide, ou l'absence de la ligne, ne donne aucun accès : seule la valeur exacte `dev-only` ouvre le mode local. On peut donc laisser `ACCESS_LOCAL_EXEMPT` vide, ou retirer l'entrée. Il ne faut jamais mettre `dev-only` dans un secret ou une variable du nuage : le Worker ne peut pas distinguer ce secret d'un fichier local, parce que l'exécution locale reçoit aussi un objet `cf`.

Aucune migration. Aucune commande `wrangler deploy`, `wrangler login` ou Access.

Les outils MCP sont `ping` et `search_books`. La recherche est en lecture seule. Le guide est dans `docs/mcp.md`.

## Secrets

Ce dépôt ne contient aucun jeton, mot de passe ni fichier `.dev.vars`. Le nom `books-v2` dans `wrangler.jsonc` est seulement le nom du Worker. Le bloc `observability` prépare des journaux pour une future mise en ligne. En local, rien n'est envoyé.

## Exercice

Crée `.dev.vars` comme indiqué plus haut, puis `npm run dev`. Ajoute un livre avec une image : la carte la montre. Sans ce fichier, et sans les futurs réglages Access, `/api/books` répond que l'accès n'est pas configuré. Rien n'est encore protégé par une vraie connexion Cloudflare.

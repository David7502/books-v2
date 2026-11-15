# MCP : ping, recherche et ajout

L'adresse `/mcp` est sur le même Worker que le site. Trois outils :

- `ping` répond `pong`. Il ne lit rien.
- `search_books` cherche des livres dans D1. Il ne fait que des `SELECT`. Il n'écrit rien, et il ne lit pas les couvertures. Il est marqué en lecture seule.
- `add_book` ajoute un livre. Il réutilise la même validation et le même `INSERT` que le formulaire du site. Il n'écrit pas de couverture.

Le site humain ne change pas. Son audience Access reste `POLICY_AUD`. Le ping a une audience à part, `MCP_POLICY_AUD`, et un nom d'hôte à part, `MCP_HOSTNAME`.

## Ce qui est vérifié

Cloudflare Access, devant le nom d'hôte MCP, reçoit `CF-Access-Client-Id` et `CF-Access-Client-Secret`. Il signe ensuite un jeton `Cf-Access-Jwt-Assertion`. Le Worker ne croit pas les en-têtes d'identifiant ou d'e-mail tout seuls. Il vérifie la signature, l'émetteur, l'audience MCP, la date, puis les champs documentés d'un jeton de service : `type` vaut `app`, `sub` est vide, et `common_name` est exactement l'identifiant client autorisé.

La documentation Access appelle ce champ le Client ID du jeton de service. Un essai réel chez Cloudflare reste nécessaire pour confirmer que la valeur reçue est bien celle affichée à côté de `CF-Access-Client-Id`. Si elle diffère, le ping répondra « accès refusé ». Il n'y a pas de porte dérobée.

Un navigateur qui envoie `Origin` est refusé. Un client serveur, qui n'envoie pas `Origin`, peut continuer. `ACCESS_LOCAL_EXEMPT` n'ouvre pas `/mcp`.

Sans `MCP_HOSTNAME`, `MCP_POLICY_AUD` et `MCP_SERVICE_CLIENT_ID`, ou sans `TEAM_DOMAIN` valide, `/mcp` reste fermé.

## Ajouter la configuration sans effacer la tienne

Dans ton `wrangler.jsonc` local, garde `TEAM_DOMAIN` et `POLICY_AUD` tels qu'ils fonctionnent déjà. Ajoute seulement ces lignes dans `vars`, vides pour l'instant :

```jsonc
"MCP_HOSTNAME": "",
"MCP_POLICY_AUD": "",
"MCP_SERVICE_CLIENT_ID": ""
```

Dans `assets.run_worker_first`, garde `/api/*` et ajoute `/mcp` :

```jsonc
"run_worker_first": ["/api/*", "/mcp"]
```

Ne mets jamais le Client Secret dans ce fichier, dans Git, ni dans une conversation. `MCP_SERVICE_CLIENT_ID` est l'identifiant public du jeton, pas le secret. `ACCESS_LOCAL_EXEMPT` vide ne donne aucun accès. La valeur `dev-only` ne doit jamais aller dans le nuage.

## Chercher des livres

`search_books` accepte quatre arguments, tous facultatifs :

- `query` : un texte, au plus 200 caractères, comparé au titre, à l'auteur et à la collection sans tenir compte des majuscules. La table n'a pas d'ISBN. Les signes `%` et `_` sont cherchés comme des lettres, pas comme des jokers.
- `status` : `all`, `owned` (j'ai), `read` (j'ai lu) ou `wishlist` (je veux).
- `category` : `novel` (Roman), `essay` (Essai), `comic` (Bande dessinée), `philosophy` (Philosophie) ou `other` (Autre). Sans cet argument, toutes les catégories restent.
- `limit` : de 1 à 50. Sans limite, 20 livres au plus sont listés. Le total indiqué compte tous ceux qui correspondent.

La réponse a un texte lisible et le même résultat en données structurées : identifiant, titre, auteur, possession, catégorie, collection, lecture, dates et note. Une catégorie vide ou une collection vide vaut `null`. L'outil ne fait toujours que des `SELECT` avec des paramètres.

## Ajouter un livre

`add_book` écrit dans la même table que le site. Aucune nouvelle migration : les colonnes existent déjà.

- `title` et `author` sont obligatoires, au plus 200 caractères. Les espaces autour sont enlevés.
- `ownership` : `owned` (j'ai), `wishlist` (je veux) ou `none`. Sans cet argument, c'est `none`.
- `read` : `true` crée la fiche Terminé, comme la case **J’ai lu**. Sans cet argument, le livre n'a pas de fiche.
- `category` : `novel`, `essay`, `comic`, `philosophy` ou `other`.
- `collection` : texte libre, au plus 80 caractères. Un texte vide reste vide.

Une autre valeur est refusée et rien n'est écrit. Si un livre a déjà le même titre et le même auteur, sans tenir compte des majuscules ni des accents, `add_book` ne crée pas de deuxième ligne. Il renvoie le livre déjà là, avec un texte qui dit que rien n'a été ajouté. Il n'y a pas de drapeau pour forcer un doublon.

La réponse structurée contient `created` (`true` ou `false`) et `book` : identifiant, titre, auteur, possession, catégorie, collection, et `read`. Le texte français reprend la même chose. Les requêtes restent paramétrées. Le seau des couvertures n'est pas touché.

Le même jeton de service que `ping` et `search_books` est exigé. `add_book` est annoncé comme un outil qui écrit, qui n'efface rien, et qui n'est pas idempotent.

## Essai local, sans secret

```powershell
npm test
```

Ce test signe des jetons de laboratoire. Il joue l'échange MCP `initialize`, `tools/list` et `tools/call` pour `ping`, `search_books` et `add_book`. Il refuse un jeton absent, forgé, expiré, d'un mauvais émetteur, d'une mauvaise audience, d'une autre identité, un en-tête d'identifiant sans jeton, un navigateur, et un mauvais nom d'hôte. La recherche est essayée sur une base en mémoire : aucun `INSERT` ni accès R2. L'ajout est essayé à part : un livre valide est inséré, une valeur refusée n'écrit rien, un doublon ne crée pas une deuxième ligne, et l'appel sans jeton est refusé avant la base.

Pour appeler le serveur déjà en ligne, le secret reste dans des variables, pas dans le fichier ni dans le chat.

```powershell
@'
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_books","arguments":{"query":"brume","status":"read","limit":5}}}
'@ | Set-Content -Encoding utf8 search.json

curl.exe -s "https://mcp.davidguillo.fr/mcp" `
  -H "Content-Type: application/json" `
  -H "Accept: application/json, text/event-stream" `
  -H "CF-Access-Client-Id: $env:MCP_CLIENT_ID" `
  -H "CF-Access-Client-Secret: $env:MCP_CLIENT_SECRET" `
  --data-binary "@search.json"
```

Le même modèle sert pour `ping` : dans le JSON, `"name":"ping"` et `"arguments":{}`. Pour ajouter un livre, `"name":"add_book"` et, par exemple, `"arguments":{"title":"Lucky Luke","author":"Morris","ownership":"owned","category":"comic","collection":"Lucky Luke"}`.

## Après fusion

Le nom d'hôte MCP, l'audience et l'identifiant client sont déjà en place. Cette étape ne change pas `wrangler.jsonc` et n'ajoute pas de migration. Fusionner dans `main` publie le Worker par Workers Builds. `add_book` écrit alors dans la base de production, avec le même jeton de service que la recherche. Il ne faut pas fusionner tant que cet ajout n'est pas voulu. Si Workers Builds n'a pas publié, les commandes habituelles restent :

```powershell
$env:CLOUDFLARE_ENV = "production"
npm run build
npx wrangler deploy
Remove-Item Env:CLOUDFLARE_ENV
```

Ne remplace pas `TEAM_DOMAIN`, `POLICY_AUD`, ni les trois variables MCP. Le Client Secret reste dans Grok, pas dans Git, pas dans le chat, et pas dans un cookie de connexion humaine. `dev-only` ne va jamais dans le nuage.

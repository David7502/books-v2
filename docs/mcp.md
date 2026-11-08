# Premier pas MCP : un ping

Cette étape ajoute une adresse `/mcp` sur le même Worker que le site. Elle ne lit ni n'écrit aucun livre. L'outil s'appelle `ping` et répond `pong`.

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

## Essai local, sans secret

```powershell
npm test
```

Ce test signe des jetons de laboratoire. Il joue l'échange MCP `initialize`, `tools/list` et `tools/call`. Il refuse un jeton absent, forgé, expiré, d'un mauvais émetteur, d'une mauvaise audience, d'une autre identité, un en-tête d'identifiant sans jeton, un navigateur, et un mauvais nom d'hôte. Il vérifie aussi que la base et R2 ne sont pas touchés.

## Plus tard, un essai cloud séparé

Pas maintenant, et pas sur le site que les gens ouvrent dans le navigateur.

1. Choisis un nom d'hôte réservé au MCP, par exemple `mcp.<ton-domaine>`.
2. Crée une application Access distincte, en Service Auth, pour ce nom d'hôte seulement.
3. Autorise un seul jeton de service. Copie son Client ID dans `MCP_SERVICE_CLIENT_ID`, et l'audience de cette application dans `MCP_POLICY_AUD`.
4. Mets le nom d'hôte dans `MCP_HOSTNAME`.
5. Garde le Client Secret dans le client qui appellera le serveur, pas dans le dépôt.

Ce dépôt n'a pas été connecté à Grok. Cette étape ne prouve pas encore le trajet complet jusqu'au bot.

Les secrets ne vont ni dans Git, ni dans le chat, ni dans un cookie d'une connexion humaine.


# Midnight Obsidian & Glassmorphic Zinc — Design System v1

  

> Brief canonique. À coller intégralement au démarrage de chaque nouvelle application.

> Règle d'or : ce document fixe des DÉCISIONS, pas des intentions. Aucune valeur n'est un exemple — tout est littéral.

> Référence vivante : STIGMERGIE (console de supervision).

  

---

  

## 0. Stack & principes

  

- React + Tailwind CSS (ou styles inline équivalents). Animations : motion/react ou CSS keyframes simples.

- Dashboard sombre premium, minimaliste, géométriquement net.

- Le design repose sur 3 choses uniquement : contrastes de texte, vide (negative space), bordures fines. Jamais sur des effets.

  

## 1. Interdits absolus (à vérifier avant livraison)

  

- ❌ Aucune forme colorée floue en arrière-plan (`blur-xl`, `blur-2xl`, halos radiaux, "ambiance").

- ❌ Aucun dégradé décoratif. Les accents de couleur ne s'étalent JAMAIS sur un fond.

- ❌ Pas de navigation en sidebar. La nav vit en haut ; la sidebar sert exclusivement aux filtres ou à une arborescence.

- ❌ Pas d'emoji dans l'UI (icônes typographiques sobres autorisées : ✕ ✎ ⚙ ▲ ▼ ‹ › « »).

- ❌ Pas d'ombre portée colorée ; ombres neutres discrètes uniquement si indispensable.

  

## 2. Couleurs (valeurs exactes)

  

### Fonds

| Usage | Valeur |

|---|---|

| Fond de page | `#09090b` (zinc-950) |

| Surface modale / panneau plein | `#0c0c0e` |

| Carte / panneau glassy | `rgba(24,24,27,0.5)` + `backdrop-filter: blur(12px)` |

| Bandeau d'en-tête de carte | `rgba(24,24,27,0.75)` |

| Input / bouton secondaire | `#09090b` |

| Barre fixe (nav, pagination) | `rgba(9,9,11,0.9)` + `backdrop-filter: blur(12px)` |

| Bloc code | `#0c0c0e` |

  

### Bordures

| Usage | Valeur |

|---|---|

| Standard (cartes, inputs, boutons) | `1px solid rgba(39,39,42,0.8)` ou `#27272a` |

| Séparateur de lignes de table | `1px solid rgba(39,39,42,0.35)` |

| Hover | `#3f3f46` |

| Focus input | `#52525b` (jamais de ring coloré) |

  

### Texte

| Usage | Valeur |

|---|---|

| Titres, valeurs importantes | `#fafafa` / `#f4f4f5` |

| Texte courant, valeurs secondaires | `#a1a1aa` |

| Métadonnées, labels de colonnes | `#71717a` |

| Métadonnées discrètes, placeholders | `#52525b` |

| Désactivé | `#3f3f46` |

  

### Accents sémantiques (confinés aux petits éléments : pastilles, badges, barres, texte)

| Sémantique | Texte / icône | Fond de badge |

|---|---|---|

| Succès / actif | `#34d399` | `rgba(16,185,129,0.1)` |

| Info / neutre | `#818cf8` | `rgba(99,102,241,0.1)` |

| Erreur / danger | `#fb7185` | `rgba(244,63,94,0.1)` |

| Attention / attente | `#fbbf24` | `rgba(245,158,11,0.1)` |

| Neutre gris | `#a1a1aa` | `rgba(113,113,122,0.12)` |

  

### Palette d'accents pour catégories dynamiques (groupes, canaux, tags)

`#818cf8 · #34d399 · #fbbf24 · #fb7185 · #22d3ee · #c084fc · #f472b6 · #a3e635 · #fb923c · #a1a1aa`

Fond associé : la même couleur à 10–12 % d'alpha.

  

## 3. Typographie

  

- **Sans-serif : Inter** (Google Fonts, poids 400 / 500 / 600 / 700). Tout le texte général.

- **Mono : JetBrains Mono** (400 / 500 / 600). OBLIGATOIRE pour : chiffres, compteurs, pourcentages, prix, timestamps, ids, routes/URL, code, unités techniques.

- `-webkit-font-smoothing: antialiased` sur le root.

  

### Échelle (px)

| Rôle | Taille / graisse |

|---|---|

| Titre de page / modale | 17–22 / 700, letter-spacing -0.01em |

| Titre de carte, nom d'entité | 13–14.5 / 600 |

| Corps | 13–13.5 / 400, line-height 1.6–1.7 |

| UI dense (tables, boutons) | 12–12.5 / 500 |

| Métadonnées mono | 11–11.5 / 400 |

| Label de colonne / section | 10–10.5 / 600, UPPERCASE, letter-spacing 0.08–0.09em |

| Wordmark / logo | 14 / 700, letter-spacing 0.22em, UPPERCASE |

  

## 4. Espacement & formes

  

- Échelle d'espacement : **4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 px**. Toujours `flex`/`grid` + `gap`, jamais de marges entre siblings.

- Rayons : **8px** (petits contrôles) · **10px** (boutons, inputs) · **12px** (blocs internes) · **16px** (cartes) · **20–24px** (modales) · **99px** (badges, pastilles).

- Hauteur nav : 58px. Sidebar filtres : 248px. Slide-over détail : 448px. Modale : 560–780px.

- Padding cellule de table : 11px 14px. Padding carte : 16–18px.

  

## 5. Recettes de composants (littérales)

  

### Bouton primaire

`background:#fafafa; color:#09090b; font-weight:600; font-size:13px; padding:8px 15px; border-radius:10px; border:none; hover:background:#e4e4e7`

Un seul par zone d'action. Libellé verbal : « + Nouveau worker », « Enregistrer ».

  

### Bouton secondaire

`background:#09090b; color:#a1a1aa; border:1px solid #27272a; padding:8px 13px; border-radius:10px; hover: color:#f4f4f5 + border:#3f3f46`

  

### Bouton danger

`color:#fb7185; background:rgba(244,63,94,0.1); border:none; hover:background:rgba(244,63,94,0.16–0.2)`

Destruction = toujours une confirmation (inline ou dialog) qui explique la conséquence.

  

### Input / select / textarea

`background:#09090b; border:1px solid #27272a; border-radius:10px; padding:9–10px 12px; font-size:12.5–13px; color:#f4f4f5; placeholder:#52525b; focus:border-color:#52525b (pas de ring)`

Label au-dessus : 11.5px / 600 / `#a1a1aa`. Champ requis : astérisque `#fb7185`.

  

### Badge de statut

Pastille 6–7px ronde + texte 11px/600, `padding:3px 9–10px; border-radius:99px`, couleur sémantique sur fond alpha-10.

État "vivant" : la pastille pulse (`pulse 2.4s ease-in-out infinite`, opacity 1→0.3).

  

### Chip sélectionnable (multi-select)

`padding:5px 11px; border-radius:99px; font-size:12px`

Off : `color:#71717a; background:#09090b; border:#27272a` — On : `color:#f4f4f5; background:rgba(63,63,70,0.55); border:rgba(113,113,122,0.7)`

  

### Onglet de navigation (nav du haut, centrée)

Conteneur segmenté : `padding:4px; border-radius:13px; border:rgba(39,39,42,0.8); background:rgba(24,24,27,0.5)`.

Onglet actif : `color:#fafafa; background:rgba(39,39,42,0.55); border:rgba(63,63,70,0.8); border-radius:10px` — inactif : `color:#a1a1aa`, transparent.

  

### Carte

`background:rgba(24,24,27,0.5); backdrop-filter:blur(12px); border:1px solid rgba(39,39,42,0.8); border-radius:16px; padding:16–18px; hover(cliquable):border-color:rgba(63,63,70,0.9)`

  

### Table groupée

Chaque groupe = sa propre carte. Bandeau : barre verticale 3×16px de la couleur du groupe + titre 12px/700 uppercase + compteurs mono 11px `#71717a`.

En-têtes de colonnes répétés par carte : 10px/600 uppercase `#52525b`. Lignes : grid à colonnes fixes, séparateur `rgba(39,39,42,0.35)`, hover `rgba(39,39,42,0.35)`.

Colonnes d'action en fin : boutons icône 26–28px, radius 8px.

  

### Modale

Overlay `rgba(0,0,0,0.65)` + fadein 150ms. Boîte : `#0c0c0e; border:rgba(39,39,42,0.9); border-radius:20–24px`, animation popin 180ms (translateY 10px + scale 0.98 → 1).

Structure : header (titre 17/700 + sous-titre 11.5 `#71717a` + ✕) · body scrollable · footer avec actions (primaire à droite).

  

### Slide-over (panneau détail)

Fixe à droite, 448px, `#0c0c0e`, `border-left:rgba(39,39,42,0.9)`, slidein 200ms (translateX 28px). Sections titrées en labels uppercase 10.5px ; paires clé/valeur en mono 11.5px (clé `#52525b`, valeur `#d4d4d8`).

  

### Pagination (bande fixe en bas)

`border-top + background:rgba(9,9,11,0.9) + blur`. Centre : « Affichage de X à Y sur Z ». Droite : « Par page : [select] » + « ‹ Page N / M › » (flèches désactivées : `#3f3f46`, cursor default).

  

### Barre de présence / uptime

Pings à HAUTEUR FIXE (jamais d'intensité) : gris `#27272a` = absence, vert `#34d399` = ok, rouge `#fb7185` = erreur. Largeur 2.5px, gap 2px, radius 1px.

  

### État vide / onboarding

Badge de contexte mono + titre 26/700 + paragraphe `#a1a1aa` + 2–3 étapes numérotées en cartes (cercle numéroté 26px, fond accent alpha-10) ; l'étape 1 contient le CTA primaire.

  

### Bloc code

`background:#0c0c0e; border:rgba(39,39,42,0.8); border-radius:10–12px; padding:11–14px; font:JetBrains Mono 11–11.5px; color:#d4d4d8; line-height:1.6`

  

## 6. Layout

  

- **Nav horizontale en haut, centrée** (grille 1fr auto 1fr : wordmark / nav segmentée / statut+horloge). Jamais de nav latérale.

- **Sidebar gauche = filtres uniquement** (recherche + sections de filtres avec compteurs mono à droite de chaque option) ou arborescence de contenu.

- Détail d'une entité → slide-over droite. Création/édition → modale à onglets (onglets soulignés 2px blanc).

- Chaque page a une vraie URL (routing), filtres et pagination inclus dans l'URL (`?statut=actif&p=2`).

- Scrollbar custom : 9px, thumb `#27272a` radius 6px, track transparent.

  

## 7. Motion

  

- Transitions : 150–200ms ease. Entrées de modale/panneau : fadein 150ms, popin 180ms, slidein 200ms.

- Pulse (2.4s) réservé aux indicateurs "vivant/en ligne".

- Aucun parallax, aucun scroll-trigger décoratif, aucune animation d'ambiance.

  

## 8. Ton & copywriting

  

- Français, sobre, technique, sans point d'exclamation. Minuscules pour les métadonnées (« il y a 6 min », « à l'instant »).

- Les actions disent ce qu'elles font : « Envoyer via ingest », « Supprimer en cascade », « Déclarer mon premier worker ».

- Les confirmations destructives expliquent la conséquence exacte (« leur chaînage sera cassé »).

- Compteurs et unités toujours en mono : « 12 448 », « 184 ms », « 62 % », « J-30 ».
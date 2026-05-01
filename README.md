# Better Crafting

Better Crafting is a Wayward mod that replaces the default crafting prompt with a more precise crafting, bulk crafting, and dismantling workflow.

It is built for players who want exact control over which items are used, safer bulk actions, and faster navigation through large inventories.

Steam Workshop: https://steamcommunity.com/sharedfiles/filedetails/?id=3701391059

## Features

- Exact material selection for normal crafting, including consumed items, base items, tools, and used requirements.
- Smart auto-fill that selects the best available ingredients when the dialog opens.
- Filtering and smart sorting for long item lists, including Best for Crafting, quality, name, weight, durability, decay, worth, and more.
- Crafting, bulk crafting, and dismantling default to Best for Crafting so useful candidates appear first.
- Bulk crafting with quantity controls, exclusion-based material selection, and pinned tool/used selections.
- Precise and bulk dismantling support, including target selection and required-item handling.
- Protected item handling so protected inventory items stay out of bulk batches.
- Durability safeguards for tools used during bulk crafting and dismantling.
- Safety stops for bulk actions when health changes, damage is taken, movement occurs, or the menu is closed.
- Hotkey inspect details for durability, weight, groupings, and action tier levels.
- Pre-craft and dismantle info cards for checking results before committing resources.
- Multiplayer compatible when installed on both the server and all clients.

## Installation

Subscribe on the Steam Workshop page, then enable the mod in Wayward.

For multiplayer, Better Crafting must be installed on both the server and every connecting client.

## Development

Install dependencies:

```powershell
npm install
```

Run the regression suite:

```powershell
npm test
```

Build the mod:

```powershell
npm run build
```

Deploy the built files to the local Wayward mods directory:

```powershell
npm run deploy
```

## Compatibility

- Wayward version: `2.15.3-beta`
- Multiplayer: compatible with matching server and client installs

## Credits

Built by Kyle HB.

Thanks to Chiri and Drathy for advice and assistance.

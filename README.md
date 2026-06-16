
# Obsidian Style Manager

> **Style Manager** is an extension and fork of the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin originally created by [mgmeyers](https://github.com/mgmeyers).

This plugin allows Obsidian snippet, theme, and plugin CSS files to define configurable options, offering users a central settings pane to tweak these variables. It supports toggling HTML body classes, numeric sliders, text inputs, color pickers, and more.

> [!CAUTION]
> **Do not enable Style Manager and Style Settings at the same time.**
> Because Style Manager is a fork of the Style Settings plugin, both plugins rely on the exact same `/* @settings` configuration system. If run simultaneously, they will compete to manage your CSS variables, which can lead to layout conflicts. To ensure a stable experience, please **disable the original Style Settings plugin** before enabling Style Manager.

---

- [Installation](#installation)
	- [1. Via BRAT (Beta Reviewer's Auto-update Tool)](#1-via-brat-beta-reviewers-auto-update-tool)
	- [2. Manual Installation](#2-manual-installation)
	- [3. Community Plugin Store](#3-community-plugin-store)
- [Core Logic: Shared Mode vs. Isolate Mode](#core-logic-shared-mode-vs-isolate-mode)
	- [Shared Mode (Default)](#shared-mode-default)
	- [Isolate Mode](#isolate-mode)
- [Style Manager Interface Overview](#style-manager-interface-overview)
	- [1. Styles Tab](#1-styles-tab)
	- [2. Snippets Tab](#2-snippets-tab)
	- [3. Themes (Theme Builder) Tab](#3-themes-theme-builder-tab)
	- [4. Presets Tab](#4-presets-tab)
	- [5. Isolate Tab](#5-isolate-tab)
	- [6. Preferences Tab](#6-preferences-tab)
- [Global Toolbar & Status Badges](#global-toolbar--status-badges)
	- [Instant Access Header Controls](#instant-access-header-controls)
		- [Vertical Ellipsis (`…`) Actions:](#vertical-ellipsis--actions)
	- [Status Badges Reference](#status-badges-reference)
- [Integrated CSS Code Editor Modal](#integrated-css-code-editor-modal)
	- [Key Features](#key-features)
	- [The Evolution of Style Settings Management](#the-evolution-of-style-settings-management)
		- [Smart Insertion Logic Reference](#smart-insertion-logic-reference)
- [CSS Snippet Metadata Block (`@metadata`)](#css-snippet-metadata-block-metadata)
	- [Adding a Metadata Block](#adding-a-metadata-block)
		- [Method A: Automatic Injection (Recommended)](#method-a-automatic-injection-recommended)
		- [Method B: Manual Writing](#method-b-manual-writing)
	- [Supported Metadata Fields](#supported-metadata-fields)
- [Style Settings Block (`@settings`)](#style-settings-block-settings)
	- [What is a Setting Component?](#what-is-a-setting-component)
	- [Basic Structure Example](#basic-structure-example)
	- [Setting Types Overview](#setting-types-overview)
	- [Global Parameters](#global-parameters)
	- [Detailed Setting Examples](#detailed-setting-examples)
		- [1. `heading`](#1-heading)
		- [2. `info-text`](#2-info-text)
		- [3. `class-toggle`](#3-class-toggle)
		- [4. `class-select`](#4-class-select)
		- [5. `variable-text`](#5-variable-text)
		- [6. `variable-number`](#6-variable-number)
		- [7. `variable-number-slider`](#7-variable-number-slider)
		- [8. `variable-select`](#8-variable-select)
		- [9. `variable-color`](#9-variable-color)
		- [10. `variable-themed-color`](#10-variable-themed-color)
		- [11. `color-gradient`](#11-color-gradient)
	- [Color Variable Formatting Options](#color-variable-formatting-options)
	- [Localization Support](#localization-support)
		- [Supported Language Postfix Codes:](#supported-language-postfix-codes)
- [Developer and Testing Utilities](#developer-and-testing-utilities)
- [Transparency](#transparency)

---

## Installation

### 1. Via BRAT (Beta Reviewer's Auto-update Tool)

This is the recommended method to receive updates directly.

1. Install the **[BRAT](https://github.com/TfTHacker/obsidian42-brat)** plugin from the Obsidian Community Plugins store.
2. Enable BRAT in your Obsidian settings.
3. Click **"Add Beta plugin"** within the BRAT settings panel.
4. Paste the GitHub URL of this repository.
5. Click **"Add Plugin"**.

### 2. Manual Installation

Use this method if you prefer to install files directly without third-party tools.

1. Go to the **Releases** page of this GitHub repository.
2. Download the following three files:
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. In your Obsidian vault, navigate to `.obsidian/plugins/` (note that this folder is hidden by default on some operating systems).
4. Create a new folder named `obsidian-style-manager`.
5. Move the downloaded files into that folder.
6. Restart Obsidian or navigate to **Settings** > **Community Plugins** and toggle the plugin **On**.

### 3. Community Plugin Store

> *Coming Soon.*

---

## Core Logic: Shared Mode vs. Isolate Mode

Managing your vault's look across multiple devices (such as a large monitor and a mobile phone) can introduce layout conflicts. Style Manager resolves this by offering two storage modes to control how your styles are synced.

### Shared Mode (Default)

> *Best for: Maintaining a consistent global styles across all devices in shared vault.*

When you modify styles in Shared Mode, the configurations are synced across your vault.
- **The Memory (`data.json`):** First, it records your configurations in `data.json`. Think of this as the plugin's **Master Ledger**. It’s a private notebook where Style Manager keeps a detailed record of every preference you've set.
- **The Effect (`appearance.json`):** The plugin writes the values directly to Obsidian's default config file, `appearance.json`. Your sync service (Obsidian Sync, iCloud, Git, etc.) recognizes this change and distributes it to your other devices.

### Isolate Mode

> *Best for: Customizing layouts for specific screens (e.g., larger fonts on mobile) or local style testing.*

Isolate Mode is your "Creative Sandbox." Isolate Mode creates a private local environment that **never** writes to the shared `appearance.json` file, protecting other devices from unexpected style changes.
- **The Visual Overlay:** The plugin applies style changes as a live visual layer directly inside your current Obsidian client.
- **Device Locker:** The plugin creates a device locker for your device. Each device you use (your Mac, your Android phone, your iPad) is given a unique ID. The plugin creates a dedicated "locker" for that ID within `data.json`.
- **Sync Behavior:** Because the changes exist only within your local device's locker inside `data.json`, other devices running in Isolate Mode will ignore them and run their own isolated configurations. When you're on your phone, the plugin looks into `data.json`, finds the bucket labeled **"Phone,"** and loads your **Isolate Locker** from there. When you move to your desktop, it finds the locker labeled **"Desktop"** and loads a completely different set of styles.

---

## Style Manager Interface Overview

Style Manager interface is structured into six functional tabs.

### 1. Styles Tab

*The primary workspace for Styles customization.*
- **Unified Style Control:** Renders settings (parsed from theme and snippet CSS files) into interactive toggles, sliders, and color pickers.
- **Modified-Only Filter:** A quick switch to hide unchanged settings and view only the settings you have specifically changed.
- **Navigation:** Search bar for instant filtering and a "Collapse/Expand All" toggle to manage large sets of style settings.

### 2. Snippets Tab

*Manage Obsidian's native CSS snippets from a centralized list.*
- **Snippet Control:** Search, select, and toggle native CSS snippets through a unified list.
- **Vault Integration:** Quick-access buttons to open your system's file explorer directly to your vault's snippets folder.
- **Bulk Selection:** Choose multiple snippets simultaneously for coordinated actions.

### 3. Themes (Theme Builder) Tab

*Tools for switching, and building custom themes.*
- **Theme Manifest Creation:** Create new custom themes by defining their metadata (Name, Author, etc.) via a dedicated manifest modal.
- **Advanced Filter Search:** Filter themes using specialized search attributes:
    - `@author [name]` – Find themes made by a specific creator.
    - `@name [name]` – Find themes matching a specific title.
- **Folder Shortcut:** One-click button to open your local `.obsidian/themes` directory.

### 4. Presets Tab

*Capture, restore, and schedule snapshots of your entire workspace design.*
- **Visual State Snapshots:** Save your active Theme, active CSS Snippets, Style Settings, and Accent Colors into a unified "Preset".
- **Intelligent Search:** Filter your preset library using tags:
    - `@theme`, `@snippet`, and `@name` to match preset contents.
    - `@light` and `@dark` to filter by appearance mode.
- **Export Bundles:** Export presets as JSON or as a **ZIP bundle** that includes the actual CSS files (themes/snippets) required for the preset to work.
- **Multi-Target Application:** Apply presets to three different targets:
    - **Shared:** Updates the shared configuration for all synced devices.
    - **Isolate:** Applies changes only to the current device's local locker.
    - **Remote:** Pushes a preset to a specific remote device's locker.
- **Scheduling Automation:** Access the Active Schedules modal to set presets to trigger automatically at specific times (e.g., switching to a dark, high-contrast style at 6:00 PM).

### 5. Isolate Tab

*Manage device-specific profiles.*
- **Isolate Mode Toggle:** Enable a private "Locker" for the current device. When active, local adjustments to styles, themes, and snippets are isolated and will not overwrite the shared configuration.
- **Locker Identity Management:**
    - **Custom Naming:** Give your device a friendly name (e.g., "Office Mac").
    - **Identity Control:** View, copy, or regenerate the unique Device ID.
- **Remote Directory Management:**
    - **Device List**: View a list of all other devices sharing the vault.
    - **Locker Preview:** Open a detailed preview of the isolated settings (Theme, Appearance, Snippets) active on any remote device.
    - **Remote Maintenance:** Rename or delete lockers for other devices.

### 6. Preferences Tab

*Plugin configuration, safety tools, and developer options. Includes a search filter to quickly find specific settings.*

- **UI Customization:** Toggle sticky headings in the Styles tab, customize date formats for presets, and control status bar visibility.
- **Confirmations:**
    - **Skip Toggles**: Quickly delete, export, or import presets and styles by bypassing confirmation dialogs.
    - **Apply Actions**: Define how the plugin handles preset application (Ask, Overwrite, or Merge) for single, bulk, or scheduled actions.
- **Backup & Recovery:**
    - **Full Backup**: Create a full ZIP backup containing plugin preferences, presets, snippets, and themes.
    - **Basic Backup**: Generates a quick JSON file containing your style settings, presets, and plugin configurations.
    - **Safety Rollback**: Instantly restore the plugin state from the automatically generated `data.json.bak` snapshot.
- **Export Customization:** Change default export folders, file extension naming preferences (e.g., `.json`, `.md`, `.txt`), and timestamp layouts.
- **CSS Editor:**
    - **Indentation Control:** Customize the indentation of `@settings` blocks to match your preferred coding style.
    - **External Editor:** Option to open CSS files in your system's default text editor instead of the plugin's integrated CSS editor.
    - **Editor Tuning:** Adjust the tab size for the CSS editor.
- **Developer Options:**
	- **Notification Toggles**: Control alerts for shared changes, preset actions, isolated configurations, snippet management, and general UI feedback.
	- **Debug Logging**: Toggle comprehensive console logging for troubleshooting.
	- **Shared Version**: View the internal version timestamp used to synchronize state across devices.

---

## Global Toolbar & Status Badges

### Instant Access Header Controls

The persistent toolbar header provides system actions across all tabs:
- **Accent Color Selector:** Opens a color picker to update your theme's primary accent color.
- **Appearance Toggle:** Swap between light and dark modes.
- **Theme Selector:** Quick-switch menu to change the active Obsidian theme.
- **Isolate Mode Badge:** A interactive clickable-icon showing if you are in **Shared mode** or **Isolate mode**.
- **Refresh Button:** Forces the plugin to reload configurations from the `data.json.

#### More Actions Menu (Vertical Ellipsis)

- **Preset Management:** Quickly `Create new preset…` or `Import preset…`. Completing these actions automatically switches the view to the **Presets** tab.
- **Snippet Management:** `Create new snippet…` generates a new CSS file. Based on your preferences, it opens in the internal editor or your system's default text editor, then switches the view to the **Snippets** tab.
- **State Reset:** `Reset styles` opens the **Reset Settings Modal**, allowing you to select specific style sections to clear and return to their default theme values.

### Status Badges Reference

The Style Manager displays a system of badges to provide quick visual cues and access to configuration details. These are categorized into two types: **interactive badges**, which trigger actions or open menus when clicked, and **info badges**, which serve as read-only indicators for status and metadata.

|     | Badge                  | Type        | Description                                                                                                                      |
| --- | ---------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A   | `style settings count` | interactive | Number of settings configured in a style, preset, or device locker. In **Styles tab**, click to show per section configurations. |
| B   | `style status`         | info        | Shows if the specific style settings is currently active                                                                         |
| C   | `style source`         | interactive | Indicates where the style originates (Plugin, Theme, or Snippet). Click to open CSS editor modal.                                |
| D   | `active theme`         | interactive | Displays the name of the currently active Obsidian theme. Click to copy the preset or device locker current accent color.        |
| E   | `active snippets`      | info        | Current count of active CSS snippets                                                                                             |
| F   | `active appearance`    | info        | Indicates if a device locker or preset is in Light or Dark mode                                                                  |
| G   | `locker`               | info        | Distinguishes the local device locker from other device lockers (in Isolate tab)                                                 |
| H   | `duplicate warning`    | info        | Alerts you when a Style ID is duplicated across different sources.                                                               |
| I   | `mode`                 | info        | Shows which mode that component is currently active                                                                              |
| J   | `schedule`             | interactive | Indicates if a preset is currently managed by a date & time-based schedule. Click to edit the preset's active schedule.          |

---

## Integrated CSS Code Editor Modal

Style Manager features an integrated editing modal built on CodeMirror 6, allowing you to edit styles, snippets, and theme files without leaving Obsidian.

### Key Features

- **Direct Editing**: Modify CSS files without leaving Obsidian.
- **Smart Block Injection**: Quickly add blocks and setting components using the **Add Block** button.
- **Developer-Friendly Tools**: Includes line wrapping toggles, automatic bracket closing, and `Mod-s` (Ctrl/Cmd+S) support for quick saving.
- **Flexible Management**: Rename snippets or toggle directly from the modal footer.

### The Evolution of Style Management

For a long time, managing style settings manually in CSS files could cause errors:
- **Manual Boilerplate**: Authors had to manually type out the `/* @settings` blocks, leading to repetitive work and frequent typos.
- **Fragile Indentation**: Since the configuration uses YAML, a single misplaced space or a wrong indentation level could break the entire settings block. Style Manager now supports customizable indentation and enforces constraints to prevent these errors.
- **Structural Risks**: Adding a new setting field often meant carefully inserting a dash (`-`) and several lines of properties exactly in the right place, risking the accidental deletion of existing settings.

Style Manager eliminates these pain points by automating the structure and placement of these blocks, allowing authors to focus on the design rather than the syntax.

#### Smart Insertion Logic Reference

```
+---------------------------------------------------------+
|                  Top of CSS File                        |
|   /* @metadata                                          |
|      (Metadata block is always injected here) */        |
+---------------------------------------------------------+
|                                                         |
|                  Your Custom CSS                        |
|                                                         |
+---------------------------------------------------------+
|                  Bottom of CSS File                     |
|   /* @settings                                          |
|      (Settings container block is injected here) */     |
+---------------------------------------------------------+
```

| Block                 | Cursor Location                    | Resulting Position                                             |
| :-------------------- | :--------------------------------- | :------------------------------------------------------------- |
| **`@metadata`**       | Anywhere                           | Top of file                                                    |
| **`@settings`**       | Anywhere                           | Bottom of file                                                 |
| **Setting Component** | Left of/on the dash (`-`)          | Above the current field                                        |
| **Setting Component** | Inside setting properties          | Below the current field                                        |
| **Setting Component** | Outside any block (but one exists) | Above the first field of the next block (or end of last block) |
| **Setting Component** | No `@settings` block exists        | Exactly at the cursor                                          |

---

## CSS Snippet Metadata Block (`@metadata`)

The `@metadata` block allows developers to embed authorship, license, and versioning data directly inside CSS files as a standard comment block. The Style Manager parser reads this block and displays in the **Snippets tab**.

### Adding a Metadata Block

#### Method A: Automatic Injection (Recommended)

1. In the **Snippets** tab, click on any CSS snippet to open the built-in editor.
2. In the CSS editor footer, click the **plus (`+`) icon** (**Add block** button).
3. Select **"Add @metadata block"**.
4. Fill in the values of the pre-formatted template inserted at the top of your file.

#### Method B: Manual Writing

Type the following comment structure at the top of your `.css` file:

```css
/* @metadata
description: This snippet adds a glowing effect to the active line in the editor.
author: Jane Doe
version: 1.2.0
authorUrl: https://github.com/janedoe
license: MIT
*/

.cm-activeLine {
    background-color: rgba(255, 255, 0, 0.1);
    box-shadow: 0 0 5px yellow;
}
```

### Supported Metadata Fields

| Field         | Description                                    | Example                                     |
| :------------ | :--------------------------------------------- | :------------------------------------------ |
| `description` | A brief explanation of what the snippet does.  | `description: Customizes the sidebar width` |
| `author`      | The name of the creator.                       | `author: emarpiee`                          |
| `version`     | The current version of the snippet.            | `version: 1.0.0`                            |
| `authorUrl`   | A link to the author's profile or website.     | `authorUrl: https://example.com`            |
| `license`     | The license under which the snippet is shared. | `license: MIT`                              |

To show these in your list views, enable **"Display metadata (Author, Version, etc.) for CSS snippets…"** in the **Preferences Tab**.

---

## Style Settings Block (`@settings`)

Style Manager uses a specific system to turn CSS class and variables into user-configurable settings in the **Styles tab**. This is done using special comment blocks. To expose configurable settings, wrap YAML configuration blocks inside CSS comments starting with `/* @settings`.

Style Manager scans for these comments in all CSS loaded by Obsidian from the `snippets`, `themes`, and `plugins` directories under your vault's configuration directory (`%yourVault%/.obsidian/`).

### What is a Setting Component?

A **Setting Component** is a single configurable item within an `@settings` block. It defines one specific component type (like a color, a number, or a toggle) that a user can change.

Each component starts with a dash (`-`) and contains key such as an `id`, `title`, `type`, and a `default` value.

**Example of a Setting Component:**

```css
/* @settings
name: My Theme
id: my-theme
settings:
    - 
        id: accent-color
        title: Accent Color
        description: Changes the main accent color of the theme
        type: variable-color
        default: '#7b2cbf'
*/
```

*In this example, everything from the dash (`-`) to the end of the `default` value is one **Setting Component**.*

### Basic Structure Example

Add the following template block inside a snippet or theme `.css` file:

```css
/* @settings

name: Custom Sidebar
id: custom-sidebar-id
settings:
    - 
        id: custom-sidebar-title
        title: Sidebar Settings
        type: heading
        level: 3
    - 
        id: sidebar-bg-color
        title: Background Color
        type: variable-color
        format: hex
        default: '#1a1a1a'
    - 
        id: sidebar-width
        title: Sidebar Width (px)
        type: variable-number
        default: 250
        format: px

*/
```

### Setting Types Overview

Remember that every setting component is separated by a dash (`-`) and must include a `type`. Here is a quick reference for all available setting component types:

| **Type**                     | **Description**                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------- |
| **`heading`**                | Organizes settings into collapsible nested sections.                              |
| **`info-text`**              | Displays arbitrary informational text or markdown to users.                       |
| **`class-toggle`**           | A switch to toggle classes on and off the `body` element.                         |
| **`class-select`**           | A dropdown menu of predefined options to add specific classes to the `body`.      |
| **`variable-text`**          | A standard text-based CSS variable.                                               |
| **`variable-number`**        | A numeric CSS variable (with optional unit formatting).                           |
| **`variable-number-slider`** | A numeric CSS variable represented and adjusted via a visual slider.              |
| **`variable-select`**        | A dropdown menu of predefined options for a text-based CSS variable.              |
| **`variable-color`**         | A color CSS variable with a corresponding interactive color picker.               |
| **`variable-themed-color`**  | Generates two color pickers for light and dark mode.                              |
| **`color-gradient`**         | Outputs a fixed number of colors along a gradient between two existing variables. |

### Global Parameters

All settings definitions (regardless of type) must include the following core parameters:
- `id`: A unique identifier for the setting.
- `title`: The label displayed in the user interface.
- `type`: The layout component style.
- `description` *(optional)*: Informational text displayed next to the setting.

### Detailed Setting Examples

#### 1. `heading`

Creates collapsible sections to organize variables. Ensure that you follow the proper level of headings (hierarchical order) for sticky headings to work properly in **Styles tab**.
- **Required:** `level` (number from `1` to `6`).
- **Optional:** `collapsed` (boolean: `true`/`false`).

```css
    - 
        id: structure-heading
        title: Layout Structure
        type: heading
        level: 1
        collapsed: true
```

#### 2. `info-text`

Displays markdown-styled text blocks inside your settings view.
- **Required:** `markdown: true`.

```css
    - 
        id: format-notice
        title: Readme Instructions
        description: "Refer to the *online guide* for configuration rules."
        type: info-text
        markdown: true
```

#### 3. `class-toggle`

Toggles a CSS class directly on the HTML `<body>` element. The `id` of the setting will be used as the class name.
- **Optional:** `default` (boolean), `addCommand` (boolean - adds a hotkey command to the command palette).

```css
    - 
        id: hide-sidebar-titles
        title: Hide Sidebar Headers
        description: Hides structural labels in the left sidebar
        type: class-toggle
        default: false
        addCommand: true
```

#### 4. `class-select`

Creates a dropdown menu that applies a selected CSS class to the HTML `<body>` element. The `id` of the setting will be used as the variable name.
- **Required:** `options` list, `allowEmpty` (boolean).
- **Optional:** `default` value (required if `allowEmpty` is false).

```css
    - 
        id: sidebar-font-theme
        title: Navigation Typography
        type: class-select
        allowEmpty: false
        default: serif-style
        options:
            - serif-style
            - sans-style
            - mono-style
```

*Note: Options can also be structured as `label` / `value` pairs:*

```css
    options:
        - 
            label: Classic Serif
            value: serif-style
        - 
            label: Modern Sans
            value: sans-style
```

#### 5. `variable-text`

Sets a text-based CSS variable. The `id` of the setting will be used as the variable name.
- **Required:** `default`.
- **Optional:** `quotes` (boolean - wraps output in single quotes if set to true).

```css
    - 
        id: header-font-family
        title: Main Header Font
        type: variable-text
        default: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif
        quotes: false
```

#### 6. `variable-number`

Sets a numeric value. The `id` of the setting will be used as the variable name.
- **Required:** `default`.
- **Optional:** `format` (appends a unit string, e.g., `px`, `em`, `rem`).

```css
    - 
        id: active-border-width
        title: Border Width
        type: variable-number
        default: 2
        format: px
```

#### 7. `variable-number-slider`

Creates a sliding adjustment input for numeric values. The `id` of the setting will be used as the variable name.
- **Required:** `default`, `min`, `max`, `step`.
	- `min`: The minimum possible value of the slider
	- `max`: The maximum possible value of the slider
	- `step`: The size of each "tick" of the slider. For example, a step of 100 will only allow the slider to move in increments of 100.
- **Optional:** `format` (appends a unit string).

```css
    - 
        id: content-margin-size
        title: Border Gap Width
        type: variable-number-slider
        default: 16
        min: 0
        max: 64
        step: 2
        format: px
```

#### 8. `variable-select`

Creates a dropdown selection to assign values to a CSS variable. The `id` of the setting will be used as the variable name.
- **Required:** `default`, `options` list.

```css
    - 
        id: code-font-size-tier
        title: Editor Font Style
        type: variable-select
        default: Fira Code
        options:
            - Fira Code
            - Source Code Pro
            - Courier New
```

#### 9. `variable-color`

Creates an interactive color picker interface. The `id` of the setting will be used as the variable name.
- **Required:** `default` (hex color values must be wrapped in quotes), `format`.
- **Optional:** `opacity` (boolean - enables transparency), `alt-format` (outputs alternative values to helper variable targets).

```css
    - 
        id: global-accent-color
        title: System Accent
        type: variable-color
        opacity: true
        format: hex
        alt-format:
            -
                id: global-accent-color-rgb
                format: rgb
        default: '#007AFF'
```

#### 10. `variable-themed-color`

Generates dual color pickers for light and dark appearance profiles. The `id` of the setting will be used as the variable name.
- **Required:** `format`, `default-light`, `default-dark`.
- **Optional:** `opacity`.

```css
    - 
        id: primary-text-color
        title: Primary Text
        type: variable-themed-color
        format: hex
        default-light: '#111111'
        default-dark: '#f5f5f5'
```

#### 11. `color-gradient`

Calculates intermediate color steps along a gradient between two defined CSS color variables.
- **Required:** `from`, `to`, `step`, `format`.
- **Optional:** `pad` (pads number variables with leading zeros).

**Parameters**:
- `from`: The starting color, or color that will be at step 0
- `to`: The ending color, or color that will be at step 100
- `step`: The increment at which to output a CSS variable. For example, setting `step` to `10` will output `--var-0`, `--var-10`, `--var-20`, etc…
- `format`: Can be one of: `hsl`, `rgb`, or `hex`;
- `pad`: When set, the number section of the variable will be padded with `0`'s until it contains this number of digits. For example, setting `pad` to `3` and `step` to `10` will output `--var-000`, `--var-010`, `--var-020`

```css
    - 
        id: color-base
        type: color-gradient
        from: color-base-00
        to: color-base-100
        step: 5
        pad: 2
        format: hex
```

> Outputs: `--color-base-00`, `--color-base-05`, `--color-base-10`, etc.

### Color Variable Formatting Options

The following color format options are available:

#### `hex`

```css
--accent: #007AFF;
/* With opacity: true */
--accent: #007AFFFF;
```

#### `rgb`

```css
--accent: rgb(0, 122, 255);
/* With opacity: true */
--accent: rgba(0, 122, 255, 1);
```

#### `rgb-values`

```css
--accent: 0, 122, 255;
/* With opacity: true */
--accent: 0, 122, 255, 1;
```

#### `rgb-split`

```css
--accent-r: 0;
--accent-g: 122;
--accent-b: 255;
/* With opacity: true */
--accent-a: 1;
```

#### `hsl`

```css
--accent: hsl(211, 100%, 50%);
/* With opacity: true */
--accent: hsla(211, 100%, 50%, 1);
```

#### `hsl-values`

```css
--accent: 211, 100%, 50%;
/* With opacity: true */
--accent: 211, 100%, 50%, 1;
```

#### `hsl-split`

```css
--accent-h: 211;
--accent-s: 100%;
--accent-l: 50%;
/* With opacity: true */
--accent-a: 1;
```

#### `hsl-split-decimal`

```css
--accent-h: 211;
--accent-s: 1;
--accent-l: 0.5;
/* With opacity: true */
--accent-a: 1;
```

### Localization Support

You can provide translated titles and descriptions for every language Obsidian natively supports. Simply append the appropriate language postfix to your YAML keys:

```css
    - 
        id: side-panel-toggle
        title: Toggle Layout
        title.de: Layout Umschalten
        title.ko: 레이아웃 전환
        description: Toggles sidebar panel
        description.de: Schaltet das Seitenpanel um
        description.ko: 사이드바 패널을 토글합니다.
        type: class-toggle
```

#### Supported Language Postfix Codes:

- `en` (English)
- `zh` (Simplified Chinese)
- `zh-TW` (Traditional Chinese)
- `ru` (Russian)
- `ko` (Korean)
- `it` (Italian)
- `id` (Bahasa Indonesia)
- `ro` (Romanian)
- `pt-BR` (Brazilian Portuguese)
- `cz` (Czech)
- `de` (German)
- `es` (Spanish)
- `fr` (French)
- `no` (Norwegian)
- `pl` (Polish)
- `pt` (Portuguese)
- `ja` (Japanese)
- `da` (Danish)
- `uk` (Ukrainian)
- `sq` (Albanian)
- `tr` (Turkish - partial)
- `hi` (Hindi - partial)
- `nl` (Dutch - partial)
- `ar` (Arabic - partial)

---

## Developer and Testing Utilities

The Style Manager includes a suite of built-in tools designed to streamline the process of theme development and UI debugging within Obsidian. These tools provide developers with quick access to common debugging tasks, accessibility checks, and UI testing utilities, all of which are accessible via the Obsidian command palette.

> **Note**: Tools marked with a `(+)` are adapted from the [obsidian-theme-design-utilities](https://github.com/chrisgrieser/obsidian-theme-design-utilities) project.

| Tool                       | Type               | Description                                                                                                 |
| :------------------------- | :----------------- | :---------------------------------------------------------------------------------------------------------- |
| **Color Contrast Checker** | Accessibility      | Opens a contrast checker modal to ensure color accessibility WCAG standards. Can be expanded to a full tab. |
| **Lorem Ipsum**            | Content Generation | Opens a lorem ipsum generator modal for layout and content testing. Can be expanded to a full tab.          |
| **Copy Accent Color**      | Utility            | Quickly copies the vault's current accent color to the clipboard.                                           |
| **CSS Compatibility** (+)  | Information        | Displays the current Chrome, Node, and Electron versions for CSS feature support verification.              |
| **Box Outline** (+)        | UI Debugger        | Toggles a global outline on all elements to help visualize the box model.                                   |
| **Freeze Obsidian** (+)    | Debugger           | Triggers a `debugger` statement after a specified delay to freeze the application state.                    |
| **Garbled Text** (+)       | UI Testing         | Toggles a garbled text on non-hovered text.                                                                 |
| **Mobile Emulation** (+)   | UI Testing         | Toggles Obsidian's built-in mobile emulation mode to test responsive designs.                               |
| **Test Notice** (+)        | Testing            | Displays a persistent test notice to verify notification behavior and styling.                              |
| **Toggle DevTools** (+)    | Debugger           | Quickly opens or closes the Electron developer tools.                                                       |

---

## Transparency

I want to be open about my workflow for this project. I personally directed and designed every aspect of the UI and UX. To give myself more time to focus on that creative side, I used Gemma to help speed up the technical groundwork, specifically implementing complex logic, catching syntax errors, and generating my commit messages.


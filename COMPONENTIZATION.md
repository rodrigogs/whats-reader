# Componentization Roadmap

This document tracks opportunities to extract reusable components from `+page.svelte`.

## Status Legend
- ✅ Completed
- 🚧 In Progress
- ⏳ Planned

## Components to Extract

### 1. ✅ Collapsible Section (Reusable)
**Priority:** High
**Current Usage:** Instructions and Privacy sections in empty state
**Complexity:** Low
**Status:** ✅ Completed

Extract the `<details>` element pattern into a reusable component:
```svelte
<Collapsible title={m.export_instructions_title()} icon="chevron-right">
  <FeatureItem badge="1">{m.export_step_1()}</FeatureItem>
  <FeatureItem badge="2">{m.export_step_2()}</FeatureItem>
</Collapsible>
```

**Benefits:**
- Consistent expand/collapse UI
- Centralized styling for all collapsible sections
- Easier to add new collapsible sections

---

### 2. ✅ Feature List Item
**Priority:** High
**Current Usage:** Export instructions (numbered), Privacy features (icons)
**Complexity:** Low
**Status:** ✅ Completed

Extract the repeated list item pattern:
```svelte
<FeatureItem icon="shield" badge="1">
  {m.privacy_offline()}
</FeatureItem>
```

**Props:**
- `badge?: string | number` - Circle badge (number or icon)
- `icon?: IconName` - Icon for badge
- `variant?: 'numbered' | 'icon'`

**Benefits:**
- DRY for 9+ similar list items
- Consistent spacing and styling
- Easy to add new features

---

### 3. ✅ Modal
**Priority:** Medium
**Current Usage:** Participants modal, could be used for stats
**Complexity:** Medium
**Status:** ✅ Completed

Extract modal pattern (backdrop + positioned dialog):
```svelte
<Modal open={showParticipants} onClose={closeModal}>
  <ModalHeader icon="users" title={m.participants_title()} subtitle={...} />
  <ModalContent>
    <!-- List content -->
  </ModalContent>
</Modal>
```

**Features:**
- Backdrop with click-to-close
- Responsive sizing (full screen on mobile, centered on desktop)
- Keyboard handling (ESC to close)
- Focus trap

**Benefits:**
- Consistent modal UX across the app
- Accessibility built-in
- Stats modal could use this pattern

---

### 4. ✅ Dropdown Menu
**Priority:** Medium
**Current Usage:** Perspective selector
**Complexity:** High
**Status:** ✅ Completed

Extract the custom dropdown with search:
```svelte
<Dropdown anchor={buttonRef} open={isOpen} onClose={...}>
  <DropdownHeader>{m.perspective_view_as()}</DropdownHeader>
  <DropdownSearch bind:value={searchQuery} placeholder={...} />
  <DropdownList>
    <DropdownItem active={true} onclick={...}>
      <Icon name="check" /> {m.perspective_none()}
    </DropdownItem>
  </DropdownList>
</Dropdown>
```

**Features:**
- Floating positioning (using existing `floating` action)
- Search/filter functionality
- Active state indication
- Keyboard navigation

**Benefits:**
- Could be reused for other dropdowns (future: sort, filter options)
- Complex positioning logic centralized
- Accessibility improvements

---

### 5. ⏳ Empty State Section
**Priority:** Low
**Current Usage:** File upload screen
**Complexity:** Medium

Extract the entire empty state into `<EmptyState>`:
- Logo and title section
- FileDropZone
- Collapsible sections (instructions, privacy)
- GitHub star CTA

**Benefits:**
- Cleaner main page
- Easier to modify onboarding experience
- Could be reused for "no chats" state after removal

---

### 6. ⏳ Header Bar
**Priority:** Low
**Current Usage:** 4 instances (sidebar, chat header, gallery, bookmarks)
**Complexity:** Low

Extract repeated green header pattern:
```svelte
<HeaderBar theme="whatsapp">
  {#snippet left()}
    <IconButton>...</IconButton>
    <Avatar>...</Avatar>
  {/snippet}
  {#snippet actions()}
    <IconButton>...</IconButton>
  {/snippet}
</HeaderBar>
```

**Benefits:**
- Consistent header height and styling
- Electron macOS titlebar integration centralized

---

### 7. ⏳ Panel Layout
**Priority:** Low
**Current Usage:** Sidebar, bookmarks panel, gallery panel
**Complexity:** Medium

Extract sliding panel pattern:
```svelte
<Panel position="left" open={showSidebar} width="320px">
  <PanelHeader />
  <PanelContent>
    <ChatList ... />
  </PanelContent>
</Panel>
```

**Features:**
- Slide-in/out animation
- Mobile overlay
- Electron macOS titlebar spacing

**Benefits:**
- Consistent panel behavior
- Easier to add new panels
- Animation/transition centralized

---

### 8. ⏳ Settings Group
**Priority:** Low  
**Current Usage:** Top-right corner (2 instances)
**Complexity:** Very Low

Extract the settings button group:
```svelte
<SettingsGroup>
  <LocaleSwitcher variant="default" />
  <ThemeToggle isDark={isDarkMode} onToggle={toggleDarkMode} />
</SettingsGroup>
```

**Benefits:**
- Consistent spacing between settings buttons
- Easy to add more settings buttons

---

## Implementation Order

1. **Collapsible** ✅ Completed - Reduced 40+ lines in +page.svelte
2. **FeatureItem** ✅ Completed - Replaced 10 duplicate list items
3. **Modal** ✅ Completed - Extracted modal with header/content sub-components, added ESC key handling
4. **Dropdown** ✅ Completed - Extracted dropdown with header/search/list sub-components, ~70 lines reduced
5. **EmptyState** - Uses components from 1-2
6. **HeaderBar** - Low complexity, high code reduction
7. **Panel** - Complex but high value
8. **SettingsGroup** - Quick win

## Notes

- All new components should use Svelte 5 runes (`$props`, `$derived`, etc.)
- Follow existing component patterns (Icon, Button, IconButton)
- Add JSDoc documentation for props
- Use snippets for flexible content slots
- Ensure accessibility (ARIA labels, keyboard navigation)

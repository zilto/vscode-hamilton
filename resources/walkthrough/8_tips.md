# Additional tips
VSCode allows for flexible windows layout and keyboard shortcuts. It is valuable to learn its capabilities and setup your workflow for a given project. For example, ensure that you have enough screen space for DAG visualization or results preview

## Panels
In VSCode, the vertical sidebar is called the `activity bar` and the horizontal sidebar (where the terminal is) is called the `panel`.

- **Tabs** found under the `activity bar` or the `panel` (**Modules view**, **DAG visualization**, **Dataframe preview**, etc.) can be moved between the two.
- **Sections** found under a tab can be moved between **Tabs**.
- **Sections** can be folded by clicking the UI.
- The `activity bar` can be moved to the **left** or **right** via the setting `workbench.sideBar.location`
- The `panel` can be move to the **left**, **right**, or **bottom** by clicking the header and setting the `panel position`.
- The `panel` can be quickly open/closed with `CTRL+J`
- If you can't find a view, open the command palet and search for `Hamilton: Focus [...]` for shortcuts.
- If your setup becomes a mess, open the command palet and use `View: Reset View Locations`

### Example setup
When developing, I prefer to have the `panel` vertically on the left. I keep the **DAG visualization** and **Dataframe preview** grouped under the **Output tab** next to the **Hamilton server logger**. I keep the **Dataframe preview** folded and only look at it when needed.

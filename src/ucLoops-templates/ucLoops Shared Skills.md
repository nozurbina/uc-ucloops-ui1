# SHARED SKILLS

* The following skills are available in all agents and assistants

## SKILLS

/help OR /list: Bulleted list of known /skill formatted skills, including this one, with 1-sentence descriptions for low-tech users of how and when they can use those skills. (Remove ${} markup.) 

---

/learn: Add the input as context to the current task. Reply only with "Input added. Reminder: This does not update my base configuration!"

---

/${skill} ? reply with the instructions for the use of the ${skill}. When displaying this, prefix with "/[${skill}] instructions:”

---

/sticky: Take a skill request or other materials. Rewrite the existing or usual skill output using very short sentences or sentence fragments suitable for whiteboard sticky notes. 

- Keep the results under the same headings if applicable. 

- DO NOT combine any items. Work step by step through every item in every list & make sure that it is individually summarised. 

- If executing this while executing a skill for the first time, aim for 5 or more stickies per group unless the skill states otherwise.

  Output 

- an Excel or Google Sheets table if possible, if not, create a markdown table instead.
  - put only one item per cell
  - for bulleted lists or numbered lists, do not include the bullet character or number in the cell) 

---

/p-create-page (DISABLED IN FREE DEMO)

Take a `/persona-export` `.md` (or equivalent persona description) into a standalone HTML persona profile.

- Use `persona-template.html` from the project as the base. All structural detail (sections, ID system, two-column pairings, domain entities) is documented in the template's inline comments. Follow them.
- Inline the full contents of `humanloops-urbina.css` from the project into the `<style>` block at the top of `<head>`, replacing the placeholder comment. The export must be standalone.
- The `.md` structure may shift over time. Map by intent rather than literal heading match. If new sections appear, add new `.section` cards in the same visual style and pick a fitting 4-letter type code. 
  - For any card whose source is empty or absent in that section, render an empty card. 
  - If a whole section is empty, omit the whole section.

- If required inputs (persona name, role, source `.md`, or the CSS file) are missing, stop and ask before generating. Derive the 4-letter persona code from the name if not supplied.
- Save as `persona-[persona-slug].html` and present as a downloadable file. After delivering, flag any sections that did not map cleanly.

---
/j-create-page (DISABLED IN FREE DEMO)

Render `/j-stage`, `/j-suggest`, and `/j-data` outputs for a journey into a standalone HTML journey map.

- Use `journey-map-template.html` from the project as the base. All structural detail (rows, ID system, opportunity references, domain entities, sidebar) is documented in the template's inline comments. Follow them.
- Inline the full contents of `humanloops-urbina.css` from the project into the `<style>` block at the top of `<head>`, replacing the placeholder comment. The export must be standalone.
- The `.md` structure may shift over time. Map by intent rather than literal heading match. If new sections appear, add new rows in the same visual style and pick a fitting 4-letter type code. 
  - If a card is missing for a stage, render an empty cell. 
  - If a whole section is empty, omit the whole section.

- If required inputs (journey title, stage names, persona descriptors, source `.md` outputs, or the CSS file) are missing, stop and ask before generating.
- Save as `journey-map-[short-slug].html` and present as a downloadable file. After delivering, flag any sections that did not map cleanly and any opportunity references that could not be resolved against items in the grid.

---

/summary: Create a doc summarising this conversation. Heading structure:  
1\. Main Topics & Flow

* (Initial request/problem & how it evolved. 2-3 sentences)  
* (Major direction changes, if any)

2\. Key Insights & Decisions

* (list of 3-5 most important findings or determinations)  
* (critical metrics/data)

3\. Assets or Documents Created  
Table:  

| Title                                                        | Type | Purpose |
| ------------------------------------------------------------ | ---- | ------- |
| 4\. Follow-up Needed                                         |      |         |
| (Brief note on any outstanding issues or logical next steps) |      |         |

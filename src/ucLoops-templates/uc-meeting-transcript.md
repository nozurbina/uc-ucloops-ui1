---
name: uc-transcript-cleanup
description: Clean up and structure meeting transcripts for readability while preserving accuracy and verbatim quotes. Use this skill whenever the user mentions a transcript, interview recording, meeting notes, or raw conversation text that needs to be cleaned up, structured, or summarised. Also trigger when the user says /transcript /transcript-cleanup /uc-meeting-transcript /meeting-transcript or asks to "process", "clean", "format", or "tidy up" a transcript. If someone pastes raw dialogue or mentions speaker names with timestamps, this skill should kick in automatically.
---

## What this skill does

This skill takes a raw transcript (interview, meeting, focus group, etc.) and produces a clean, structured document that:
- Removes irrelevant small talk and logistics
- Preserves verbatim quotes and the original voice of each speaker
- Confirms proper names and terminology before finalising
- Delivers a structured .md file with metadata, key takeaways, and organised transcript sections
- Reflects tone neutrally from the original document avoiding dramatic or emotional tone

## Step-by-step process

Follow these steps in order. Some steps require stopping to get user input before continuing.

### Step 1: Read and orient
Read through the entire transcript to understand the context, subject matter, and speakers before doing anything else.

### Step 2: Check for metadata
Look for: filename or meeting title, date, and speaker names or descriptors. Note what's present and what's missing.

### Step 3: Remove irrelevant content
Identify and mentally set aside unrelated small talk at the beginning and end (greetings, personal chat unrelated to the main discussion, technical setup, scheduling future meetings). These will not appear in the output.

### Step 4: Ask for missing metadata
If any metadata is missing (title, date, speaker names), stop and ask the user to supply it before continuing.

### Step 5: Extract proper names for confirmation
Identify and list all apparent proper names from the transcript:
- Names of speakers
- Brand names
- Organisation names
- Acronyms
- Technical terms

**Stop here and ask the user to confirm or correct any names that may have been transcribed incorrectly.** Do not proceed until this is done — transcription errors in names are common and hard to spot later.

### Step 6: Apply confirmed names
Use the confirmed or corrected proper names consistently throughout the rest of the work.

### Step 7: Identify key findings
Read through the substantive content and identify 3–6 key takeaways for the Executive Summary / Key Takeaways section.

### Step 8: Produce the output document
Save a `.md` file (this is the default) with the structure below. Provide a download link.

### Step 9: Offer alternative formats
After delivering the `.md` file, ask the user if they'd also like the transcript in another format:
- **HTML**: use the theme-factory skill to apply a clean, minimal theme before saving as `.html`
- **Word (.docx)**: use the docx skill to produce a properly formatted `.docx`

Provide a download link for any additional format produced.

---

## Output structure

Use these headings exactly:

```
# [Meeting/Interview Title]

## Metadata
- **File/Title**:
- **Date**:
- **Speakers**:

## Key takeaways
[3–6 bullet points summarising the most important things said]

## Transcript

### [Subheading: key question, topic, or theme]
[Relevant verbatim sections with irrelevant content removed. Use exact quotes.
Retain original 1st/2nd/3rd person perspective. Preserve each speaker's individual voice and style.]

### [Next subheading...]
...
```

Subheadings should reflect the actual topics discussed — for interviews, use the key questions; for meetings, use agenda items or themes.

---

## Guiding principles

**Always:**
- Maintain the original flow and conversational nature of the transcript
- Preserve each participant's individual speaking style and cultural voice
- Focus the output on the relevant subject matter only
- Use verbatim quotes to support key points

**Never:**
- Add new content or information not present in the original
- Change the meaning of any statement
- Paraphrase quotes in a way that loses the speaker's voice
